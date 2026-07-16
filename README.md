## Live demo

Open the application: https://your-app-name.onrender.com
# InClaim Claims API

Zero-dependency Node.js backend for the claims workflow. It uses Node 24's built-in SQLite driver, storing data in `data/vanta.db`, and saves submitted image files under `uploads/`.

## AI disclosure and evaluator BYOK setup

**Provider:** OpenAI. **Default model/version:** `gpt-4o` (the model field is editable in the application Settings screen). The application uses the OpenAI Chat Completions vision API for vehicle-photo assessment, visual anomaly screening, and repair-estimate generation. It does **not** contain a mocked, rule-based, or fallback AI path: analysis is unavailable until a valid evaluator-supplied key is provided.

After starting the app, sign in, select **AI Settings** in the navigation, and enter an OpenAI API key plus the model to test. The key is held in browser session storage and is sent only with the analysis request; the backend does not save it to the database, environment files, logs, or source code. Each evaluator can use their own key without changing code or server configuration.

The supplementary exact-image duplicate check is a plainly labelled deterministic integrity check, not an AI feature. Claim coverage remains an officer decision.

## Run

```powershell
npm run dev
```

The API runs at `http://localhost:3000`. Use `Authorization: Bearer <token>` for protected endpoints.

## Password-reset email

The frontend includes **Forgot password?**. It calls `POST /auth/forgot-password`, which stores a one-hour, single-use reset token, and `POST /auth/reset-password`, which updates the password only when that token is valid.

For a real email, set these environment variables before starting the server:

```powershell
$env:RESEND_API_KEY = 're_...'
$env:EMAIL_FROM = 'InClaim <no-reply@your-verified-domain.com>'
$env:APP_URL = 'http://localhost:3000'
npm run dev
```

Without email settings, it returns a `developmentResetUrl` in the API response and writes it to the server console, so the flow can be tested locally.

## Workflow

1. `POST /auth/register` — create a `customer` or `officer` account.
2. `PATCH /me/details` — save personal, licence, vehicle, and insurance information.
3. `POST /claims` — create a draft claim with `incidentDescription` and `incidentDate`.
4. `POST /claims/:claimId/images` — upload each required view as a base64 data URL: `front`, `back`, `left`, `right`, `top`, and `damage_closeup`.
5. `POST /claims/:claimId/analyse` — validates the complete image set and produces damage, fraud, duplicate-image, and cost-estimate results.
6. `POST /claims/:claimId/submit` — customer confirms sending to an officer.
7. `GET /officer/claims` and `POST /officer/claims/:claimId/decision` — officer reviews and approves/rejects coverage.

## Important production integration point

`src/analysis.js` is a deliberately isolated development AI adapter. Its contract already returns image validity, part/severity classification, duplicate-claim fraud remarks, and an INR repair estimate. Replace that function with calls to your real image-analysis, fraud, and pricing services without changing the routes or database schema.

All changes to a claim are written to `audit_events`, giving officers a decision trail.
