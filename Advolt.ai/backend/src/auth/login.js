const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const res = require('/opt/nodejs/lib/response');

const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const { email, password } = body;

  if (!email || !password) {
    return res.badRequest('email and password are required');
  }

  try {
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }));

    const tokens = result.AuthenticationResult;
    return res.ok({
      access_token: tokens.AccessToken,
      id_token: tokens.IdToken,
      refresh_token: tokens.RefreshToken,
      expires_in: tokens.ExpiresIn,
    });
  } catch (err) {
    console.error('login error', { error: err.message });
    if (
      err.name === 'NotAuthorizedException' ||
      err.name === 'UserNotFoundException'
    ) {
      return res.unauthorized('Invalid email or password');
    }
    if (err.name === 'UserNotConfirmedException') {
      return res.unauthorized('Email not verified');
    }
    return res.serverError();
  }
};
