const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const res = require('/opt/nodejs/lib/response');

const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const { email, password, new_password, session } = body;

  if (!email || !password) {
    return res.badRequest('email and password are required');
  }

  try {
    // If session is provided, this is a NEW_PASSWORD_REQUIRED response
    if (session && new_password) {
      const challengeResult = await cognito.send(new RespondToAuthChallengeCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: new_password,
        },
      }));

      const tokens = challengeResult.AuthenticationResult;
      return res.ok({
        access_token: tokens.AccessToken,
        id_token: tokens.IdToken,
        refresh_token: tokens.RefreshToken,
        expires_in: tokens.ExpiresIn,
      });
    }

    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }));

    // Handle NEW_PASSWORD_REQUIRED challenge
    if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return res.ok({
        challenge: 'NEW_PASSWORD_REQUIRED',
        session: result.Session,
        message: 'Please set a new password',
      });
    }

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
