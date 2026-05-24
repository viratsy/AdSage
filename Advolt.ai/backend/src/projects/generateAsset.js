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

const callGroq = async (prompt, maxTokens = 2000) => {
  const key = process.env.GROQ_API_KEY;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
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

// Dependencies: what each tool needs before it can run
const DEPENDENCIES = {
  audience: [],
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

const buildContext = (project) => {
  const parts = [];
  parts.push(`Business: ${project.business_name}`);
  parts.push(`Niche: ${project.business_niche}`);
  parts.push(`Product: ${project.product_name}`);
  parts.push(`Description: ${project.product_description || 'Not provided'}`);
  parts.push(`USP: ${project.usp || 'Not provided'}`);
  
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

Generate 3 target audience profile options for this business. Each should be distinct.
Return JSON: { "options": [{ "label": "short name", "demographics": "age, gender, location, income", "psychographics": "interests, values, lifestyle", "situation": "what's happening in their life that makes them need this", "awareness_level": "unaware/problem-aware/solution-aware/product-aware" }] }`,

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
    const aiResult = await callGroq(prompt);

    // Save result
    if (FOUNDATION_TOOLS.includes(tool)) {
      // Foundation: save to intelligence
      const value = aiResult.options || aiResult;
      
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { project_id: projectId },
        UpdateExpression: 'SET intelligence.#tool = :val, updated_at = :now',
        ExpressionAttributeNames: { '#tool': tool },
        ExpressionAttributeValues: { ':val': value, ':now': new Date().toISOString() },
      }));

      return res.ok({ status: 'options', tool, options: value });
    } else {
      // Asset: append to assets array
      const items = aiResult.items || [aiResult];
      const timestamp = new Date().toISOString();
      const asset = { id: `${tool}_${Date.now()}`, tool, items, input: input || {}, created_at: timestamp };

      // Get current assets or initialize
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
