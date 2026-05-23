/**
 * Get Projects — List all projects for the authenticated user.
 * GET /projects
 */
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const TABLE = process.env.DYNAMODB_TABLE_PROJECTS;

exports.handler = async (event) => {
  try {
    const user = getUserFromEvent(event);
    if (!user) return res.unauthorized();

    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'user-created-index',
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: { ':uid': user.user_id },
      ScanIndexForward: false, // newest first
    }));

    return res.ok({ projects: result.Items || [] });
  } catch (err) {
    console.error('getProjects error:', err);
    return res.serverError(err.message);
  }
};
