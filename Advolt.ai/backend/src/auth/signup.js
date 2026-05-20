const {
  CognitoIdentityProviderClient,
  SignUpCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');

const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const { email, password, full_name } = body;

  if (!email || !password || !full_name) {
    return res.badRequest('email, password, and full_name are required');
  }

  try {
    const signUpResult = await cognito.send(new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
      ],
    }));

    const user_id = signUpResult.UserSub;

    // Create user record in DynamoDB
    await ddb.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_USERS,
      Item: {
        user_id,
        email,
        full_name,
        created_at: new Date().toISOString(),
        subscription_plan: 'free',
        status: 'active',
        ads_saved_count: 0,
        // Token wallet
        monthly_tokens: 0,
        monthly_tokens_expiry: null,
        purchased_tokens: 0,
        free_analyses_used: 0,   // Free plan: 1 lifetime analysis
        ai_provider: 'platform',
        own_api_key_encrypted: null,
      },
    }));

    return res.created({ message: 'User created. Please verify your email.', user_id });
  } catch (err) {
    console.error('signup error', { error: err.message });
    if (err.name === 'UsernameExistsException') {
      return res.badRequest('Email already registered');
    }
    return res.serverError(err.message);
  }
};
