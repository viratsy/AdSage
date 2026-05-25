/**
 * Update Project — Update project details and optionally re-run AI analysis.
 * PATCH /projects/{id}
 */
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
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

    const projectId = event.pathParameters?.id;
    if (!projectId) return res.badRequest('Project ID is required');

    const body = JSON.parse(event.body || '{}');
    const { project_name, business_name, business_niche, product_name, product_description, key_features, key_benefits, usp, target_location, target_audience_hint, reanalyze } = body;

    // Verify ownership
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
    }));

    if (!existing.Item) return res.notFound('Project not found');
    if (existing.Item.user_id !== user.user_id) return res.forbidden();

    // Build update expression
    const updates = {};
    if (project_name !== undefined) updates.project_name = project_name;
    if (business_name !== undefined) updates.business_name = business_name;
    if (business_niche !== undefined) updates.business_niche = business_niche;
    if (product_name !== undefined) updates.product_name = product_name;
    if (product_description !== undefined) updates.product_description = product_description;
    if (key_features !== undefined) updates.key_features = key_features;
    if (key_benefits !== undefined) updates.key_benefits = key_benefits;
    if (usp !== undefined) updates.usp = usp;
    if (target_location !== undefined) updates.target_location = target_location;
    if (target_audience_hint !== undefined) updates.target_audience_hint = target_audience_hint;
    updates.updated_at = new Date().toISOString();

    // Re-run AI analysis if requested
    if (reanalyze) {
      const projectData = { ...existing.Item, ...updates };
      try {
        updates.ai_analysis = await callGroq(buildAnalysisPrompt(projectData));
      } catch (err) {
        console.error('AI re-analysis failed:', err.message);
      }
    }

    const expressionParts = [];
    const exprValues = {};
    const exprNames = {};

    Object.entries(updates).forEach(([key, value], i) => {
      expressionParts.push(`#f${i} = :v${i}`);
      exprNames[`#f${i}`] = key;
      exprValues[`:v${i}`] = value;
    });

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
      ReturnValues: 'ALL_NEW',
    }));

    // Return updated project
    const updated = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
    }));

    return res.ok(updated.Item);
  } catch (err) {
    console.error('updateProject error:', err);
    return res.serverError(err.message);
  }
};
