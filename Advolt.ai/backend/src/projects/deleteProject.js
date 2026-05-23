/**
 * Delete Project — Remove a project by ID.
 * DELETE /projects/{id}
 */
const { GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
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

    // Verify ownership
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
    }));

    if (!existing.Item) return res.notFound('Project not found');
    if (existing.Item.user_id !== user.user_id) return res.forbidden();

    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
    }));

    return res.ok({ message: 'Project deleted' });
  } catch (err) {
    console.error('deleteProject error:', err);
    return res.serverError(err.message);
  }
};
