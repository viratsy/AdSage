const crypto = require('crypto');
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');

const PRO_AI_CREDITS = 40;

exports.handler = async (event) => {
  // Verify Razorpay webhook signature
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
  const plan = notes.plan;

  if (!user_id) {
    console.error('Webhook missing user_id in notes');
    return res.ok({ received: true }); // Acknowledge to avoid retries
  }

  if (eventType === 'payment.captured') {
    await ddb.send(new UpdateCommand({
      TableName: `creativora-users-${process.env.STAGE || 'dev'}`,
      Key: { user_id },
      UpdateExpression: 'SET subscription_plan = :plan, ai_credits = :credits, ads_saved_count = :zero',
      ExpressionAttributeValues: {
        ':plan': plan || 'pro',
        ':credits': PRO_AI_CREDITS,
        ':zero': 0, // Reset count on upgrade
      },
    }));
    console.log('User upgraded to pro', { user_id });
  }

  if (eventType === 'subscription.cancelled') {
    await ddb.send(new UpdateCommand({
      TableName: `creativora-users-${process.env.STAGE || 'dev'}`,
      Key: { user_id },
      UpdateExpression: 'SET subscription_plan = :plan, ai_credits = :credits',
      ExpressionAttributeValues: {
        ':plan': 'free',
        ':credits': 5,
      },
    }));
    console.log('User downgraded to free', { user_id });
  }

  return res.ok({ received: true });
};
