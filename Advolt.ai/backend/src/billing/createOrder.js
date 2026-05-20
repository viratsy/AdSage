const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const PRODUCTS = {
  subscription: { amount: 49900, label: 'Pro Plan — ₹499/month' },
  starter: { amount: 9900, label: '1,000 Tokens — ₹99' },
  growth: { amount: 39900, label: '5,000 Tokens — ₹399' },
  pro_pack: { amount: 99900, label: '15,000 Tokens — ₹999' },
};

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { purchase_type, pack_id } = body;

  // Determine product
  const productKey = purchase_type === 'subscription' ? 'subscription' : pack_id;
  const product = PRODUCTS[productKey];
  if (!product) return res.badRequest('Invalid purchase type');

  const authHeader = Buffer.from(
    `${process.env.RAZORPAY_KEY}:${process.env.RAZORPAY_SECRET}`
  ).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({
      amount: product.amount,
      currency: 'INR',
      receipt: `advolt_${user.user_id}_${Date.now()}`,
      notes: {
        user_id: user.user_id,
        purchase_type,
        pack_id: pack_id || '',
        label: product.label,
      },
    }),
  });

  if (!response.ok) {
    console.error('Razorpay order creation failed', { status: response.status });
    return res.serverError('Payment order creation failed');
  }

  const order = await response.json();
  return res.created({
    order_id: order.id,
    amount: product.amount,
    currency: 'INR',
    key: process.env.RAZORPAY_KEY,
    label: product.label,
  });
};
