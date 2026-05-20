const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');
const { TOKEN_COSTS, calculateCost, getUserTokenBalance } = require('/opt/nodejs/lib/tokenCosts');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const operations = body.operations || ['full_analysis'];
  const tokenCost = calculateCost(operations);

  // Get user balance
  const userResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_USERS,
    Key: { user_id: user.user_id },
  }));

  if (!userResult.Item) return res.unauthorized();
  const userRecord = userResult.Item;

  const isPro = userRecord.subscription_plan === 'pro';
  const usesOwnKey = userRecord.ai_provider === 'own_key' && !!userRecord.own_api_key_encrypted;
  const balance = getUserTokenBalance(userRecord);

  return res.ok({
    operations,
    token_cost: tokenCost,
    operation_costs: TOKEN_COSTS,
    balance: {
      monthly: balance.monthly,
      purchased: balance.purchased,
      total: balance.total,
      monthly_expired: balance.monthlyExpired,
    },
    can_proceed: usesOwnKey || (isPro
      ? balance.total >= tokenCost
      : (userRecord.free_analyses_used || 0) < 1),
    uses_own_key: usesOwnKey,
    is_free_plan: !isPro,
    free_analyses_used: userRecord.free_analyses_used || 0,
    token_packs: [
      { id: 'starter', tokens: 1000, price: 99, label: '1,000 tokens' },
      { id: 'growth', tokens: 5000, price: 399, label: '5,000 tokens' },
      { id: 'pro_pack', tokens: 15000, price: 999, label: '15,000 tokens' },
    ],
  });
};
