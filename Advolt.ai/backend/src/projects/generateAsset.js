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

const PREMIUM_TOOLS = ['audience', 'audience_meta', 'audience_google', 'meta_primary_text', 'meta_creatives', 'google_keywords', 'google_descriptions', 'google_landing_match'];

const DEPENDENCIES = {
  audience: [],
  audience_meta: ['audience'],
  audience_google: ['audience'],
  pain_points: ['audience'],
  desires: ['audience'],
  objections: ['audience', 'pain_points'],
  emotional_angles: ['audience', 'pain_points', 'desires'],
  // Meta tools
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
  if (intel.emotional_angles?.length) parts.push(`Emotional Angles: ${JSON.stringify(intel.emotional_angles)}`);
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

  // ── META ADS ──
  meta_hooks: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 10 Meta ad hooks (first line that stops the scroll). 
Focus on these BEST PERFORMING angles for Meta: curiosity, emotional storytelling, aspiration, pain amplification, transformation.
Each hook should be 1 sentence, punchy, scroll-stopping.
Mix types: question, bold statement, story opener, pain call-out, transformation tease.

Return JSON: { "items": ["hook 1", "hook 2", ...] }`,

  meta_primary_text: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}
${input?.hook ? `Use this hook as the opener: ${input.hook}` : ''}

Write 3 Meta ad primary text variations (the main body copy under the creative).
Each should follow this structure: Hook → Pain/Problem → Solution → Benefits → Social proof hint → CTA
Tone: Conversational, emotional, story-driven. NOT corporate.
Length: 100-200 words each.
Focus angles: emotional storytelling, aspiration, pain amplification, transformation.

Return JSON: { "items": [{ "hook": "opening hook", "body": "full primary text", "cta": "call to action line" }] }`,

  meta_headlines: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 10 Meta ad headlines (appears below the creative image/video).
Max 40 characters each. Punchy, benefit-driven, curiosity-inducing.
Mix: benefit statements, questions, urgency, social proof, transformation.

Return JSON: { "items": ["headline 1", "headline 2", ...] }`,

  meta_ctas: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 8 Meta ad CTA variations. These appear as the button text or final line.
Mix styles: urgency, benefit-driven, curiosity, direct action, soft ask.
Keep them short (2-5 words for buttons, 1 sentence for text CTAs).

Return JSON: { "items": ["cta 1", "cta 2", ...] }`,

  meta_creatives: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 3 Meta ad creative/image concepts. Each should be a detailed description of what the ad visual should look like.
Include: visual style, subject, text overlay suggestions, color mood, format (static/carousel/video).
Focus on scroll-stopping visuals that complement emotional/aspirational copy.

Return JSON: { "items": [{ "concept": "concept name", "visual": "detailed visual description", "text_overlay": "suggested text on image", "format": "static/carousel/video/story", "mood": "visual mood" }] }`,

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
      aiResult = await callGroq(prompt, 2000, model);
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
