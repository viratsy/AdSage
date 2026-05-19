const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const { ad_id } = event.pathParameters;

  // Verify ownership
  const adResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id },
  }));

  if (!adResult.Item) return res.notFound('Ad not found');
  if (adResult.Item.user_id !== user.user_id) return res.forbidden();

  const aiResult = await ddb.send(new QueryCommand({
    TableName: process.env.DYNAMODB_TABLE_AI,
    IndexName: 'ad-created-index',
    KeyConditionExpression: 'ad_id = :aid',
    ExpressionAttributeValues: { ':aid': ad_id },
    Limit: 1,
    ScanIndexForward: false,
  }));

  if (!aiResult.Items?.length) {
    return res.ok({ status: adResult.Item.ai_analysis_status, analysis: null });
  }

  return res.ok({ status: 'completed', analysis: aiResult.Items[0] });
};
