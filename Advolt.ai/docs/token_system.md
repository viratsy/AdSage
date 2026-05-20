# Advolt.ai — Token System Design

## Plans

| | Free | Pro |
|---|---|---|
| Ads saved | 5 | Unlimited |
| AI analyses | 1 lifetime (120 tokens one-time) | Token-based |
| Monthly token allocation | — | 5,000 tokens (expires in 30 days) |
| Purchased tokens | — | Never expire, stack on monthly |
| AI provider | Platform Gemini | Platform tokens OR own API key |
| Price | Free | ₹499/month |

---

## Token Costs Per Operation

| Operation | Advolt Tokens | AI Model | Notes |
|---|---|---|---|
| Hook Analysis | 20 | Gemini 1.5 Flash | Hook type, emotion, audience, funnel, CTA strength, AI score |
| Generate Hooks | 40 | Gemini 1.5 Flash | 10 hook variations |
| Generate CTAs | 20 | Gemini 1.5 Flash | 5 CTA variations |
| Short Copy | 30 | Gemini 1.5 Flash | Under 50 words |
| Long Copy | 50 | Gemini 1.5 Flash | 100-150 words |
| Full Analysis | 120 | Gemini 1.5 Flash | All above bundled (saves 40 tokens vs individual) |

---

## Token Packs (Purchased — Never Expire)

| Pack | Tokens | Price | Cost to Us | Profit |
|---|---|---|---|---|
| Starter | 1,000 | ₹99 | ₹3.30 | ₹95.70 |
| Growth | 5,000 | ₹399 | ₹16.50 | ₹382.50 |
| Pro | 15,000 | ₹999 | ₹49.50 | ₹949.50 |

---

## Token Wallet (DynamoDB — users table)

```json
{
  "monthly_tokens": 5000,
  "monthly_tokens_expiry": "ISO timestamp",
  "purchased_tokens": 0,
  "ai_provider": "platform | own_key",
  "own_api_key_encrypted": null
}
```

Deduction order: monthly tokens first (expire), then purchased tokens (never expire).

---

## Pre-Generation UX Flow

Before user clicks Analyze:
1. Show operation menu with token cost for each option
2. Show user's current balance (monthly + purchased breakdown)
3. If insufficient tokens → show "Buy tokens" options inline
4. If own_key user → skip token check entirely

---

## AI Cost Breakdown (Internal Reference)

Using Gemini 1.5 Flash:
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- Full analysis actual cost: ~$0.0004 (~₹0.033)
- Markup: ~300x on actual cost
- Buffer: priced as if model costs 3x current rate

---

## Implementation Phases

1. Update DynamoDB users table schema (add token fields)
2. Update triggerAnalysis Lambda — operation-based token deduction
3. Add estimateTokens Lambda — returns cost estimate before generation
4. Update Gemini as AI provider (replace OpenAI dummy)
5. Update dashboard UI — token balance display, operation picker, buy tokens modal
6. Update billing — token pack purchases via Razorpay
