/**
 * Custom Lambda Authorizer
 * Validates Cognito JWT tokens without requiring OAuth scopes.
 */

const https = require('https');
const crypto = require('crypto');

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const REGION = 'ap-south-1';
const JWKS_URL = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;

let cachedJwks = null;

const fetchJwks = () => new Promise((resolve, reject) => {
  https.get(JWKS_URL, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

const base64UrlDecode = (str) => {
  const padded = str + '='.repeat((4 - str.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
};

const verifyJwt = async (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));

  // Check expiry
  if (Date.now() / 1000 > payload.exp) throw new Error('Token expired');

  // Check issuer
  const expectedIss = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
  if (payload.iss !== expectedIss) throw new Error('Invalid issuer');

  // Check token use
  if (payload.token_use !== 'id' && payload.token_use !== 'access') {
    throw new Error('Invalid token_use');
  }

  // Get JWKS and verify signature
  if (!cachedJwks) {
    cachedJwks = await fetchJwks();
  }

  const key = cachedJwks.keys.find((k) => k.kid === header.kid);
  if (!key) throw new Error('Key not found');

  // Build PEM from JWK
  const jwkToPem = (jwk) => {
    const n = base64UrlDecode(jwk.n);
    const e = base64UrlDecode(jwk.e);
    // Simple RSA public key construction
    const keyObject = crypto.createPublicKey({
      key: { kty: 'RSA', n: jwk.n, e: jwk.e },
      format: 'jwk',
    });
    return keyObject.export({ type: 'spki', format: 'pem' });
  };

  const pem = jwkToPem(key);
  const signatureInput = `${parts[0]}.${parts[1]}`;
  const signature = base64UrlDecode(parts[2]);

  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(signatureInput);
  if (!verify.verify(pem, signature)) throw new Error('Invalid signature');

  return payload;
};

const generatePolicy = (principalId, effect, resource, context) => ({
  principalId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [{
      Action: 'execute-api:Invoke',
      Effect: effect,
      Resource: resource,
    }],
  },
  context,
});

exports.handler = async (event) => {
  // REQUEST type authorizer — token is in headers
  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  console.log('Authorizer: token present:', !!token, 'length:', token.length);

  try {
    if (!token) throw new Error('No token');
    const payload = await verifyJwt(token);
    const arnParts = event.methodArn.split('/');
    const wildcardArn = arnParts[0] + '/*/*';
    return generatePolicy(payload.sub, 'Allow', wildcardArn, {
      sub: payload.sub,
      email: payload.email || '',
      cognito_username: payload['cognito:username'] || payload.sub,
    });
  } catch (err) {
    console.error('Auth failed:', err.message);
    throw new Error('Unauthorized');
  }
};
