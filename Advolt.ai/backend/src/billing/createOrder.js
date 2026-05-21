const crypto = require('crypto');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const PRODUCTS = {
  subscription: { amount: 499, label: 'Pro Plan — ₹499/month' },
  starter: { amount: 99, label: '1,000 Tokens — ₹99' },
  growth: { amount: 399, label: '5,000 Tokens — ₹399' },
  pro_pack: { amount: 999, label: '15,000 Tokens — ₹999' },
};

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { purchase_type, pack_id, gateway } = body;

  const productKey = purchase_type === 'subscription' ? 'subscription' : pack_id;
  const product = PRODUCTS[productKey];
  if (!product) return res.badRequest('Invalid purchase type');

  const txnId = `advolt_${user.user_id.slice(0, 8)}_${Date.now()}`;
  const selectedGateway = gateway || 'payu';

  if (selectedGateway === 'payu') {
    // PayU hash generation
    const key = process.env.PAYU_MERCHANT_KEY;
    const salt = process.env.PAYU_SALT;
    const amount = String(product.amount) + '.0';
    const productInfo = product.label;
    const firstname = user.email.split('@')[0];
    const email = user.email;
    const udf1 = user.user_id;
    const udf2 = purchase_type || '';
    const udf3 = pack_id || '';

    // PayU hash: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
    const hashString = `${key}|${txnId}|${amount}|${productInfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|||||||||||${salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    console.log('PayU hash input:', `${key}|${txnId}|${amount}|${productInfo}|${firstname}|${email}|udf1|udf2|udf3|||||||||||SALT`);

    const payuBaseUrl = process.env.STAGE === 'prod'
      ? 'https://secure.payu.in/_payment'
      : 'https://test.payu.in/_payment';

    return res.created({
      gateway: 'payu',
      payu_url: payuBaseUrl,
      key,
      txnid: txnId,
      amount,
      productinfo: productInfo,
      firstname,
      email,
      hash,
      udf1,
      udf2,
      udf3,
      surl: `${process.env.CLOUDFRONT_URL || 'https://ad-sage-i4cs.vercel.app'}/dashboard/payment/success`,
      furl: `${process.env.CLOUDFRONT_URL || 'https://ad-sage-i4cs.vercel.app'}/dashboard/payment/failure`,
    });

  } else {
    // Razorpay
    const authHeader = Buffer.from(
      `${process.env.RAZORPAY_KEY}:${process.env.RAZORPAY_SECRET}`
    ).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${authHeader}` },
      body: JSON.stringify({
        amount: product.amount * 100, // paise
        currency: 'INR',
        receipt: txnId,
        notes: { user_id: user.user_id, purchase_type, pack_id: pack_id || '' },
      }),
    });

    if (!response.ok) return res.serverError('Razorpay order creation failed');
    const order = await response.json();

    return res.created({
      gateway: 'razorpay',
      order_id: order.id,
      amount: product.amount * 100,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY,
      label: product.label,
    });
  }
};
