const crypto = require('crypto');
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { PRO_MONTHLY_TOKENS, PRO_MONTHLY_EXPIRY_DAYS } = require('/opt/nodejs/lib/tokenCosts');

const TOKEN_PACKS = { starter: 1000, growth: 5000, pro_pack: 15000 };

exports.handler = async (event) => {
  const body = event.body;
  const params = new URLSearchParams(body);

  // Determine if this is PayU or Razorpay webhook
  const isPayU = params.has('txnid') && params.has('hash');
  const isRazorpay = event.headers?.['x-razorpay-signature'];

  if (isPayU) {
    // ─── PayU Webhook ─────────────────────────────────────────────────────────
    const txnId = params.get('txnid') || '';
    const status = params.get('status') || '';
    const hash = params.get('hash') || '';
    const user_id = params.get('udf1') || '';
    const purchase_type = params.get('udf2') || '';
    const pack_id = params.get('udf3') || '';

    // FILTER: Only process transactions from our portal
    if (!txnId.startsWith('advolt_')) {
      console.log('Ignoring non-Advolt transaction:', txnId);
      return res.ok({ received: true, ignored: true });
    }

    if (!user_id) {
      console.log('PayU webhook missing user_id in udf1');
      return res.ok({ received: true });
    }

    // Log PayU webhook data for debugging
    console.log('PayU webhook processing', { txnId, status, user_id, purchase_type, pack_id });

    // Only process successful payments
    if (status !== 'success') {
      console.log('PayU payment not successful:', { txnId, status });
      return res.ok({ received: true, status });
    }

    // Credit tokens
    if (purchase_type === 'subscription') {
      const expiry = new Date(Date.now() + PRO_MONTHLY_EXPIRY_DAYS * 86400000).toISOString();
      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { user_id },
        UpdateExpression: 'SET subscription_plan = :plan, monthly_tokens = :mt, monthly_tokens_expiry = :exp',
        ExpressionAttributeValues: { ':plan': 'pro', ':mt': PRO_MONTHLY_TOKENS, ':exp': expiry },
      }));
      console.log('Pro subscription activated via PayU', { user_id, txnId });
    } else if (purchase_type === 'token_pack' && pack_id) {
      const tokensToAdd = TOKEN_PACKS[pack_id];
      if (tokensToAdd) {
        await ddb.send(new UpdateCommand({
          TableName: process.env.DYNAMODB_TABLE_USERS,
          Key: { user_id },
          UpdateExpression: 'ADD purchased_tokens :tokens',
          ExpressionAttributeValues: { ':tokens': tokensToAdd },
        }));
        console.log('Token pack added via PayU', { user_id, pack_id, tokensToAdd, txnId });
      }
    }

    return res.ok({ received: true, status: 'processed' });

  } else if (isRazorpay) {
    // ─── Razorpay Webhook ─────────────────────────────────────────────────────
    const signature = event.headers['x-razorpay-signature'];
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    if (signature !== expectedSig) return res.badRequest('Invalid signature');

    const payload = JSON.parse(body);
    const eventType = payload.event;
    const notes = payload.payload?.payment?.entity?.notes || {};
    const user_id = notes.user_id;
    const purchase_type = notes.purchase_type;
    const pack_id = notes.pack_id;

    if (!user_id) return res.ok({ received: true });

    if (eventType === 'payment.captured') {
      if (purchase_type === 'subscription') {
        const expiry = new Date(Date.now() + PRO_MONTHLY_EXPIRY_DAYS * 86400000).toISOString();
        await ddb.send(new UpdateCommand({
          TableName: process.env.DYNAMODB_TABLE_USERS,
          Key: { user_id },
          UpdateExpression: 'SET subscription_plan = :plan, monthly_tokens = :mt, monthly_tokens_expiry = :exp',
          ExpressionAttributeValues: { ':plan': 'pro', ':mt': PRO_MONTHLY_TOKENS, ':exp': expiry },
        }));
      } else if (purchase_type === 'token_pack' && pack_id) {
        const tokensToAdd = TOKEN_PACKS[pack_id];
        if (tokensToAdd) {
          await ddb.send(new UpdateCommand({
            TableName: process.env.DYNAMODB_TABLE_USERS,
            Key: { user_id },
            UpdateExpression: 'ADD purchased_tokens :tokens',
            ExpressionAttributeValues: { ':tokens': tokensToAdd },
          }));
        }
      }
    }
    return res.ok({ received: true });
  }

  return res.ok({ received: true, ignored: true });
};
