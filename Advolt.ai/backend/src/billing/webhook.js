const crypto = require('crypto');
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { PRO_MONTHLY_TOKENS, PRO_MONTHLY_EXPIRY_DAYS } = require('/opt/nodejs/lib/tokenCosts');

const TOKEN_PACKS = {
  starter: 1000,
  growth: 5000,
  pro_pack: 15000,
};

exports.handler = async (event) => {
  const signature = event.headers?.['x-razorpay-signature'];
  const rawBody = event.body;

  if (!signature) return res.badRequest('Missing signature');

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSig) {
    console.error('Invalid webhook signature');
    return res.badRequest('Invalid signature');
  }

  const payload = JSON.parse(rawBody);
  const eventType = payload.event;
  const notes = payload.payload?.payment?.entity?.notes || {};
  const user_id = notes.user_id;
  const purchase_type = notes.purchase_type; // 'subscription' | 'token_pack'
  const pack_id = notes.pack_id; // 'starter' | 'growth' | 'pro_pack'

  if (!user_id) {
    console.error('Webhook missing user_id');
    return res.ok({ received: true });
  }

  if (eventType === 'payment.captured') {

    if (purchase_type === 'subscription') {
      // Pro subscription — grant monthly tokens with 30-day expiry
      const expiry = new Date(Date.now() + PRO_MONTHLY_EXPIRY_DAYS * 86400000).toISOString();
      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { user_id },
        UpdateExpression: 'SET subscription_plan = :plan, monthly_tokens = :mt, monthly_tokens_expiry = :exp',
        ExpressionAttributeValues: {
          ':plan': 'pro',
          ':mt': PRO_MONTHLY_TOKENS,
          ':exp': expiry,
        },
      }));
      console.log('Pro subscription activated', { user_id, expiry });

    } else if (purchase_type === 'token_pack' && pack_id) {
      // Token pack purchase — add to purchased_tokens (never expire)
      const tokensToAdd = TOKEN_PACKS[pack_id];
      if (!tokensToAdd) {
        console.error('Unknown pack_id', pack_id);
        return res.ok({ received: true });
      }

      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { user_id },
        UpdateExpression: 'ADD purchased_tokens :tokens',
        ExpressionAttributeValues: { ':tokens': tokensToAdd },
      }));
      console.log('Token pack added', { user_id, pack_id, tokensToAdd });
    }
  }

  if (eventType === 'subscription.cancelled') {
    await ddb.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_USERS,
      Key: { user_id },
      UpdateExpression: 'SET subscription_plan = :plan, monthly_tokens = :zero, monthly_tokens_expiry = :null',
      ExpressionAttributeValues: {
        ':plan': 'free',
        ':zero': 0,
        ':null': null,
      },
    }));
    console.log('Subscription cancelled, downgraded to free', { user_id });
  }

  return res.ok({ received: true });
};
