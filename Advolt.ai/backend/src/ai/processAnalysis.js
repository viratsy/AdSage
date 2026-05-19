const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const ddb = require('/opt/nodejs/lib/dynamo');
const { buildAnalysisPrompt, parseAiResponse } = require('./prompts');
const { callAi } = require('./aiProvider');

exports.handler = async (event) => {
  for (const record of event.Records) {
    const { ad_id, user_id } = JSON.parse(record.body);

    try {
      const adResult = await ddb.send(new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_ADS,
        Key: { ad_id },
      }));

      if (!adResult.Item) {
        console.error('Ad not found for analysis', { ad_id });
        continue;
      }

      const ad = adResult.Item;
      const prompt = buildAnalysisPrompt(ad);
      const rawResponse = await callAi(prompt);
      const analysis = parseAiResponse(rawResponse);

      const analysis_id = uuidv4();
      await ddb.send(new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_AI,
        Item: {
          analysis_id,
          ad_id,
          user_id,
          ...analysis,
          created_at: new Date().toISOString(),
        },
      }));

      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_ADS,
        Key: { ad_id },
        UpdateExpression: 'SET ai_analysis_status = :s',
        ExpressionAttributeValues: { ':s': 'completed' },
      }));

      console.log('AI analysis completed', { ad_id, analysis_id });
    } catch (err) {
      console.error('AI analysis failed', { ad_id, error: err.message });

      await ddb.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_ADS,
        Key: { ad_id },
        UpdateExpression: 'SET ai_analysis_status = :s',
        ExpressionAttributeValues: { ':s': 'failed' },
      }));
    }
  }
};
