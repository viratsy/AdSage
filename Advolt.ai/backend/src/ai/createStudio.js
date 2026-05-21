/**
 * AI Create Studio — Generate ad content from scratch (no saved ad required).
 * Tools: ad_brief, hooks, ctas, short_copy, long_copy, image_prompt, video_script, rewrite
 */
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');
const { TOKEN_COSTS, getUserTokenBalance } = require('/opt/nodejs/lib/tokenCosts');

const callGroq = async (prompt) => {
  const key = process.env.GROQ_API_KEY;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are an expert ad copywriter and marketing strategist. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`Groq error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
};

const STUDIO_PROMPTS = {
  ad_brief: (input, persona) => `
Create a complete ad brief for this product/service.
${persona ? `Business context: ${persona}` : ''}
Product/Service: ${input.product || 'Not specified'}
Goal: ${input.goal || 'Increase conversions'}
Target Audience: ${input.audience || 'Not specified'}
Tone: ${input.tone || 'Professional yet engaging'}

Return JSON:
{
  "brief": {
    "objective": "campaign objective",
    "target_audience": "detailed audience description",
    "key_message": "core message",
    "tone": "tone description",
    "hooks": ["3 hook ideas"],
    "cta_options": ["3 CTA options"],
    "platforms": ["recommended platforms"],
    "content_angles": ["3 content angles to test"]
  }
}`,

  hooks: (input, persona) => `
Generate ${input.count || 10} ad hooks for this product/service.
${persona ? `Business context: ${persona}` : ''}
Product/Service: ${input.product || 'Not specified'}
Target Audience: ${input.audience || 'General'}
Tone: ${input.tone || 'Engaging'}
${input.instruction ? `Additional instruction: ${input.instruction}` : ''}

Mix different hook types: curiosity, pain point, benefit, social proof, urgency, question.
Return JSON: {"hooks": ["hook1", "hook2", ...]}`,

  ctas: (input, persona) => `
Generate ${input.count || 10} CTA (call-to-action) variations.
${persona ? `Business context: ${persona}` : ''}
Product/Service: ${input.product || 'Not specified'}
Goal: ${input.goal || 'Get clicks'}
${input.instruction ? `Additional instruction: ${input.instruction}` : ''}

Mix styles: urgency, benefit-driven, curiosity, direct, soft.
Return JSON: {"ctas": ["cta1", "cta2", ...]}`,

  short_copy: (input, persona) => `
Write 3 short ad copy variations (under 50 words each) for this product/service.
${persona ? `Business context: ${persona}` : ''}
Product/Service: ${input.product || 'Not specified'}
Target Audience: ${input.audience || 'General'}
Tone: ${input.tone || 'Engaging'}
Platform: ${input.platform || 'Facebook/Instagram'}
${input.instruction ? `Additional instruction: ${input.instruction}` : ''}

Return JSON: {"copies": ["copy1", "copy2", "copy3"]}`,

  long_copy: (input, persona) => `
Write a long-form ad copy (100-200 words) for this product/service.
Include: attention-grabbing hook, problem agitation, solution, benefits, social proof element, and strong CTA.
${persona ? `Business context: ${persona}` : ''}
Product/Service: ${input.product || 'Not specified'}
Target Audience: ${input.audience || 'General'}
Tone: ${input.tone || 'Persuasive'}
${input.instruction ? `Additional instruction: ${input.instruction}` : ''}

Return JSON: {"long_copy": "the full ad copy"}`,

  image_prompt: (input, persona) => `
Create 3 detailed image generation prompts for ad creatives.
${persona ? `Business context: ${persona}` : ''}
Product/Service: ${input.product || 'Not specified'}
Style: ${input.style || 'Modern, clean'}
Platform: ${input.platform || 'Instagram'}
${input.instruction ? `Additional instruction: ${input.instruction}` : ''}

Each prompt should be specific enough for Midjourney/DALL-E. Include subject, style, colors, mood, composition.
Return JSON: {"prompts": ["prompt1", "prompt2", "prompt3"]}`,

  video_script: (input, persona) => `
Write a ${input.duration || '30-60'} second video ad script.
${persona ? `Business context: ${persona}` : ''}
Product/Service: ${input.product || 'Not specified'}
Target Audience: ${input.audience || 'General'}
Tone: ${input.tone || 'Energetic'}
${input.instruction ? `Additional instruction: ${input.instruction}` : ''}

Include:
- Hook (first 3 seconds)
- Problem/Pain point
- Solution introduction
- Key benefits (2-3)
- Social proof
- CTA
- [VISUAL: description] markers for each section

Return JSON: {"video_script": "the full script"}`,

  rewrite: (input, persona) => `
Rewrite this ad copy to make it more effective.
${persona ? `Business context: ${persona}` : ''}
Original copy: "${input.original_text}"
Goal: ${input.goal || 'Make it more engaging and conversion-focused'}
Tone: ${input.tone || 'Keep similar tone'}
${input.instruction ? `Additional instruction: ${input.instruction}` : ''}

Provide 3 rewritten versions with different angles.
Return JSON: {"rewrites": ["version1", "version2", "version3"]}`,
};

const TOOL_COSTS = {
  ad_brief: 30,
  hooks: 20,
  ctas: 20,
  short_copy: 30,
  long_copy: 50,
  image_prompt: 20,
  video_script: 50,
  rewrite: 30,
};

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { tool, input } = body;

  if (!tool || !input) return res.badRequest('tool and input required');
  if (!STUDIO_PROMPTS[tool]) return res.badRequest('Invalid tool');

  const tokenCost = TOOL_COSTS[tool] || 20;

  // Get user for token check and persona
  const userResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_USERS,
    Key: { user_id: user.user_id },
  }));
  if (!userResult.Item) return res.unauthorized();

  const userRecord = userResult.Item;
  const balance = getUserTokenBalance(userRecord);

  // Check tokens
  if (balance.total < tokenCost) {
    return res.paymentRequired(JSON.stringify({
      error: 'insufficient_tokens', required: tokenCost, available: balance.total,
    }));
  }

  // Deduct tokens (monthly first, then purchased)
  const deductMonthly = Math.min(balance.monthly, tokenCost);
  const deductPurchased = tokenCost - deductMonthly;
  const updates = [];
  const values = {};
  if (deductMonthly > 0) { updates.push('monthly_tokens = monthly_tokens - :md'); values[':md'] = deductMonthly; }
  if (deductPurchased > 0) { updates.push('purchased_tokens = purchased_tokens - :pd'); values[':pd'] = deductPurchased; }
  if (updates.length) {
    await ddb.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_USERS,
      Key: { user_id: user.user_id },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeValues: values,
    }));
  }

  // Generate
  try {
    const persona = userRecord.business_persona || null;
    const prompt = STUDIO_PROMPTS[tool](input, persona);
    const raw = await callGroq(prompt);

    let cleaned = raw;
    if (cleaned.includes('```')) cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '');
    const result = JSON.parse(cleaned.trim());

    return res.ok({ tool, result, token_cost: tokenCost });
  } catch (err) {
    // Refund on failure
    await ddb.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_USERS,
      Key: { user_id: user.user_id },
      UpdateExpression: 'ADD monthly_tokens :refund',
      ExpressionAttributeValues: { ':refund': tokenCost },
    }));
    console.error('Studio generation failed', { tool, error: err.message });
    return res.serverError('Generation failed. Tokens refunded.');
  }
};
