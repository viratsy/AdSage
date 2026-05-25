/**
 * Create Project — Saves project details and triggers AI enrichment.
 * POST /projects
 */
const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const TABLE = process.env.DYNAMODB_TABLE_PROJECTS;

const callGroq = async (prompt) => {
  const key = process.env.GROQ_API_KEY;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are an expert marketing strategist. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
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

const buildAnalysisPrompt = (project) => `
Analyze the following business/product details and create a structured AI-friendly project summary for ad generation.

Project Name: ${project.project_name}
Business Name: ${project.business_name}
Business Niche: ${project.business_niche}
Product/Service Name: ${project.product_name}
Description: ${project.product_description}
Key Features: ${project.key_features}
Key Benefits: ${project.key_benefits}
USP/Differentiators: ${project.usp}

Return JSON with this structure:
{
  "summary": "A concise 2-3 sentence summary of the business and product",
  "target_keywords": ["list of 8-10 relevant keywords for ad targeting"],
  "suggested_audiences": ["3-4 ideal audience segments"],
  "tone_recommendations": ["3 recommended brand tones based on the niche"],
  "content_angles": ["4-5 content angles for ad campaigns"],
  "pain_points": ["3-4 customer pain points this product solves"],
  "value_propositions": ["3-4 clear value propositions for ads"],
  "competitive_edge": "One sentence on what makes this stand out"
}`;

exports.handler = async (event) => {
  try {
    const user = getUserFromEvent(event);
    if (!user) return res.unauthorized();

    const body = JSON.parse(event.body || '{}');
    const { project_name, business_name, business_niche, product_name, product_description, key_features, key_benefits, usp, target_location, target_audience_hint } = body;

    if (!project_name || !business_name || !business_niche || !product_name) {
      return res.badRequest('project_name, business_name, business_niche, and product_name are required');
    }

    // Generate AI analysis
    let ai_analysis = null;
    try {
      ai_analysis = await callGroq(buildAnalysisPrompt(body));
    } catch (err) {
      console.error('AI analysis failed:', err.message);
      // Continue without AI analysis — user can retry later
    }

    const project = {
      project_id: randomUUID(),
      user_id: user.user_id,
      project_name,
      business_name,
      business_niche,
      product_name,
      product_description: product_description || '',
      key_features: key_features || '',
      key_benefits: key_benefits || '',
      usp: usp || '',
      target_location: target_location || '',
      target_audience_hint: target_audience_hint || '',
      ai_analysis,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: project }));

    return res.created(project);
  } catch (err) {
    console.error('createProject error:', err);
    return res.serverError(err.message);
  }
};
