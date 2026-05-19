const { GetCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, DeleteObjectsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const s3 = new S3Client({});

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const { id } = event.pathParameters;

  const adResult = await ddb.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id: id },
  }));

  if (!adResult.Item) return res.notFound('Ad not found');
  if (adResult.Item.user_id !== user.user_id) return res.forbidden();

  // Delete S3 objects for this ad
  const prefix = `users/${user.user_id}/ads/${id}/`;
  const listed = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.ADS_BUCKET,
    Prefix: prefix,
  }));

  if (listed.Contents?.length) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: process.env.ADS_BUCKET,
      Delete: {
        Objects: listed.Contents.map((o) => ({ Key: o.Key })),
      },
    }));
  }

  await ddb.send(new DeleteCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Key: { ad_id: id },
  }));

  // Decrement user ad count
  await ddb.send(new UpdateCommand({
    TableName: `advolt-users-${process.env.STAGE || 'dev'}`,
    Key: { user_id: user.user_id },
    UpdateExpression: 'ADD ads_saved_count :dec',
    ExpressionAttributeValues: { ':dec': -1 },
  }));

  return res.ok({ message: 'Ad deleted' });
};
