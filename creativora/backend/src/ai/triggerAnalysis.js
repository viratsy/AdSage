const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const sqs = new SQSClient({});

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const { ad_id } = event.pathParameters;

  // Verify ad ownership
  const adResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id },
  }));

  if (!adResult.Item) return res.notFound('Ad not found');
  if (adResult.Item.user_id !== user.user_id) return res.forbidden();

  // Check and decrement AI credits atomically
  try {
    await ddb.send(new UpdateCommand({
      TableName: `creativora-users-${process.env.STAGE || 'dev'}`,
      Key: { user_id: user.user_id },
      UpdateExpression: 'ADD ai_credits :dec',
      ConditionExpression: 'ai_credits > :zero',
      ExpressionAttributeValues: { ':dec': -1, ':zero': 0 },
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.paymentRequired('No AI credits remaining. Upgrade your plan.');
    }
    throw err;
  }

  // Mark ad as processing
  await ddb.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id },
    UpdateExpression: 'SET ai_analysis_status = :s',
    ExpressionAttributeValues: { ':s': 'processing' },
  }));

  // Enqueue for async processing
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.AI_QUEUE_URL,
    MessageBody: JSON.stringify({ ad_id, user_id: user.user_id }),
  }));

  return res.ok({ message: 'AI analysis queued', ad_id });
};
