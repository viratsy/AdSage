const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const ALLOWED_FIELDS = ['tags', 'favorite', 'notes'];

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const { id } = event.pathParameters;
  const body = JSON.parse(event.body || '{}');

  const adResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id: id },
  }));

  if (!adResult.Item) return res.notFound('Ad not found');
  if (adResult.Item.user_id !== user.user_id) return res.forbidden();

  const updates = Object.keys(body).filter((k) => ALLOWED_FIELDS.includes(k));
  if (!updates.length) return res.badRequest('No valid fields to update');

  const expr = updates.map((k, i) => `#f${i} = :v${i}`).join(', ');
  const names = Object.fromEntries(updates.map((k, i) => [`#f${i}`, k]));
  const values = Object.fromEntries(updates.map((k, i) => [`:v${i}`, body[k]]));

  await ddb.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id: id },
    UpdateExpression: `SET ${expr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));

  return res.ok({ message: 'Ad updated' });
};
