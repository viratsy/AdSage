/**
 * Generate Asset — AI generation within a project with dependency checking.
 * POST /projects/{id}/generate
 * 
 * Body: { tool: string, input?: Record<string, string> }
 * 
 * Tools: audience, pain_points, desires, objections, emotional_angles, hooks, short_copy, long_copy, ctas, video_script, image_prompt, ad_brief
 * 
 * Foundation tools (audience, pain_points, desires, objections, emotional_angles) save to project.intelligence
 * Asset tools (hooks, short_copy, etc.) append to project.assets[]
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

// Tools that use the larger model for better quality
const PREMIUM_TOOLS = ['audience', 'audience_meta', 'audience_google', 'audience_linkedin', 'ad_brief', 'long_copy', 'video_script'];

// Dependencies: what each tool needs before it can run
const DEPENDENCIES = {
  audience: [],
  audience_meta: ['audience'],
  audience_google: ['audience'],
  audience_linkedin: ['audience'],
  pain_points: ['audience'],
  desires: ['audience'],
  objections: ['audience', 'pain_points'],
  emotional_angles: ['audience', 'pain_points', 'desires'],
  hooks: ['audience', 'pain_points', 'emotional_angles'],
  short_copy: ['audience', 'pain_points', 'emotional_angles'],
  long_copy: ['audience', 'pain_points', 'emotional_angles'],
  ctas: ['audience', 'desires'],
  video_script: ['audience', 'pain_points', 'emotional_angles'],
  image_prompt: ['audience', 'emotional_angles'],
  ad_brief: ['audience', 'pain_points', 'desires', 'emotional_angles'],
};

const FOUNDATION_TOOLS = ['audience', 'pain_points', 'desires', 'objections', 'emotional_angles'];
const ASSET_TOOLS_WITH_PLATFORM = ['audience_meta', 'audience_google', 'audience_linkedin'];

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
  if (intel.emotional_angles?.length) parts.push(`Emotional Angles: ${intel.emotional_angles.join(', ')}`);
  
  return parts.join('\n');
};

const PROMPTS = {
  audience: (ctx, input) => `
${ctx}
${input?.description ? `User says their ideal customer is: ${input.description}` : ''}
${input?.custom ? `Additional notes: ${input.custom}` : ''}

Generate 3 detailed and distinct target audience personas for this business. Each persona should be specific enough to guide ad targeting and copywriting.

Return JSON: { "options": [{ 
  "label": "A memorable persona name (e.g. The Overwhelmed Founder)",
  "demographics": "Age range, gender split, location type, income bracket, education level, job title/role",
  "psychographics": "Values, beliefs, lifestyle choices, media consumption habits, brands they follow, communities they belong to",
  "situation": "What's happening in their life/business RIGHT NOW that makes them need this product. Be very specific about their current frustration or trigger moment.",
  "goals": "What they're trying to achieve in the next 3-6 months related to this product's domain",
  "objections": "Top 2 reasons this persona might hesitate to buy",
  "buying_triggers": "What specific event or realization would make them take action TODAY",
  "awareness_level": "unaware/problem-aware/solution-aware/product-aware — with brief explanation of what they currently know"
}] }`,

  audience_meta: (ctx, input) => `
${ctx}
${input?.custom ? `Additional notes: ${input.custom}` : ''}

Based on the target audience, generate Meta (Facebook/Instagram) ad targeting suggestions that the user can directly copy-paste into Meta Ads Manager.

Return JSON: {
  "items": [{
    "interests": ["list of 10-15 interests to target"],
    "behaviors": ["list of 5-8 behaviors"],
    "demographics_targeting": "Age range, gender, locations to set",
    "custom_audience_ideas": ["3 custom audience suggestions"],
    "lookalike_suggestions": ["2-3 lookalike audience ideas"],
    "exclusions": ["2-3 audiences to exclude"],
    "budget_recommendation": "Suggested daily budget range and bidding strategy"
  }]
}`,

  audience_google: (ctx, input) => `
${ctx}
${input?.custom ? `Additional notes: ${input.custom}` : ''}

Based on the target audience, generate Google Ads targeting suggestions that the user can directly copy-paste into Google Ads.

Return JSON: {
  "items": [{
    "search_keywords": ["15-20 keywords to target"],
    "negative_keywords": ["5-8 negative keywords"],
    "in_market_audiences": ["5-7 in-market audience segments"],
    "affinity_audiences": ["5-7 affinity audience segments"],
    "demographics_targeting": "Age, gender, household income, parental status",
    "device_targeting": "Recommended device strategy",
    "ad_schedule": "Recommended days/hours to run ads"
  }]
}`,

  audience_linkedin: (ctx, input) => `
${ctx}
${input?.custom ? `Additional notes: ${input.custom}` : ''}

Based on the target audience, generate LinkedIn Ads targeting suggestions that the user can directly copy-paste into LinkedIn Campaign Manager.

Return JSON: {
  "items": [{
    "job_titles": ["10-15 job titles to target"],
    "industries": ["5-8 industries"],
    "company_sizes": ["company size ranges"],
    "seniority_levels": ["relevant seniority levels"],
    "skills": ["8-10 skills to target"],
    "groups": ["3-5 LinkedIn groups to consider"],
    "education": "Degree levels and fields of study",
    "years_experience": "Experience range to target"
  }]
}`,

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

Generate 5-6 emotional angles that could be used in ads for this product. Each angle should include the emotion and how to use it.
Return JSON: { "options": [{ "emotion": "fear/aspiration/urgency/curiosity/social-proof/empathy", "angle": "specific angle description", "example_hook": "one example hook using this angle" }] }`,

  hooks: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}
${input?.angle ? `Focus on this emotional angle: ${input.angle}` : ''}

Generate 10 ad hooks. Mix types: curiosity, pain point, benefit, social proof, urgency, question.
Each hook should be a single attention-grabbing sentence.
Return JSON: { "items": ["hook 1", "hook 2", ...] }`,

  short_copy: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}
${input?.hook ? `Use this hook: ${input.hook}` : ''}

Write 3 short ad copy variations (under 50 words each). Each should have a hook, body, and CTA.
Return JSON: { "items": ["copy 1", "copy 2", "copy 3"] }`,

  long_copy: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}
${input?.hook ? `Use this hook: ${input.hook}` : ''}

Write a full ad copy (150-250 words) with: hook, problem agitation, solution, benefits, social proof hint, CTA.
Return JSON: { "items": ["full copy text"] }`,

  ctas: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 10 CTA variations. Mix styles: urgency, benefit-driven, curiosity, direct, soft.
Return JSON: { "items": ["cta 1", "cta 2", ...] }`,

  video_script: (ctx, input) => `
${ctx}
${input?.duration ? `Duration: ${input.duration} seconds` : 'Duration: 30-60 seconds'}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Write a video ad script with: hook (first 3 seconds), problem, solution, benefits, CTA.
Return JSON: { "items": ["full script text"] }`,

  image_prompt: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Generate 3 AI image generation prompts for ad creatives. Each should describe the visual clearly.
Return JSON: { "items": ["prompt 1", "prompt 2", "prompt 3"] }`,

  ad_brief: (ctx, input) => `
${ctx}
${input?.instruction ? `Additional instruction: ${input.instruction}` : ''}

Create a complete ad campaign brief.
Return JSON: { "items": [{ "objective": "", "key_message": "", "tone": "", "platforms": [], "content_angles": [], "hooks": [], "cta_options": [] }] }`,
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

    // Get project
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
      return res.ok({
        status: 'missing_dependencies',
        missing,
        message: `To generate ${tool}, we first need: ${missing.join(', ')}`,
      });
    }

    // Generate
    const ctx = buildContext(project);
    const prompt = PROMPTS[tool](ctx, input);
    const model = PREMIUM_TOOLS.includes(tool) ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
    const aiResult = await callGroq(prompt, 2000, model);

    // Save result
    if (FOUNDATION_TOOLS.includes(tool)) {
      // Foundation: save to intelligence
      const value = aiResult.options || aiResult;
      
      // First ensure intelligence map exists, then set the tool value
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
      // Asset (including platform targeting): append to assets array
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
