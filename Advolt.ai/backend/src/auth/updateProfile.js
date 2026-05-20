const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { business_profile } = body;

  if (!business_profile) return res.badRequest('business_profile is required');

  const allowed = ['niche', 'target_customer', 'product_service', 'pain_point', 'price_range', 'business_stage', 'location'];
  const sanitized = {};
  for (const key of allowed) {
    if (business_profile[key]) sanitized[key] = String(business_profile[key]).slice(0, 200);
  }

  await ddb.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_USERS,
    Key: { user_id: user.user_id },
    UpdateExpression: 'SET business_profile = :bp',
    ExpressionAttributeValues: { ':bp': sanitized },
  }));

  return res.ok({ message: 'Business profile updated', business_profile: sanitized });
};
