const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const ddb = require('/opt/nodejs/lib/dynamo');
const { buildAnalysisPrompt, parseAiResponse } = require('./prompts');
const { callAi } = require('./aiProvider');

const refundTokens = async (user_id, token_cost, was_free_plan) => {
  if (!user_id || !token_cost) return;
  try {
    if (was_free_plan) {
      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { user_id },
        UpdateExpression: 'ADD free_analyses_used :dec',
        ExpressionAttributeValues: { ':dec': -1 },
      }));
    } else {
      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { user_id },
        UpdateExpression: 'ADD monthly_tokens :tokens',
        ExpressionAttributeValues: { ':tokens': token_cost },
      }));
    }
    console.log('Tokens refunded', { user_id, token_cost });
  } catch (err) {
    console.error('Token refund failed', { user_id, error: err.message });
  }
};

exports.handler = async (event) => {
  for (const record of event.Records) {
    const { ad_id, user_id, token_cost, use_own_key, own_api_key_encrypted } = JSON.parse(record.body);
    const was_free_plan = !token_cost;

    try {
      // Fetch ad and user in parallel
      const [adResult, userResult] = await Promise.all([
        ddb.send(new GetCommand({ TableName: process.env.DYNAMODB_TABLE_ADS, Key: { ad_id } })),
        ddb.send(new GetCommand({ TableName: process.env.DYNAMODB_TABLE_USERS, Key: { user_id } })),
      ]);

      if (!adResult.Item) {
        console.error('Ad not found for analysis', { ad_id });
        continue;
      }

      const ad = adResult.Item;
      const businessProfile = userResult.Item?.business_profile || null;

      console.log('Starting analysis', {
        ad_id,
        advertiser: ad.advertiser_name,
        has_business_profile: !!businessProfile,
      });

      const prompt = buildAnalysisPrompt(ad, businessProfile);
      const aiOptions = use_own_key && own_api_key_encrypted
        ? { ownApiKey: own_api_key_encrypted }
        : {};

      const rawResponse = await callAi(prompt, aiOptions);
      const analysis = parseAiResponse(rawResponse);

      const analysis_id = uuidv4();
      await ddb.send(new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_AI,
        Item: {
          analysis_id,
          ad_id,
          user_id,
          ...analysis,
          business_profile_used: !!businessProfile,
          created_at: new Date().toISOString(),
        },
      }));

      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_ADS,
        Key: { ad_id },
        UpdateExpression: 'SET ai_analysis_status = :s',
        ExpressionAttributeValues: { ':s': 'completed' },
      }));

      console.log('AI analysis completed', { ad_id, analysis_id, ai_score: analysis.ai_score });

    } catch (err) {
      console.error('AI analysis failed', { ad_id, error: err.message });

      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_ADS,
        Key: { ad_id },
        UpdateExpression: 'SET ai_analysis_status = :s',
        ExpressionAttributeValues: { ':s': 'failed' },
      }));

      await refundTokens(user_id, token_cost, was_free_plan);
    }
  }
};
