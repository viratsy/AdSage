/**
 * Generate Asset — Platform-specific AI generation within a project.
 * POST /projects/{id}/generate
 * 
 * Body: { tool: string, input?: Record<string, string> }
 * 
 * Foundation: audience, pain_points, desires, objections, emotional_angles
 * Meta: meta_hooks, meta_primary_text, meta_headlines, meta_ctas, meta_creatives
 * Google: google_keywords, google_headlines, google_descriptions, google_extensions, google_ctas, google_landing_match
 * Targeting: audience_meta, audience_google
 */
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const TABLE = process.env.DYNAMODB_TABLE_PROJECTS;

const callGroq = async (prompt, maxTokens = 2000, model = 'llama-3.1-8b-instant') => {
  const key = process.env.GROQ_API_KEY;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are an expert ad strategist and copywriter. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error: ${response.status} — ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
};

const callGeminiVision = async (imageBase64, mimeType, prompt) => {
  const key = process.env.GEMINI_API_KEY;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: 'application/json' }
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error: ${response.status} — ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
};

const PREMIUM_TOOLS = ['audience', 'audience_meta', 'audience_google', 'meta_primary_text', 'meta_hooks', 'meta_creatives', 'meta_campaign', 'google_campaign', 'google_keywords', 'google_descriptions', 'google_landing_match'];

const DEPENDENCIES = {
  audience: [],
  audience_meta: ['audience'],
  audience_google: ['audience'],
  pain_points: ['audience'],
  desires: ['audience'],
  objections: ['audience', 'pain_points'],
  emotional_angles: ['audience', 'pain_points', 'desires'],
  // Campaign concepts
  meta_campaign: ['audience', 'pain_points', 'emotional_angles'],
  google_campaign: ['audience', 'pain_points'],
  // Meta individual tools
  meta_hooks: ['audience', 'pain_points', 'emotional_angles'],
  meta_primary_text: ['audience', 'pain_points', 'emotional_angles'],
  meta_headlines: ['audience', 'emotional_angles'],
  meta_ctas: ['audience', 'desires'],
  meta_creatives: ['audience', 'emotional_angles'],
  // Google tools
  google_keywords: ['audience', 'pain_points'],
  google_headlines: ['audience', 'pain_points'],
  google_descriptions: ['audience', 'pain_points', 'desires'],
  google_extensions: ['audience', 'desires'],
  google_ctas: ['audience', 'desires'],
  google_landing_match: ['audience', 'pain_points', 'desires'],
};

const FOUNDATION_TOOLS = ['audience', 'pain_points', 'desires', 'objections', 'emotional_angles'];

const buildContext = (project) => {
  const parts = [];
  parts.push(`Business: ${project.business_name}`);
  parts.push(`Niche: ${project.business_niche}`);
  parts.push(`Product: ${project.product_name}`);
  parts.push(`Description: ${project.product_description || 'Not provided'}`);
  parts.push(`USP: ${project.usp || 'Not provided'}`);
  if (project.target_location) parts.push(`Target Location: ${project.target_location}`);
  if (project.target_audience_hint) parts.push(`Ideal Customer Hint: ${project.target_audience_hint}`);
  const intel = project.intelligence || {};
  if (intel.audience) parts.push(`Target Audience: ${JSON.stringify(intel.audience)}`);
  if (intel.pain_points?.length) parts.push(`Pain Points: ${intel.pain_points.join(', ')}`);
  if (intel.desires?.length) parts.push(`Desires: ${intel.desires.join(', ')}`);
  if (intel.objections?.length) parts.push(`Objections: ${intel.objections.join(', ')}`);
  if (intel.emotional_angles?.length) {
    parts.push(`Emotional Angles with example hooks:\n${intel.emotional_angles
      .map(a => `- [${a.emotion}] ${a.angle} → Hook example: "${a.example_hook || ''}"`)
      .join('\n')}`);
  }
  return parts.join('\n');
};

