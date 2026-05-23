/**
 * Get Project — Get a single project by ID.
 * GET /projects/{id}
 */
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const TABLE = process.env.DYNAMODB_TABLE_PROJECTS;

exports.handler = async (event) => {
  try {
    const user = getUserFromEvent(event);
    if (!user) return res.unauthorized();

    const projectId = event.pathParameters?.id;
    if (!projectId) return res.badRequest('Project ID is required');

    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
    }));

    if (!result.Item) return res.notFound('Project not found');
    if (result.Item.user_id !== user.user_id) return res.forbidden();

    return res.ok(result.Item);
  } catch (err) {
    console.error('getProject error:', err);
    return res.serverError(err.message);
  }
};
