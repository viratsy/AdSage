/**
 * Save Intelligence — User confirms/edits a foundation layer selection.
 * POST /projects/{id}/intelligence
 * 
 * Body: { tool: string, value: any }
 * Saves the user's confirmed selection to project.intelligence[tool]
 */
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const TABLE = process.env.DYNAMODB_TABLE_PROJECTS;

const VALID_TOOLS = ['audience', 'pain_points', 'desires', 'objections', 'emotional_angles'];

exports.handler = async (event) => {
  try {
    const user = getUserFromEvent(event);
    if (!user) return res.unauthorized();

    const projectId = event.pathParameters?.id;
    if (!projectId) return res.badRequest('Project ID is required');

    const body = JSON.parse(event.body || '{}');
    const { tool, value } = body;

    if (!tool || !VALID_TOOLS.includes(tool)) {
      return res.badRequest(`Invalid tool. Available: ${VALID_TOOLS.join(', ')}`);
    }
    if (value === undefined || value === null) {
      return res.badRequest('value is required');
    }

    // Get project and verify ownership
    const result = await ddb.send(new GetCommand({ TableName: TABLE, Key: { project_id: projectId } }));
    if (!result.Item) return res.notFound('Project not found');
    if (result.Item.user_id !== user.user_id) return res.forbidden();

    // Initialize intelligence if needed
    const intelligence = result.Item.intelligence || {};
    intelligence[tool] = value;

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
      UpdateExpression: 'SET intelligence = :intel, updated_at = :now',
      ExpressionAttributeValues: { ':intel': intelligence, ':now': new Date().toISOString() },
    }));

    return res.ok({ status: 'saved', tool, value });
  } catch (err) {
    console.error('saveIntelligence error:', err);
    return res.serverError(err.message);
  }
};