const PROMPTS = {
  // ── FOUNDATION ──
  audience: (ctx, input) => `
${ctx}
${input?.description ? `User says their ideal customer is: ${input.description}` : ''}
${input?.custom ? `Additional notes: ${input.custom}` : ''}

Generate 3 detailed and distinct target audience personas for this business.
Return JSON: { "options": [{ 
  "label": "A memorable persona name",
  "demographics": "Age range, gender split, location type, income bracket, education level, job title/role",
  "psychographics": "Values, beliefs, lifestyle choices, media consumption habits, brands they follow",
  "situation": "What's happening in their life/business RIGHT NOW that makes them need this product",
  "goals": "What they're trying to achieve in the next 3-6 months",
  "objections": "Top 2 reasons this persona might hesitate to buy",
  "buying_triggers": "What specific event would make them take action TODAY",
  "awareness_level": "unaware/problem-aware/solution-aware/product-aware with explanation"
}] }`,

  pain_points: (ctx, input) => `
${ctx}
${input?.custom ? `User added: ${input.custom}` : ''}
Generate 8-10 specific pain points this audience faces that the product solves. Be specific, not generic.
Return JSON: { "options": ["pain point 1", "pain point 2", ...] }`,

  desires: (ctx, input) => `
${ctx}
${input?.custom ? `User added: ${input.custom}` : ''}
Generate 6-8 specific desires/goals this audience has that relate to the product.
Return JSON: { "options": ["desire 1", "desire 2", ...] }`,

  objections: (ctx, input) => `
${ctx}
${input?.custom ? `User added: ${input.custom}` : ''}
Generate 6-8 common objections or reasons someone might NOT buy this product.
Return JSON: { "options": ["objection 1", "objection 2", ...] }`,

  emotional_angles: (ctx, input) => `
${ctx}
${input?.custom ? `User added: ${input.custom}` : ''}
Generate 5-6 emotional angles for ads. Focus on: curiosity, emotional storytelling, aspiration, pain amplification, transformation, social proof.
Return JSON: { "options": [{ "emotion": "type", "angle": "specific angle description", "example_hook": "one example hook" }] }`,

  // ── TARGETING ──
  audience_meta: (ctx, input) => `
${ctx}
${input?.custom ? `Additional notes: ${input.custom}` : ''}
Generate Meta (Facebook/Instagram) ad targeting suggestions. Be specific and actionable.
Return JSON: { "items": [{ "interests": ["15 interests"], "behaviors": ["8 behaviors"], "demographics_targeting": "Age, gender, locations", "custom_audience_ideas": ["3 ideas"], "lookalike_suggestions": ["3 suggestions"], "exclusions": ["3 exclusions"], "budget_recommendation": "daily budget and bidding strategy" }] }`,

  audience_google: (ctx, input) => `
${ctx}
${input?.custom ? `Additional notes: ${input.custom}` : ''}
Generate Google Ads targeting suggestions. Be specific and actionable.
Return JSON: { "items": [{ "search_keywords": ["20 keywords"], "negative_keywords": ["8 negatives"], "in_market_audiences": ["7 segments"], "affinity_audiences": ["7 segments"], "demographics_targeting": "Age, gender, income", "device_targeting": "device strategy", "ad_schedule": "recommended schedule" }] }`,

  // ── CAMPAIGN CONCEPTS ──
  meta_campaign: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}
${input?.tone ? `Tone: ${input.tone}` : ''}
${input?.angle ? `Focus on this emotional angle: ${input.angle}` : ''}
${input?.avoid ? `DO NOT use these angles or approaches (already tested): ${input.avoid}` : ''}

Generate 3 COMPLETE Meta ad campaign concepts. Each campaign is a full, ready-to-launch ad concept.

STEP 1 — CLASSIFY THE NICHE (do this silently before writing any copy):
- Is this fashion/streetwear/lifestyle/DTC physical product? → Style: Brand voice, slang, identity language, drop culture
- Is this SaaS/B2B/software/agency? → Style: Outcomes, metrics, ROI, founder tone
- Is this education/coaching/info product? → Style: Transformation, before/after, mentor voice
- Is this local service/offline business? → Style: Trust, proximity, community language
- Is this e-commerce/marketplace/product? → Style: Sensory, specific features, lifestyle imagery

Once classified, apply that style to EVERY element: hook, copy, headline, CTA, creative direction.

Each campaign MUST use a DIFFERENT emotional angle and creative approach.

WRITE LIKE THIS (match your niche):
- Fashion: "Your wardrobe called. It's bored." / CTA: "Cop the Drop"
- SaaS: "₹10L wasted on ads last month?" / CTA: "Fix My Ads"
- Education: "I made ₹50L after this one course." / CTA: "See the Curriculum"
- Service: "3 of your neighbours switched last month." / CTA: "Get My Quote"
- E-commerce: "This sold out in 4 hours last time." / CTA: "Grab Yours"

RULES:
- Hook: Max 10 words. Scroll-stopping. SPECIFIC to this product.
- Primary text: 50-80 words. Use \\n for line breaks every 1-2 sentences. Conversational.
- Headline: Max 40 characters. BEFORE returning, count characters — rewrite if over 40.
- CTA: 2-4 words. Creative and specific to the niche.
- Creative direction: Specific enough that a designer could execute it.
- Video flow: 5 concrete steps with specific actions, not vague descriptions.

