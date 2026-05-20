const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');
const { callAi } = require('../ai/aiProvider');

const PERSONA_PROMPT = (answers) => `You are a business strategist and marketing expert. A user has described their business. Your job is to:

1. Analyze their answers and create a refined business persona
2. Identify any gaps or vague areas in their description
3. Generate follow-up questions if needed (max 3)
4. Create a final persona summary that can be used to generate personalized ad content

USER'S ANSWERS:
- Business/Niche: ${answers.niche || 'Not provided'}
- Target Customer: ${answers.target_customer || 'Not provided'}
- Main Product/Service: ${answers.product_service || 'Not provided'}
- Customer Pain Point: ${answers.pain_point || 'Not provided'}
- Price Range: ${answers.price_range || 'Not provided'}
- Location/Market: ${answers.location || 'Not provided'}
${answers.follow_up_answers ? `- Additional context: ${answers.follow_up_answers}` : ''}

Return ONLY valid JSON:
{
  "persona_summary": "<A 2-3 sentence refined description of this business, its positioning, and ideal customer. Written in third person. This will be used as context for all future AI content generation.>",
  "refined_profile": {
    "niche": "<refined/clarified niche>",
    "target_customer": "<detailed ideal customer avatar>",
    "product_service": "<clear product/service description>",
    "pain_point": "<specific pain point the business solves>",
    "unique_value": "<what makes this business different>",
    "tone_of_voice": "<recommended ad tone: professional/casual/urgent/inspirational/etc>",
    "price_positioning": "<budget/mid-range/premium>"
  },
  "follow_up_questions": ["<question 1 if answers are vague, otherwise empty array>"],
  "confidence_score": <0-100 how confident you are in the persona based on the answers>,
  "suggestions": ["<1-2 positioning suggestions to improve their marketing>"]
}`;

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { answers, save_final } = body;

  if (!answers) return res.badRequest('answers object is required');

  // If save_final is true, save the persona directly without AI call
  if (save_final && body.persona) {
    await ddb.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_USERS,
      Key: { user_id: user.user_id },
      UpdateExpression: 'SET business_profile = :bp, business_persona = :ps',
      ExpressionAttributeValues: {
        ':bp': body.persona.refined_profile || answers,
        ':ps': body.persona.persona_summary || '',
      },
    }));
    return res.ok({ message: 'Business persona saved', persona: body.persona });
  }

  // Call AI to generate persona
  try {
    const prompt = PERSONA_PROMPT(answers);
    const rawResponse = await callAi(prompt);

    // Parse response
    let cleaned = rawResponse;
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }

    const persona = JSON.parse(cleaned.trim());

    return res.ok({
      persona,
      needs_follow_up: persona.follow_up_questions?.length > 0 && persona.confidence_score < 70,
    });
  } catch (err) {
    console.error('Persona generation failed', { error: err.message });
    return res.serverError('Failed to generate persona. Please try again.');
  }
};
