# Advolt.ai — Build Progress

## Project Info

- Product: Advolt.ai (AI Ad Intelligence SaaS)
- AWS Account: 971598352248
- AWS Profile: voltai
- Region: ap-south-1
- GitHub: github.com/viratsy/AdSage (private)
- Frontend: https://ad-sage-i4cs.vercel.app
- API: https://flm6m6u5yc.execute-api.ap-south-1.amazonaws.com/dev

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, TypeScript |
| Hosting | Vercel |
| Backend | AWS SAM, Lambda (Node.js 20), API Gateway |
| Database | DynamoDB (3 tables: ads, ai-analysis, users) |
| Storage | S3 + CloudFront |
| Auth | Cognito + Custom Lambda Authorizer (JWT) |
| Async | EventBridge + SQS |
| AI | Groq (Llama 3.1 8B) — free tier, 14,400 req/day |
| Payments | Razorpay (configured, dummy keys) |
| Email | SES (configured) |
| Extension | Chrome MV3, plain JS |

---

## What's Working (as of 2026-05-21)

- Chrome extension detects and saves ads from Facebook Ad Library
- Full ad data extraction (primary text, headline, CTA, landing page, images)
- Custom Lambda authorizer validates Cognito JWT tokens
- Ad saving with plan limits enforced server-side
- AI analysis via Groq (hook type, emotion, audience, funnel, score, hooks, CTAs)
- Modular AI generation — each section (hooks, CTAs, copy, image prompt) is on-demand
- User instructions for regeneration (e.g. "more urgency", "use blue tones")
- Token system (monthly 5000 + purchased never-expire)
- Token refund on AI failure
- Business persona onboarding with AI generation
- Profile page with persona management (view, edit, redo)
- Token balance display with buy packs UI
- Notes per ad
- "Generate Similar Ad" button
- Polling for processing status (auto-refresh)
- Failed analysis shows retry button with refund message

---

## Token System

| Operation | Tokens |
|---|---|
| Initial Analysis (classification + 5 hooks + 5 CTAs) | 20 |
| Generate 5 More Hooks | 20 |
| Generate 5 More CTAs | 20 |
| Short Ad Copy | 30 |
| Long Ad Copy | 50 |
| Image Prompt | 20 |

Plans:
- Free: 5 ads, 1 lifetime analysis
- Pro: Unlimited ads, 5000 monthly tokens (expire 30 days), purchased tokens never expire

Token Packs: 1000/₹99, 5000/₹399, 15000/₹999

---

## AWS Resources (Live)

| Resource | Value |
|---|---|
| API Gateway | https://flm6m6u5yc.execute-api.ap-south-1.amazonaws.com/dev |
| Cognito User Pool | ap-south-1_NVeGCpEng |
| Cognito Client ID | 4jav1gv3vd5ehf7cmc11mf6vk1 |
| CloudFront | https://d37anhmjei4vts.cloudfront.net |
| Media Bucket | advolt-media-971598352248-dev |
| AI Queue | advolt-ai-queue-dev |
| Secrets | advolt/dev/api-keys |

---

## Lambda Functions (17 total)

Auth: authorizer, signup, login, refresh, updateProfile, generatePersona
Ads: saveAd, getAds, getAdDetails, deleteAd, updateAd
AI: triggerAnalysis, processAnalysis, getResult, estimateTokens, generate
Billing: createOrder, webhook, getStatus
Media: optimizeImage

---

## Key Decisions

| Decision | Reason |
|---|---|
| Vercel over Amplify | Amplify Gen 1 doesn't support Next.js App Router SSR |
| Custom Lambda authorizer over Cognito authorizer | Cognito authorizer was rejecting valid tokens |
| Groq over Gemini/OpenAI | Free tier (14,400 req/day), no billing required |
| Modular generation over all-at-once | Users only pay for what they use |
| Token system over fixed credits | Flexible, supports multiple operation types |
| Business persona in prompts | Personalized content generation |

---

## Known Issues / TODO

- Vercel deployment limit hit (resets in 24h) — onboarding page fix pending deploy
- samconfig.toml keeps getting staged — .gitignore pattern added but needs vigilance
- Selector config S3 bucket needs public read policy
- Razorpay using dummy keys — needs real keys for payments
- SES sender email not verified yet
- No monthly token reset automation (needs scheduled Lambda)
- Ad Library DOM selectors may break when Facebook updates

---

## Next Features (Priority Order)

1. AI Create Studio (Ad Brief, Ad Copy Generator, Hook Generator, Ad Rewriter)
2. Folder/Collection organization for saved ads
3. Better Ad Library grid (filters by hook type, score, favorites)
4. Image generation (Flux/DALL-E integration using image prompts)
5. Google OAuth for Gemini (users connect their own quota)
6. Monthly token reset automation (EventBridge scheduled rule)
7. Campaign setup generator
8. CTR estimation