Return JSON: { "items": [
  {
    "campaign_name": "A memorable 2-3 word campaign name",
    "emotional_angle": "which angle this uses",
    "hook": "scroll-stopping first line (max 10 words)",
    "primary_text": "full ad copy with \\n line breaks (50-80 words)",
    "headline": "below-creative headline (max 40 chars)",
    "cta": "creative call to action (2-4 words, niche-specific)",
    "creative_style": "UGC/Static/Carousel/Reel/Meme",
    "visual_direction": "specific visual concept a designer could execute",
    "thumbnail_text": "max 6 words for image overlay",
    "video_flow": ["step 1", "step 2", "step 3", "step 4", "step 5"],
    "why_it_works": "1 sentence on why this campaign will perform"
  }
] }`,

  google_campaign: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}
${input?.tone ? `Tone: ${input.tone}` : ''}
${input?.avoid ? `DO NOT use these angles or approaches (already tested): ${input.avoid}` : ''}

Generate 3 COMPLETE Google Search ad campaign concepts. Each is a full responsive search ad setup.

RULES:
- Headlines: Max 30 characters each. BEFORE returning, count characters — rewrite if over 30.
- Descriptions: Max 90 characters each. Count and verify.
- Each campaign targets a different search intent (transactional, commercial, informational).

INTENT MATCHING (critical):
- Transactional ("buy", "order", "near me", "price"): Lead with price/availability/action. CTA = direct purchase.
- Commercial ("best", "vs", "review", "top"): Lead with differentiator/proof/comparison. CTA = evaluation.
- Informational ("how to", "what is", "guide"): Lead with education hook → soft conversion. CTA = learn/discover.

Focus on: clarity, specificity, search intent, trust signals. NOT emotional storytelling.

Return JSON: { "items": [
  {
    "campaign_name": "descriptive campaign name",
    "search_intent": "transactional/commercial/informational",
    "target_keywords": ["5 keywords this ad targets"],
    "headlines": ["headline 1 (max 30 chars)", "headline 2", "headline 3"],
    "descriptions": ["description 1 (max 90 chars)", "description 2"],
    "negative_keywords": ["3 negatives"],
    "cta": "landing page CTA suggestion",
    "landing_page_headline": "suggested landing page H1",
    "sitelinks": ["sitelink 1", "sitelink 2", "sitelink 3"],
    "why_it_works": "1 sentence on why this will convert"
  }
] }`,

  // ── META ADS (individual tools kept for granular generation) ──
  meta_hooks: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 10 Meta ad hooks. A hook is the FIRST LINE someone sees — it must stop the scroll in under 2 seconds.

RULES:
- Max 8-12 words each. Shorter = better.
- NEVER start with "Are you tired of...", "Ever felt like...", "What if I told you...", "Ready to...", "Imagine...", "Introducing..."
- NEVER use generic phrases. Be SPECIFIC to this product/niche.
- Each hook must use a DIFFERENT angle from this list: pattern interrupt, bold claim, specific number/stat, controversial opinion, identity call-out, fear of missing out, social proof, before/after contrast, direct challenge, unexpected comparison.
- Write like a DTC brand copywriter, not a corporate marketer.
- Think: what would make someone STOP scrolling and read more?

GOOD EXAMPLES (for reference style, not to copy):
- "Your ads are bleeding money. Here's proof."
- "3 words that doubled our ROAS overnight."
- "Nobody talks about this Meta Ads hack."
- "I spent ₹50L on ads so you don't have to."

Return JSON: { "items": ["hook 1", "hook 2", ...] }`,

  meta_primary_text: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}
${input?.hook ? `Use this hook as the opener: ${input.hook}` : ''}

Write 3 Meta ad primary text variations. Each MUST use a DIFFERENT emotional angle.

FORMAT (use line breaks exactly like this):
Line 1: Hook (scroll-stopper, max 10 words)
Line 2: [empty line]
Line 3-4: Agitate the problem (2 short sentences, be specific)
Line 5: [empty line]
Line 6-7: Introduce solution (what it does, not what it is)
Line 8: [empty line]
Line 9: Key benefit (specific outcome, use numbers if possible)
Line 10: [empty line]
Line 11: CTA (clear, direct, one sentence)

RULES:
- MAX 80 words total per variation. Mobile users don't read walls of text.
- Use line breaks between every 1-2 sentences.
- Write like texting a friend, not writing an essay.
- NO clichés: "game-changer", "revolutionary", "unlock your potential", "take it to the next level"
- Be SPECIFIC: mention the product, the outcome, the audience's situation.
- Each variation must target a different angle: (1) Pain/frustration (2) Aspiration/transformation (3) Social proof/FOMO
- Use \\n for line breaks in the text.

Return JSON: { "items": [{ "hook": "opening hook line", "body": "full primary text with \\n line breaks", "cta": "call to action line", "angle": "which emotional angle this uses" }] }`,

  meta_headlines: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 10 Meta ad headlines (appears below the creative image/video).
