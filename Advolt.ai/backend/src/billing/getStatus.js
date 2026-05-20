const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');
const { getUserTokenBalance } = require('/opt/nodejs/lib/tokenCosts');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const result = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_USERS,
    Key: { user_id: user.user_id },
  }));

  if (!result.Item) return res.notFound('User not found');

  const u = result.Item;
  const balance = getUserTokenBalance(u);

  return res.ok({
    subscription_plan: u.subscription_plan,
    ads_saved_count: u.ads_saved_count || 0,
    free_analyses_used: u.free_analyses_used || 0,
    monthly_tokens: balance.monthly,
    monthly_tokens_expiry: u.monthly_tokens_expiry || null,
    purchased_tokens: balance.purchased,
    total_tokens: balance.total,
    ai_provider: u.ai_provider || 'platform',
    has_own_key: !!u.own_api_key_encrypted,
  });
};
