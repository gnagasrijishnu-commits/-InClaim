import { readFileSync } from 'node:fs';
import { all, one } from './db.js';

const SUPPORTED_PROVIDER = 'openai';
const DEFAULT_MODEL = 'gpt-4o';

function aiConfigurationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateAiConfig(config) {
  if (!config || typeof config !== 'object') throw aiConfigurationError('AI settings are required. Open Settings and provide your OpenAI API key.');
  if (config.provider !== SUPPORTED_PROVIDER) throw aiConfigurationError('Only the OpenAI provider is currently supported.');
  if (typeof config.apiKey !== 'string' || !config.apiKey.trim()) throw aiConfigurationError('An OpenAI API key is required for AI analysis.');
  if (typeof config.model !== 'string' || !config.model.trim()) throw aiConfigurationError('Choose an OpenAI vision model in Settings.');
  return { apiKey: config.apiKey.trim(), model: config.model.trim() };
}

async function openAIVisionAnalysis(images, duplicate, config) {
  const { apiKey, model } = validateAiConfig(config);
  const imageContent = images.map(image => ({
    type: 'image_url', image_url: { url: `data:${image.mime_type};base64,${readFileSync(image.file_path).toString('base64')}` }
  }));
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an insurance vehicle-damage assessor. Assess only visible vehicle damage and visual image-integrity signals. Return JSON only; do not invent hidden damage. You do not decide claim coverage.' },
        { role: 'user', content: [{ type: 'text', text: `Analyse these labelled claim photos. Return exactly this JSON shape: {"invalidAngles":["angle"],"remarks":["string"],"classification":"minor|moderate|severe","parts":[{"part":"string","severity":"minor|moderate|severe","confidence":0.0}],"fraud":{"riskScore":0.0,"status":"clear|flagged","remarks":["string"]},"estimate":{"currency":"INR","amount":0,"range":{"low":0,"high":0},"labour":0,"parts":0,"confidence":0.0},"overallConfidence":0.0}. Images arrive in this order: ${images.map(i => i.angle).join(', ')}.` }, ...imageContent] }
      ]
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw aiConfigurationError(`OpenAI analysis failed (${response.status}). Check the API key, model, and account access. ${detail.slice(0, 180)}`);
  }
  const payload = await response.json();
  let ai;
  try { ai = JSON.parse(payload.choices?.[0]?.message?.content || '{}'); } catch { throw aiConfigurationError('OpenAI returned an unreadable analysis response. Please retry.'); }
  const invalidAngles = Array.isArray(ai.invalidAngles) ? ai.invalidAngles : [];
  const duplicateRemark = duplicate ? `Exact duplicate image also found in prior claim ${duplicate.claim_number}. Officer review required.` : null;
  const modelFraud = ai.fraud && typeof ai.fraud === 'object' ? ai.fraud : {};
  const fraud = {
    riskScore: Math.max(Number(modelFraud.riskScore) || 0, duplicate ? 0.88 : 0),
    status: duplicate || modelFraud.status === 'flagged' ? 'flagged' : 'clear',
    remarks: [...(Array.isArray(modelFraud.remarks) ? modelFraud.remarks : []), ...(duplicateRemark ? [duplicateRemark] : [])]
  };
  const confidence = Number(ai.overallConfidence) || 0;
  return {
    damage: { classification: ai.classification || 'moderate', parts: Array.isArray(ai.parts) ? ai.parts : [], photoValidity: { valid: images.length - invalidAngles.length, invalid: invalidAngles.length, remarks: [...(Array.isArray(ai.remarks) ? ai.remarks : []), ...invalidAngles.map(angle => `${angle}: photo may not be usable`)] } },
    fraud,
    estimate: ai.estimate || { currency: 'INR', amount: 0, range: { low: 0, high: 0 }, labour: 0, parts: 0, confidence },
    confidence,
    ai: { provider: 'OpenAI', model }
  };
}

export const aiDefaults = { provider: SUPPORTED_PROVIDER, model: DEFAULT_MODEL };

export async function analyseClaim(claimId, aiConfig) {
  const images = all('SELECT angle,sha256,is_valid,file_path,mime_type FROM claim_images WHERE claim_id=?', claimId);
  const duplicate = one(`SELECT c.claim_number FROM claim_images ci JOIN claims c ON c.id=ci.claim_id WHERE ci.sha256 IN (${images.map(() => '?').join(',') || "''"}) AND ci.claim_id!=? LIMIT 1`, ...images.map(i => i.sha256), claimId);
  return openAIVisionAnalysis(images, duplicate, aiConfig);
}
