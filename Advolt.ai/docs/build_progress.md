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
| 1D | Dashboard UI, Ad library, Filters/search, Ad details page | ✅ Complete |
| 1E | Billing, Limits enforcement, Production hardening | ✅ Complete |

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
1. ✅ Replace `YOUR_API_GATEWAY_URL` in `worker.js`, `api.js`, `auth.js`, `popup.js` — done
2. ✅ Replace `YOUR_CLOUDFRONT_URL` in `worker.js` — done
3. ✅ Replace `YOUR_DASHBOARD_URL` in `popup.html` — done
4. Upload `public/selectors.json` to the `advolt-selector-config-971598352248-dev` S3 bucket at path `config/selectors.json`
5. Add real icon PNGs to `public/icons/` (16x16, 48x48, 128x128)

**Next:** Phase 1C — AI Analysis Engine (already built in 1A, needs prompt tuning + testing)

---

### 2026-05-20 — Phase 1E Complete

Production hardening deployed to advolt-dev stack.

Backend changes:
- API Gateway rate limiting: 20 req/s sustained, 50 burst per route
- `DYNAMODB_TABLE_USERS`, `STAGE`, `EVENT_BUS_NAME` added to Lambda globals
- Secrets Manager secret created: `advolt/dev/api-keys` (ARN in outputs)
- SES ConfigurationSet created: `advolt-ses-dev`
- 4 CloudWatch alarms: AI queue depth, AI DLQ messages, AI Lambda errors, API 5xx rate
- Shared layer SDK dependency conflict fixed — uses Node 20 runtime SDK, only bundles `uuid`

Frontend changes:
- `middleware.ts` — server-side route protection, redirects unauthenticated users to /login
- `authStore.ts` — sets `id_token` cookie on login so middleware can read it
- `LimitBanner` component — shows warning when ads or AI credits near limit, with upgrade link
- LimitBanner added to dashboard layout (visible on all dashboard pages)

**All 5 phases complete. Stack is live.**

### 2026-05-20 — End-to-end ad saving working

After extensive debugging, the full save flow is working:
- Chrome extension detects Facebook Ad Library ads via TreeWalker on "Sponsored" text
- Custom Lambda authorizer validates Cognito JWT (replaced Cognito authorizer which had scope issues)
- `saveAd` Lambda writes to DynamoDB and fires EventBridge event
- Ad appears in extension popup Recent Saves

Key fixes applied:
- Custom Lambda authorizer (REQUEST type, reads from headers, validates JWKS)
- `host_permissions` in manifest updated to include API Gateway domain
- User DynamoDB record created manually (signup DynamoDB write was failing due to missing IAM policy — now fixed)
- Token expiry checked by decoding JWT directly, not relying on stored `token_expiry`

Next steps before launch:
1. Replace dummy API keys in Secrets Manager with real values
2. Verify SES sender email identity
3. Upload `selectors.json` to selector-config S3 bucket
4. Replace placeholder URLs in Chrome extension with live API/CloudFront URLs
5. Deploy frontend to Amplify
6. Load Chrome extension in developer mode and test end-to-end

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

## AWS Resources (deployed — stack: advolt-dev, region: ap-south-1)

| Resource | Name | Status |
|---|---|---|
| Cognito User Pool | ap-south-1_NVeGCpEng | ✅ Live |
| Cognito Client | 4jav1gv3vd5ehf7cmc11mf6vk1 | ✅ Live |
| DynamoDB Table | advolt-ads-dev | ✅ Live |
| DynamoDB Table | advolt-ai-analysis-dev | ✅ Live |
| DynamoDB Table | advolt-users-dev | ✅ Live |
| S3 Bucket | advolt-media-971598352248-dev | ✅ Live |
| S3 Bucket | advolt-selector-config-971598352248-dev | ✅ Live |
| CloudFront Distribution | https://d37anhmjei4vts.cloudfront.net | ✅ Live |
| SQS Queue | advolt-ai-queue-dev | ✅ Live |
| SQS DLQ | advolt-ai-dlq-dev | ✅ Live |
| EventBridge Bus | advolt-events-dev | ✅ Live |
| API Gateway | https://flm6m6u5yc.execute-api.ap-south-1.amazonaws.com/dev | ✅ Live |
| SES Identity | (sender email) | 🔲 |
| Amplify App | advolt-frontend | ❌ Replaced by Vercel |
| Vercel Frontend | https://ad-sage-i4cs.vercel.app | ✅ Live |
---

## Live Endpoints (dev)

| Key | Value |
|---|---|
| API URL | https://flm6m6u5yc.execute-api.ap-south-1.amazonaws.com/dev |
| CloudFront URL | https://d37anhmjei4vts.cloudfront.net |
| Cognito User Pool ID | ap-south-1_NVeGCpEng |
| Cognito Client ID | 4jav1gv3vd5ehf7cmc11mf6vk1 |
| Media S3 Bucket | advolt-media-971598352248-dev |
| AI Queue URL | https://sqs.ap-south-1.amazonaws.com/971598352248/advolt-ai-queue-dev |

---

## Environment Variables Needed

```
OPENAI_API_KEY=<replace with real key>
CLAUDE_API_KEY=<replace with real key>
COGNITO_USER_POOL_ID=ap-south-1_NVeGCpEng
COGNITO_CLIENT_ID=4jav1gv3vd5ehf7cmc11mf6vk1
ADS_BUCKET=advolt-media-971598352248-dev
CLOUDFRONT_URL=https://d37anhmjei4vts.cloudfront.net
DYNAMODB_TABLE_ADS=advolt-ads-dev
DYNAMODB_TABLE_AI=advolt-ai-analysis-dev
RAZORPAY_KEY=<replace with real key>
RAZORPAY_SECRET=<replace with real key>
RAZORPAY_WEBHOOK_SECRET=<replace with real key>
SELECTOR_CONFIG_URL=https://d37anhmjei4vts.cloudfront.net/config/selectors.json
```

---

## Reference Docs

- [Phase 1 Architecture](./phase_1_architecture.md)
