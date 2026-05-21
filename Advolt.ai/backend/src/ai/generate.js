/**
 * Synchronous AI generation endpoint.
 * Handles individual operations: hooks, ctas, short_copy, long_copy, image_prompt
 * Supports user instructions for regeneration.
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
        { role: 'system', content: 'You are an expert ad copywriter. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`Groq error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
};

const OPERATION_PROMPTS = {
  hooks: (ad, persona, instruction, count = 5) => `
Generate ${count} ad hooks for this business.
${persona ? `Business: ${persona}` : ''}
Inspired by this ad from ${ad.advertiser_name}: "${ad.video_transcript || ad.primary_text || ''}"
${instruction ? `User instruction: ${instruction}` : ''}
Return JSON: {"hooks": ["hook1", "hook2", ...]}`,

  ctas: (ad, persona, instruction, count = 5) => `
Generate ${count} CTA (call-to-action) variations for this business.
${persona ? `Business: ${persona}` : ''}
Inspired by this ad from ${ad.advertiser_name}: "${ad.video_transcript || ad.primary_text || ''}"
${instruction ? `User instruction: ${instruction}` : ''}
Return JSON: {"ctas": ["cta1", "cta2", ...]}`,

  short_copy: (ad, persona, instruction) => `
Write a short ad copy (under 50 words) for this business.
${persona ? `Business: ${persona}` : ''}
Inspired by this ad from ${ad.advertiser_name}: "${ad.video_transcript || ad.primary_text || ''}"
${instruction ? `User instruction: ${instruction}` : ''}
Return JSON: {"short_copy": "the ad copy here"}`,

  long_copy: (ad, persona, instruction) => `
Write a long ad copy (100-150 words) for this business. Include a hook, body, and CTA.
${persona ? `Business: ${persona}` : ''}
Inspired by this ad from ${ad.advertiser_name}: "${ad.video_transcript || ad.primary_text || ''}"
${instruction ? `User instruction: ${instruction}` : ''}
Return JSON: {"long_copy": "the full ad copy here"}`,

  image_prompt: (ad, persona, instruction) => `
Create a detailed image generation prompt for an ad creative for this business.
${persona ? `Business: ${persona}` : ''}
Inspired by the visual style of an ad from ${ad.advertiser_name}.
Include: subject, style, colors, mood, composition. Make it specific for Midjourney/DALL-E.
${instruction ? `User instruction: ${instruction}` : ''}
Return JSON: {"image_prompt": "the detailed prompt here"}`,

  video_script: (ad, persona, instruction) => `
Write a 30-60 second video ad script for this business. Include:
- Hook (first 3 seconds to grab attention)
- Problem statement
- Solution (the product/service)
- Social proof or authority
- CTA (call to action)
- Suggested visuals for each section

${persona ? `Business: ${persona}` : ''}
Inspired by this video ad from ${ad.advertiser_name}: "${ad.video_transcript || ad.primary_text || ''}"
${instruction ? `User instruction: ${instruction}` : ''}
Return JSON: {"video_script": "the full script with [VISUAL: description] markers for each section"}`,
};

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { ad_id, operation, instruction, count } = body;

  if (!ad_id || !operation) return res.badRequest('ad_id and operation required');
  if (!OPERATION_PROMPTS[operation]) return res.badRequest('Invalid operation');

  const tokenCost = TOKEN_COSTS[operation === 'hooks' ? 'generate_hooks' : operation === 'ctas' ? 'generate_ctas' : operation] || 20;

  // Get ad
  const adResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id },
  }));
  if (!adResult.Item) return res.notFound('Ad not found');
  if (adResult.Item.user_id !== user.user_id) return res.forbidden();

  // Get user for token check and persona
  const userResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_USERS,
    Key: { user_id: user.user_id },
  }));
  if (!userResult.Item) return res.unauthorized();

  const userRecord = userResult.Item;
  const balance = getUserTokenBalance(userRecord);

  // Check tokens (skip for free plan's first analysis)
  if (userRecord.subscription_plan === 'pro' && userRecord.ai_provider !== 'own_key') {
    if (balance.total < tokenCost) {
      return res.paymentRequired(JSON.stringify({
        error: 'insufficient_tokens', required: tokenCost, available: balance.total,
      }));
    }
    // Deduct
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
  }

  // Generate
  try {
    const ad = adResult.Item;
    const persona = userRecord.business_persona || null;
    const prompt = OPERATION_PROMPTS[operation](ad, persona, instruction, count || 5);
    const raw = await callGroq(prompt);

    let cleaned = raw;
    if (cleaned.includes('```')) cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '');
    const result = JSON.parse(cleaned.trim());

    return res.ok({ operation, result, token_cost: tokenCost });
  } catch (err) {
    // Refund on failure
    if (userRecord.subscription_plan === 'pro' && userRecord.ai_provider !== 'own_key') {
      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { user_id: user.user_id },
        UpdateExpression: 'ADD monthly_tokens :refund',
        ExpressionAttributeValues: { ':refund': tokenCost },
      }));
    }
    console.error('Generate failed', { operation, error: err.message });
    return res.serverError('Generation failed. Tokens refunded.');
  }
};
