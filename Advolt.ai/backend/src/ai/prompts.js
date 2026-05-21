/**
 * Advolt.ai — Centralized Prompt Definitions
 * Version: v2 (business-context aware)
 */

const PROMPT_VERSION = 'v2';

/**
 * Build the main analysis prompt.
 * @param {object} ad - ad record from DynamoDB
 * @param {object|null} businessProfile - user's business profile
 */
exports.buildAnalysisPrompt = (ad, businessProfile = null, businessPersona = null) => {
  const businessContext = businessPersona
    ? `
USER'S BUSINESS PERSONA (adapt all generated content for this business):
${businessPersona}

IMPORTANT: Generate all hooks, CTAs, and copy variations specifically for the user's business above. Use their business name where appropriate.
Do NOT generate content for the advertiser's business. Use the ad only as inspiration for structure and psychology.
`
    : businessProfile
    ? `
USER'S BUSINESS CONTEXT (adapt all generated content for this business):
- Business/Niche: ${businessProfile.niche || 'Not specified'}
- Target Customer: ${businessProfile.target_customer || 'Not specified'}
- Main Product/Service: ${businessProfile.product_service || 'Not specified'}
- Customer Pain Point: ${businessProfile.pain_point || 'Not specified'}
- Price Range: ${businessProfile.price_range || 'Not specified'}
- Business Stage: ${businessProfile.business_stage || 'Not specified'}
- Location/Market: ${businessProfile.location || 'Not specified'}

IMPORTANT: Generate all hooks, CTAs, and copy variations specifically for the user's business above.
Do NOT generate content for the advertiser's business. Use the ad only as inspiration for structure and psychology.
`
    : `
No business profile set. Generate generic hooks and CTAs based on the ad content.
`;

  return `You are an expert performance marketing analyst and copywriter.

${businessContext}

SAVED AD TO ANALYZE:
- Advertiser: ${ad.advertiser_name || 'Unknown'}
- Ad Content: ${ad.video_transcript || ad.primary_text || 'N/A'}
- Headline: ${ad.headline || 'N/A'}
- CTA: ${ad.cta || 'N/A'}
- Landing Page: ${ad.landing_page || 'N/A'}
- Platform: ${ad.platform || 'facebook'}
- Content Source: ${ad.video_transcript ? 'Video transcript' : 'Text ad'}

TASK: Analyze the psychological structure of this ad, then generate content adapted for the user's business.

Return ONLY a valid JSON object with this exact schema:
{
  "hook_type": "one of: curiosity | fear | urgency | authority | transformation | social_proof",
  "emotional_trigger": "one of: pain_point | aspiration | fear | greed | status | trust",
  "audience_type": "one of: beginner | advanced | business_owner | creator | job_seeker | student | professional | parent | other",
  "funnel_stage": "one of: lead_generation | webinar | workshop | ecommerce | coaching | saas | local_business | other",
  "cta_strength": "one of: low | medium | high",
  "ai_score": <number 0-100>,
  "score_breakdown": {
    "hook_quality": <number 0-25>,
    "cta_strength": <number 0-25>,
    "clarity": <number 0-25>,
    "urgency": <number 0-25>
  },
  "ad_analysis": "<2-3 sentence analysis of why this ad works psychologically>",
  "generated_hooks": [<5 hook variations adapted for user's business>],
  "generated_ctas": [<5 CTA variations adapted for user's business>],
  "prompt_version": "${PROMPT_VERSION}"
}`;
};

exports.parseAiResponse = (raw) => {
  try {
    // Strip markdown code blocks if present
    let cleaned = raw;
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    const required = ['hook_type', 'emotional_trigger', 'audience_type', 'funnel_stage', 'ai_score'];
    for (const field of required) {
      if (!(field in parsed)) throw new Error(`Missing field: ${field}`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${err.message}`);
  }
};
