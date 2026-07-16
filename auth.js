import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { one, run } from './db.js';

export const id = () => randomBytes(12).toString('hex');
export const now = () => new Date().toISOString();
export function hashPassword(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function validPassword(password, stored) { const [salt, hash] = stored.split(':'); const candidate = scryptSync(password, salt, 64).toString('hex'); return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex')); }
export function createSession(user) { const token = randomBytes(32).toString('hex'); run('DELETE FROM sessions WHERE user_id=? OR expires_at < ?',user.id,now()); run('INSERT INTO sessions VALUES (?,?,?,?,?)',id(),user.id,sha256(Buffer.from(token)),new Date(Date.now()+1000*60*60*24*7).toISOString(),now()); return token; }
export function auth(req, requiredRole) { const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if(!token)return null; run('DELETE FROM sessions WHERE expires_at < ?',now()); const user=one(`SELECT u.id,u.role,u.name,u.email,u.phone,u.official_licence FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,sha256(Buffer.from(token)),now()); return user && (!requiredRole || user.role === requiredRole) ? user : null; }
export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
export function audit(claimId, actorId, action, detail = null) { run('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?)', id(), claimId, actorId, action, detail, now()); }
