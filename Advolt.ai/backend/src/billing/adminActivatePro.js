/**
 * Admin Activate Pro — Manually add a user to Pro plan.
 * If user doesn't exist, creates them in Cognito with temp password.
 * POST /billing/admin/activate-pro
 * 
 * Body: { email: string, full_name?: string, tokens?: number, days?: number }
 * Header: x-admin-secret: <ADMIN_SECRET>
 */
const { UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, ListUsersCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');

const TABLE = process.env.DYNAMODB_TABLE_USERS;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'advolt-admin-2026';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const TEMP_PASSWORD = 'Advolt@123';

const cognito = new CognitoIdentityProviderClient({ region: 'ap-south-1' });

exports.handler = async (event) => {
  try {
    // Verify admin secret
    const adminHeader = event.headers?.['x-admin-secret'] || event.headers?.['X-Admin-Secret'];
    if (adminHeader !== ADMIN_SECRET) {
      return res.forbidden('Invalid admin secret');
    }

    const body = JSON.parse(event.body || '{}');
    const { email, full_name, tokens, days } = body;

    if (!email) return res.badRequest('email is required');

    const monthlyTokens = tokens || 5000;
    const expiryDays = days || 30;

    // Check if user exists in Cognito
    const cognitoResult = await cognito.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `email = "${email}"`,
      Limit: 1,
    }));

    let userId;
    let created = false;

    if (cognitoResult.Users && cognitoResult.Users.length > 0) {
      // User exists
      userId = cognitoResult.Users[0].Username;
    } else {
      // Create user in Cognito with temp password
      const createResult = await cognito.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          ...(full_name ? [{ Name: 'custom:full_name', Value: full_name }] : []),
        ],
        TemporaryPassword: TEMP_PASSWORD,
        MessageAction: 'SUPPRESS', // Don't send welcome email
      }));

      userId = createResult.User.Username;
      created = true;

      // Create DynamoDB record
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          user_id: userId,
          email,
          full_name: full_name || '',
          subscription_plan: 'pro',
          monthly_tokens: monthlyTokens,
          monthly_tokens_expiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
          purchased_tokens: 0,
          ads_saved_count: 0,
          free_analyses_used: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }));
    }

    // Update existing user to Pro (if they already existed)
    if (!created) {
      const expiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { user_id: userId },
        UpdateExpression: 'SET subscription_plan = :plan, monthly_tokens = :tokens, monthly_tokens_expiry = :expiry, updated_at = :now',
        ExpressionAttributeValues: {
          ':plan': 'pro',
          ':tokens': monthlyTokens,
          ':expiry': expiry,
          ':now': new Date().toISOString(),
        },
      }));
    }

    return res.ok({
      message: created ? `User created and Pro activated for ${email}` : `Pro plan activated for ${email}`,
      user_id: userId,
      created,
      monthly_tokens: monthlyTokens,
      expiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
      temp_password: created ? TEMP_PASSWORD : undefined,
    });
  } catch (err) {
    console.error('adminActivatePro error:', err);
    return res.serverError(err.message);
  }
};
