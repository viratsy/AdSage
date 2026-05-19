const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { plan } = body; // 'pro'

  if (plan !== 'pro') return res.badRequest('Invalid plan');

  const amount = 999; // amount in paise (₹9.99) — update to real price
  const currency = 'INR';

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
      amount,
      currency,
      receipt: `Advolt_${user.user_id}_${Date.now()}`,
      notes: { user_id: user.user_id, plan },
    }),
  });

  if (!response.ok) {
    console.error('Razorpay order creation failed', { status: response.status });
    return res.serverError('Payment order creation failed');
  }

  const order = await response.json();
  return res.created({ order_id: order.id, amount, currency, key: process.env.RAZORPAY_KEY });
};
