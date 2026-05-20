/**
 * Standard API response helpers
 */

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

exports.ok = (body) => ({
  statusCode: 200,
  headers,
  body: JSON.stringify(body),
});

exports.created = (body) => ({
  statusCode: 201,
  headers,
  body: JSON.stringify(body),
});

exports.badRequest = (message) => ({
  statusCode: 400,
  headers,
  body: JSON.stringify({ error: message }),
});

exports.unauthorized = (message = 'Unauthorized') => ({
  statusCode: 401,
  headers,
  body: JSON.stringify({ error: message }),
});

exports.paymentRequired = (message = 'Insufficient credits') => ({
  statusCode: 402,
  headers,
  body: JSON.stringify({ error: message }),
});

exports.forbidden = (message = 'Forbidden') => ({
  statusCode: 403,
  headers,
  body: JSON.stringify({ error: message }),
});

exports.notFound = (message = 'Not found') => ({
  statusCode: 404,
  headers,
  body: JSON.stringify({ error: message }),
});

exports.serverError = (message = 'Internal server error') => ({
  statusCode: 500,
  headers,
  body: JSON.stringify({ error: message }),
});
