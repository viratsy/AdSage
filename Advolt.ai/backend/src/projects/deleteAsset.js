/**
 * Delete Asset — Remove a specific asset from a project.
 * DELETE /projects/{id}/assets/{assetId}
 */
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const TABLE = process.env.DYNAMODB_TABLE_PROJECTS;

exports.handler = async (event) => {
  try {
    const user = getUserFromEvent(event);
    if (!user) return res.unauthorized();

    const projectId = event.pathParameters?.id;
    const assetId = event.pathParameters?.assetId;
    if (!projectId || !assetId) return res.badRequest('Project ID and Asset ID are required');

    const result = await ddb.send(new GetCommand({ TableName: TABLE, Key: { project_id: projectId } }));
    if (!result.Item) return res.notFound('Project not found');
    if (result.Item.user_id !== user.user_id) return res.forbidden();

    const currentAssets = result.Item.assets || [];
    const filtered = currentAssets.filter(a => a.id !== assetId);

    if (filtered.length === currentAssets.length) {
      return res.notFound('Asset not found');
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { project_id: projectId },
      UpdateExpression: 'SET assets = :assets, updated_at = :now',
      ExpressionAttributeValues: { ':assets': filtered, ':now': new Date().toISOString() },
    }));

    return res.ok({ message: 'Asset deleted' });
  } catch (err) {
    console.error('deleteAsset error:', err);
    return res.serverError(err.message);
  }
};
