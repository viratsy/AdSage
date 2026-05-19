/**
 * Centralized, versioned prompt definitions.
 * Version: v1
 */

const PROMPT_VERSION = 'v1';

exports.buildAnalysisPrompt = (ad) => {
  return `You are an expert performance marketing analyst. Analyze the following Meta ad and return a JSON object.

Ad Details:
- Advertiser: ${ad.advertiser_name}
- Primary Text: ${ad.primary_text || 'N/A'}
- Headline: ${ad.headline || 'N/A'}
- CTA: ${ad.cta || 'N/A'}
- Landing Page: ${ad.landing_page || 'N/A'}
- Platform: ${ad.platform}

Return ONLY a valid JSON object with this exact schema:
{
  "hook_type": "one of: curiosity | fear | urgency | authority | transformation | social_proof",
  "emotional_trigger": "one of: pain_point | aspiration | fear | greed | status | trust",
  "audience_type": "one of: beginner | advanced | business_owner | creator | job_seeker | student",
  "funnel_stage": "one of: lead_generation | webinar | workshop | ecommerce | coaching | saas",
  "cta_strength": "one of: low | medium | high",
  "ai_score": <number 0-100>,
  "score_breakdown": {
    "hook_quality": <number 0-25>,
    "cta_strength": <number 0-25>,
    "clarity": <number 0-25>,
    "urgency": <number 0-25>
  },
  "generated_hooks": [<10 hook string variations>],
  "generated_ctas": [<5 CTA string variations>],
  "short_copy": "<short ad copy variation under 50 words>",
  "long_copy": "<long ad copy variation 100-150 words>",
  "prompt_version": "${PROMPT_VERSION}"
}`;
};

exports.parseAiResponse = (raw) => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Validate required fields
    const required = ['hook_type', 'emotional_trigger', 'audience_type', 'funnel_stage', 'ai_score'];
    for (const field of required) {
      if (!(field in parsed)) throw new Error(`Missing field: ${field}`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${err.message}`);
  }
};
