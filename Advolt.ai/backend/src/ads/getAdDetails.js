const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const { id } = event.pathParameters;

  const adResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id: id },
  }));

  if (!adResult.Item) return res.notFound('Ad not found');
  if (adResult.Item.user_id !== user.user_id) return res.forbidden();

  // Fetch AI analysis if available
  const aiResult = await ddb.send(new QueryCommand({
    TableName: process.env.DYNAMODB_TABLE_AI,
    IndexName: 'ad-created-index',
    KeyConditionExpression: 'ad_id = :aid',
    ExpressionAttributeValues: { ':aid': id },
    Limit: 1,
    ScanIndexForward: false,
  }));

  return res.ok({
    ad: adResult.Item,
    ai_analysis: aiResult.Items?.[0] || null,
  });
};
