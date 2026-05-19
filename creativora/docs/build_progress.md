# Advolt.ai — Build Progress

## Project Info

- Product: Advolt.ai (AI Ad Intelligence SaaS)
- AWS Account: 971598352248
- AWS profile: voltai
- Region: TBD (set before first deploy)
- Architecture: Fully serverless, AWS SAM + Amplify

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), Tailwind CSS, TypeScript |
| Hosting | AWS Amplify |
| Backend | AWS SAM, Lambda, API Gateway |
| Database | DynamoDB |
| Storage | S3 + CloudFront |
| Auth | Cognito |
| Async | EventBridge + SQS |
| AI | OpenAI + Claude (abstraction layer) |
| Payments | Razorpay |
| Email | SES |
| Extension | Chrome MV3, TypeScript |

---

## Plan Limits

| Plan | Ads | AI Analyses |
|---|---|---|
| Free | 5 | 5 |
| Pro | 40 | 40 |

---

## Build Phases

| Phase | Scope | Status |
|---|---|---|
| 1A | Cognito auth, Backend APIs, DynamoDB schema, S3 upload flow | ✅ Complete |
| 1B | Chrome extension, Meta extraction, Save ad flow | ✅ Complete |
| 1C | AI analysis engine, Prompt engineering, AI results storage | 🔲 Not started |
| 1D | Dashboard UI, Ad library, Filters/search, Ad details page | 🔲 Not started |
| 1E | Billing, Limits enforcement, Production hardening | 🔲 Not started |

---

## Progress Log

### 2026-05-19

- Project scaffolded under `/Advolt.ai`
- Architecture doc moved to `/Advolt.ai/docs/phase_1_architecture.md`
- AWS account verified (Account: 971598352248, profile: voltai)
- Folder structure created:
  - `/backend/src/{auth,ads,ai,billing,media,shared}`
  - `/frontend`
  - `/chrome-extension`
  - `/infrastructure/{env,scripts}`
  - `/docs`
- Build progress notes started

**Next:** Begin Phase 1A — Cognito setup + SAM template skeleton + DynamoDB tables

---

### 2026-05-19 — Phase 1A Complete

SAM backend fully scaffolded. All Lambda handlers written.

Files created:
- `backend/template.yaml` — full SAM template (Cognito, DynamoDB x3, S3, CloudFront, SQS, EventBridge, API Gateway, all Lambdas)
- `backend/samconfig.toml` — deploy config for dev/staging/prod, region ap-south-1, profile navin
- `backend/src/shared/nodejs/lib/` — response helpers, DynamoDB client, getUserFromEvent
- `backend/src/auth/` — signup, login, refresh
- `backend/src/ads/` — saveAd, getAds, getAdDetails, deleteAd, updateAd
- `backend/src/ai/` — triggerAnalysis, processAnalysis, getResult, aiProvider, prompts
- `backend/src/billing/` — createOrder, webhook (with HMAC verification), getStatus

Key implementation details:
- Free limit (5 ads/5 AI) and Pro limit (40 ads/40 AI) enforced server-side
- AI credit deduction uses DynamoDB conditional update to prevent race conditions
- Razorpay webhook verifies HMAC-SHA256 signature before processing
- AI provider abstraction in `aiProvider.js` — swap OpenAI/Claude via `AI_PROVIDER` env var
- Prompts centralized and versioned in `prompts.js`
- All S3 media access via CloudFront with OAC (no public bucket)
- EventBridge fires on ad save → SQS → AI Lambda (async, non-blocking)

**Next:** Phase 1B — Chrome Extension

---

### 2026-05-19 — Phase 1B Complete

Chrome Extension (Manifest V3) fully built.

Files created:
- `manifest.json` — MV3, host permissions for facebook.com + instagram.com
- `src/lib/storage.js` — chrome.storage.local wrapper, token helpers, expiry check
- `src/lib/auth.js` — login/refresh API calls
- `src/lib/api.js` — authenticated API client via background worker
- `src/background/worker.js` — service worker: token refresh, login/logout, save ad, recent ads, selector config fetch
- `src/content/index.js` — DOM scanner, ad detector, data extractor, Save button injector, MutationObserver
- `src/popup/popup.html + popup.css + popup.js` — dark mode popup: login form, stats (ads saved, AI credits, plan), recent saves, dashboard link
- `public/selectors.json` — versioned remote selector config (upload to S3 selector-config bucket)

Key implementation details:
- Selector config fetched from CloudFront on worker startup, cached locally as fallback
- Token stored in chrome.storage.local (device-scoped), silent refresh 2 min before expiry
- Save button states: Save Ad → Saving → Saved / Limit reached / Failed
- MutationObserver watches for dynamically loaded ads (infinite scroll)
- All API calls go through background worker (single token refresh point)

**TODO before loading in Chrome:**
1. Replace `YOUR_API_GATEWAY_URL` in `worker.js`, `api.js`, `auth.js`, `popup.js` with real API URL after SAM deploy
2. Replace `YOUR_CLOUDFRONT_URL` in `worker.js` with real CloudFront URL
3. Replace `YOUR_DASHBOARD_URL` in `popup.html` with real dashboard URL
4. Upload `public/selectors.json` to the `Advolt.ai-selector-config` S3 bucket at path `config/selectors.json`
5. Add real icon PNGs to `public/icons/` (16x16, 48x48, 128x128)

**Next:** Phase 1C — AI Analysis Engine (already built in 1A, needs prompt tuning + testing)

---

## Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-19 | Amplify Hosting (not S3+CloudFront manual) | Simpler CI/CD, built-in branch deploys |
| 2026-05-19 | chrome.storage.local for extension tokens | Avoids sync quota limits, keeps tokens device-scoped |
| 2026-05-19 | Remote selector config via S3/CloudFront | Patch Meta DOM selectors without new extension release |
| 2026-05-19 | GSI on ai_analysis.ad_id | Avoid full table scan when fetching analysis by ad |
| 2026-05-19 | Server-side atomic credit deduction | Prevent race conditions on credit exhaustion |
| 2026-05-19 | Razorpay HMAC-SHA256 webhook verification | Security — reject tampered webhook calls |
| 2026-05-19 | Free: 5 ads/5 AI, Pro: 40 ads/40 AI | MVP limits agreed by user |

---

## AWS Resources (to be created)

| Resource | Name | Status |
|---|---|---|
| Cognito User Pool | Advolt.ai-users | ✅ In template |
| DynamoDB Table | Advolt.ai-ads | ✅ In template |
| DynamoDB Table | Advolt.ai-ai-analysis | ✅ In template |
| S3 Bucket | Advolt.ai-media-{account_id} | ✅ In template |
| S3 Bucket | Advolt.ai-selector-config | ✅ In template |
| CloudFront Distribution | media CDN | ✅ In template |
| SQS Queue | Advolt.ai-ai-queue | ✅ In template |
| EventBridge Rule | ad-saved-trigger | ✅ In template |
| SES Identity | (sender email) | 🔲 |
| Amplify App | Advolt.ai-frontend | 🔲 |

---

## Environment Variables Needed

```
OPENAI_API_KEY
CLAUDE_API_KEY
COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID
ADS_BUCKET
CLOUDFRONT_URL
DYNAMODB_TABLE_ADS
DYNAMODB_TABLE_AI
RAZORPAY_KEY
RAZORPAY_SECRET
RAZORPAY_WEBHOOK_SECRET
SELECTOR_CONFIG_URL
```

---

## Reference Docs

- [Phase 1 Architecture](./phase_1_architecture.md)