STRICT: Max 40 characters each. Count carefully.

CRITICAL RULES:
- Match the TONE of the industry. Fashion = cool/vibe/aesthetic. SaaS = benefit/outcome. Education = transformation/career.
- For fashion/lifestyle/DTC: Use slang, aesthetic language, drop culture, identity. NO "7 days", "2x more", "3 easy steps" — that's for SaaS.
- For SaaS/B2B: Use numbers, outcomes, ROI. NO vague vibes.
- NEVER use: "Unlock", "Discover", "Transform your X in Y days" for physical products.
- Each headline must work STANDALONE — someone should want to click from the headline alone.
- Be specific to the ACTUAL product. Mention it or its key attribute.

MIX REQUIRED:
- 3 that create desire/FOMO ("You'll get compliments", "Selling fast")
- 2 that are identity-based ("For the ones who...", "Not for everyone")
- 2 that highlight the product specifically (name, feature, design)
- 2 that use urgency/scarcity ("Limited drop", "Last 50")
- 1 that's a bold/fun statement

Return JSON: { "items": ["headline 1", "headline 2", ...] }`,

  meta_ctas: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 8 Meta ad CTA variations.

RULES:
- Button CTAs: 2-4 words max (e.g., "Shop Now", "Get Yours", "See How")
- Text CTAs: 1 short sentence that creates urgency or curiosity
- NEVER use: "Click here", "Learn more" (too generic)
- Mix: 3 urgency-based, 2 benefit-based, 2 curiosity-based, 1 scarcity-based
- Each should feel like a natural next step, not a demand

Return JSON: { "items": ["cta 1", "cta 2", ...] }`,

  meta_creatives: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 3 Meta ad creative/image concepts optimized for scroll-stopping in a feed.

Each concept must include:
- Visual style (photorealistic, flat illustration, UGC-style, meme format, comparison, before/after)
- Exact text overlay (max 6 words on image — this is critical for Meta)
- Color strategy (contrast with typical feed content — blue/white feeds need warm/bold colors)
- Format recommendation with reasoning
- The "thumb-stop" element (what makes someone pause)

RULES:
- Concept 1: Product-focused (show the product in use/context)
- Concept 2: UGC/testimonial style (feels native, not like an ad)
- Concept 3: Bold/disruptive (pattern interrupt, unusual visual)
- Text on image must be readable at mobile size (large, high contrast)
- Think about what stands out in a feed of selfies, food, and memes

Return JSON: { "items": [{ "concept": "concept name", "visual": "detailed visual description", "text_overlay": "max 6 words on image", "format": "static/carousel/video/story", "thumb_stop": "what makes someone pause", "mood": "visual mood" }] }`,

  // ── GOOGLE ADS ──
  google_keywords: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate keyword research for Google Search Ads.
Focus on: clarity, specificity, search intent, buyer keywords.
Group by intent: informational, commercial, transactional.

Return JSON: { "items": [{ "transactional": ["10 high-intent buying keywords"], "commercial": ["10 comparison/research keywords"], "informational": ["10 awareness keywords"], "negative_keywords": ["8 keywords to exclude"], "long_tail": ["8 long-tail opportunities"] }] }`,

  google_headlines: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 15 Google Search Ad headlines. STRICT: Max 30 characters each.
Focus on: clarity, specificity, benefits, ROI, trust, comparisons. NOT emotional storytelling.
Include: benefit headlines, feature headlines, urgency headlines, trust headlines, action headlines.
Each must be under 30 characters.

Return JSON: { "items": ["headline 1", "headline 2", ...] }`,

  google_descriptions: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 6 Google Search Ad descriptions. STRICT: Max 90 characters each.
Focus on: clarity, benefits, ROI, trust signals, specific outcomes. NOT emotional.
Each should complement headlines and include a soft CTA.

Return JSON: { "items": ["description 1", "description 2", ...] }`,

  google_extensions: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate Google Ad extensions content:
