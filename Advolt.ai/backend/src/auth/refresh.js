const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const res = require('/opt/nodejs/lib/response');

const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const { refresh_token } = body;

  if (!refresh_token) {
    return res.badRequest('refresh_token is required');
  }

  try {
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refresh_token,
      },
    }));

    const tokens = result.AuthenticationResult;
    return res.ok({
      access_token: tokens.AccessToken,
      id_token: tokens.IdToken,
      expires_in: tokens.ExpiresIn,
    });
  } catch (err) {
    console.error('refresh error', { error: err.message });
    return res.unauthorized('Invalid or expired refresh token');
  }
};
