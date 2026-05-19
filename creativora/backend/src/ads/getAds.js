const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const { advertiser, tag, hook_type, limit = '20', lastKey } = event.queryStringParameters || {};

  const params = {
    TableName: process.env.DYNAMODB_TABLE_ADS,
    IndexName: 'user-created-index',
    KeyConditionExpression: 'user_id = :uid',
    ExpressionAttributeValues: { ':uid': user.user_id },
    ScanIndexForward: false, // newest first
    Limit: Math.min(parseInt(limit), 50),
  };

  if (lastKey) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
  }

  // Filter by advertiser if provided
  if (advertiser) {
    params.IndexName = 'user-advertiser-index';
    params.KeyConditionExpression = 'user_id = :uid AND advertiser_name = :adv';
    params.ExpressionAttributeValues[':adv'] = advertiser;
  }

  const result = await ddb.send(new QueryCommand(params));

  const nextKey = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;

  return res.ok({
    ads: result.Items,
    nextKey,
    count: result.Count,
  });
};