- 4 sitelink extensions (title + description)
- 6 callout extensions (short benefit phrases, max 25 chars)
- 4 structured snippets (header + values)

Return JSON: { "items": [{ "sitelinks": [{"title": "", "description": ""}], "callouts": [""], "structured_snippets": [{"header": "", "values": [""]}] }] }`,

  google_ctas: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 8 Google Ad CTA variations. Direct, clear, action-oriented.
Focus on: specificity, benefit, urgency. NOT emotional.
Examples of good Google CTAs: "Get Free Quote", "Start 14-Day Trial", "See Pricing".

Return JSON: { "items": ["cta 1", "cta 2", ...] }`,

  google_landing_match: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate landing page optimization suggestions to match Google Ad messaging.
Include: headline suggestions, above-fold content, trust signals, CTA placement, message match tips.

Return JSON: { "items": [{ "headline_suggestions": ["3 landing page headlines"], "above_fold": "what should be visible without scrolling", "trust_signals": ["4 trust elements to include"], "cta_suggestions": ["3 landing page CTAs"], "message_match_tips": ["4 tips to match ad to landing page"] }] }`,
};

exports.handler = async (event) => {
  try {
    const user = getUserFromEvent(event);
    if (!user) return res.unauthorized();

    const projectId = event.pathParameters?.id;
    if (!projectId) return res.badRequest('Project ID is required');

    const body = JSON.parse(event.body || '{}');
    const { tool, input } = body;

    if (!tool || !PROMPTS[tool]) {
      return res.badRequest(`Invalid tool. Available: ${Object.keys(PROMPTS).join(', ')}`);
    }

    const result = await ddb.send(new GetCommand({ TableName: TABLE, Key: { project_id: projectId } }));
    if (!result.Item) return res.notFound('Project not found');
    if (result.Item.user_id !== user.user_id) return res.forbidden();

    const project = result.Item;
    const intelligence = project.intelligence || {};

    // Check dependencies
    const deps = DEPENDENCIES[tool] || [];
    const missing = deps.filter(dep => {
      if (dep === 'audience') return !intelligence.audience;
      return !intelligence[dep] || intelligence[dep].length === 0;
    });

    if (missing.length > 0) {
      return res.ok({ status: 'missing_dependencies', missing, message: `To generate ${tool}, we first need: ${missing.join(', ')}` });
    }

    // Generate
    let aiResult;

    if (tool === 'meta_creatives' && input?.image_base64) {
      const mimeType = input.image_mime || 'image/jpeg';
      const visionPrompt = `Analyze this reference image and generate 3 similar-style ad creative concepts for:
Business: ${project.business_name}, Product: ${project.product_name}
${input?.instruction ? `Instruction: ${input.instruction}` : ''}
Return JSON: { "style_analysis": "brief style description", "items": [{ "concept": "name", "visual": "detailed description", "text_overlay": "text suggestion", "format": "format type", "mood": "mood" }] }`;
      aiResult = await callGeminiVision(input.image_base64, mimeType, visionPrompt);
    } else {
      const ctx = buildContext(project);
      const prompt = PROMPTS[tool](ctx, input);
      const model = PREMIUM_TOOLS.includes(tool) ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
      const tokens = (tool === 'meta_campaign' || tool === 'google_campaign') ? 3000 : 2000;
      aiResult = await callGroq(prompt, tokens, model);
    }

    // Save result
    if (FOUNDATION_TOOLS.includes(tool)) {
      const value = aiResult.options || aiResult;
      const currentIntel = project.intelligence || {};
      currentIntel[tool] = value;
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { project_id: projectId },
        UpdateExpression: 'SET intelligence = :intel, updated_at = :now',
        ExpressionAttributeValues: { ':intel': currentIntel, ':now': new Date().toISOString() },
      }));
      return res.ok({ status: 'options', tool, options: value });
    } else {
      const items = aiResult.items || [aiResult];
      const timestamp = new Date().toISOString();
      const asset = { id: `${tool}_${Date.now()}`, tool, items, input: input || {}, created_at: timestamp };
      const currentAssets = project.assets || [];
      currentAssets.push(asset);
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { project_id: projectId },
        UpdateExpression: 'SET assets = :assets, updated_at = :now',
        ExpressionAttributeValues: { ':assets': currentAssets, ':now': timestamp },
      }));
      return res.ok({ status: 'generated', tool, asset });
    }
  } catch (err) {
    console.error('generateAsset error:', err);
    return res.serverError(err.message);
  }
};
