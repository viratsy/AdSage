const { PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const { v4: uuidv4 } = require('uuid');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const eb = new EventBridgeClient({});

const FREE_LIMIT = 5;
const PRO_LIMIT = 40;

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const {
    advertiser_name, primary_text, headline, cta,
    landing_page, platform, image_urls = [], video_urls = [],
  } = body;

  if (!advertiser_name) return res.badRequest('advertiser_name is required');

  // Check save limit
  const userRecord = await ddb.send(new GetCommand({
    TableName: `creativora-users-${process.env.STAGE || 'dev'}`,
    Key: { user_id: user.user_id },
  }));

  if (!userRecord.Item) return res.unauthorized();

  const { subscription_plan, ads_saved_count = 0 } = userRecord.Item;
  const limit = subscription_plan === 'pro' ? PRO_LIMIT : FREE_LIMIT;

  if (ads_saved_count >= limit) {
    return res.paymentRequired(`Ad save limit reached (${limit}). Upgrade to save more.`);
  }

  const ad_id = uuidv4();
  const created_at = new Date().toISOString();

  await ddb.send(new PutCommand({
    TableName: process.env.DYNAMODB_TABLE_ADS,
    Item: {
      ad_id,
      user_id: user.user_id,
      advertiser_name: advertiser_name || '',
      primary_text: primary_text || '',
      headline: headline || '',
      cta: cta || '',
      landing_page: landing_page || '',
      platform: platform || 'facebook',
      image_urls,
      video_urls,
      ai_analysis_status: 'pending',
      created_at,
      tags: [],
      favorite: false,
    },
  }));

  // Increment user ad count atomically
  await ddb.send(new UpdateCommand({
    TableName: `creativora-users-${process.env.STAGE || 'dev'}`,
    Key: { user_id: user.user_id },
    UpdateExpression: 'ADD ads_saved_count :inc',
    ExpressionAttributeValues: { ':inc': 1 },
  }));

  // Fire EventBridge event to trigger async AI analysis
  await eb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: 'creativora.ads',
      DetailType: 'AdSaved',
      Detail: JSON.stringify({ ad_id, user_id: user.user_id }),
    }],
  }));

  return res.created({ ad_id, message: 'Ad saved successfully' });
};
