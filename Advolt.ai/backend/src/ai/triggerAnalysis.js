const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');
const {
  TOKEN_COSTS,
  FREE_PLAN_LIFETIME_ANALYSES,
  calculateCost,
  getUserTokenBalance,
} = require('/opt/nodejs/lib/tokenCosts');

const sqs = new SQSClient({});

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const { ad_id } = event.pathParameters;
  const body = JSON.parse(event.body || '{}');

  // operations: array like ['full_analysis'] or ['hook_analysis', 'generate_hooks']
  const operations = body.operations || ['full_analysis'];
  const tokenCost = calculateCost(operations);

  // Verify ad ownership
  const adResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id },
  }));

  if (!adResult.Item) return res.notFound('Ad not found');
  if (adResult.Item.user_id !== user.user_id) return res.forbidden();

  // Get user record
  const userResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_USERS,
    Key: { user_id: user.user_id },
  }));

  if (!userResult.Item) return res.unauthorized();
  const userRecord = userResult.Item;

  // ── Free plan: 1 lifetime analysis ──────────────────────────────────────────
  if (userRecord.subscription_plan === 'free') {
    const used = userRecord.free_analyses_used || 0;
    if (used >= FREE_PLAN_LIFETIME_ANALYSES) {
      return res.paymentRequired(
        `Free plan includes ${FREE_PLAN_LIFETIME_ANALYSES} AI analysis. Upgrade to Pro for more.`
      );
    }

    // Increment free analyses used
    await ddb.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_USERS,
      Key: { user_id: user.user_id },
      UpdateExpression: 'ADD free_analyses_used :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    }));
  } else {
    // ── Pro plan: own key or platform tokens ──────────────────────────────────
    if (userRecord.ai_provider === 'own_key' && userRecord.own_api_key_encrypted) {
      // Using own key — no token deduction
    } else {
      // Using platform tokens — check and deduct
      const balance = getUserTokenBalance(userRecord);

      if (balance.total < tokenCost) {
        return res.paymentRequired(JSON.stringify({
          error: 'insufficient_tokens',
          required: tokenCost,
          available: balance.total,
          monthly: balance.monthly,
          purchased: balance.purchased,
        }));
      }

      // Deduct monthly tokens first, then purchased
      let remainingDeduction = tokenCost;
      const updateExpressions = [];
      const expressionValues = {};

      if (balance.monthly > 0 && !balance.monthlyExpired) {
        const monthlyDeduct = Math.min(balance.monthly, remainingDeduction);
        updateExpressions.push('monthly_tokens = monthly_tokens - :md');
        expressionValues[':md'] = monthlyDeduct;
        remainingDeduction -= monthlyDeduct;
      }

      if (remainingDeduction > 0) {
        updateExpressions.push('purchased_tokens = purchased_tokens - :pd');
        expressionValues[':pd'] = remainingDeduction;
        expressionValues[':zero'] = 0;
      }

      if (updateExpressions.length > 0) {
        const conditionParts = [];
        if (expressionValues[':md']) conditionParts.push('monthly_tokens >= :md');
        if (expressionValues[':pd']) conditionParts.push('purchased_tokens >= :pd');

        try {
          await ddb.send(new UpdateCommand({
            TableName: process.env.DYNAMODB_TABLE_USERS,
            Key: { user_id: user.user_id },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ConditionExpression: conditionParts.join(' AND '),
            ExpressionAttributeValues: expressionValues,
          }));
        } catch (err) {
          if (err.name === 'ConditionalCheckFailedException') {
            return res.paymentRequired(JSON.stringify({
              error: 'insufficient_tokens',
              required: tokenCost,
              available: balance.total,
            }));
          }
          throw err;
        }
      }
    }
  }

  // Mark ad as processing
  await ddb.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id },
    UpdateExpression: 'SET ai_analysis_status = :s',
    ExpressionAttributeValues: { ':s': 'processing' },
  }));

  // Enqueue for async processing
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.AI_QUEUE_URL,
    MessageBody: JSON.stringify({
      ad_id,
      user_id: user.user_id,
      operations,
      token_cost: tokenCost,
      use_own_key: userRecord.ai_provider === 'own_key',
      own_api_key_encrypted: userRecord.own_api_key_encrypted || null,
    }),
  }));

  return res.ok({
    message: 'AI analysis queued',
    ad_id,
    token_cost: tokenCost,
    operations,
  });
};
