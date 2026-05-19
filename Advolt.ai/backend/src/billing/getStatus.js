const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const result = await ddb.send(new GetCommand({
    TableName: `advolt-users-${process.env.STAGE || 'dev'}`,
    Key: { user_id: user.user_id },
  }));

  if (!result.Item) return res.notFound('User not found');

  const { subscription_plan, ai_credits, ads_saved_count } = result.Item;
  return res.ok({ subscription_plan, ai_credits, ads_saved_count });
};
