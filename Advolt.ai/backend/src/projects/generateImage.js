/**
 * Generate Image — Calls SiliconFlow API to create an ad creative image.
 * POST /projects/{id}/generate-image
 * 
 * Body: { prompt: string, size?: string, asset_id?: string, campaign_index?: number }
 */
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const TABLE = process.env.DYNAMODB_TABLE_PROJECTS;
const BUCKET = process.env.ADS_BUCKET;
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;

const s3 = new S3Client({});

const VALID_SIZES = ['1024x1024', '960x1280', '720x1280', '768x1024', '1280x720'];

exports.handler = async (event) => {
  try {
    const user = getUserFromEvent(event);
    if (!user) return res.unauthorized();

    const projectId = event.pathParameters?.id;
    if (!projectId) return res.badRequest('Project ID is required');

    const body = JSON.parse(event.body || '{}');
    const { prompt, size = '1024x1024', asset_id, campaign_index = 0 } = body;

    if (!prompt || prompt.trim().length < 10) {
      return res.badRequest('Prompt must be at least 10 characters');
    }

    if (!VALID_SIZES.includes(size)) {
      return res.badRequest(`Invalid size. Valid: ${VALID_SIZES.join(', ')}`);
    }

    // Verify project ownership
    const result = await ddb.send(new GetCommand({ TableName: TABLE, Key: { project_id: projectId } }));
    if (!result.Item) return res.notFound('Project not found');
    if (result.Item.user_id !== user.user_id) return res.forbidden();

    // Call SiliconFlow API
    const sfResponse = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Kwai-Kolors/Kolors',
        prompt,
        image_size: size,
        batch_size: 1,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      }),
    });

    if (!sfResponse.ok) {
      const err = await sfResponse.text();
      console.error('SiliconFlow error:', sfResponse.status, err);
      return res.serverError(`Image generation failed: ${sfResponse.status}`);
    }

    const sfData = await sfResponse.json();
    const imageUrl = sfData.images?.[0]?.url;
    if (!imageUrl) {
      return res.serverError('No image URL returned from SiliconFlow');
    }

    // Download image and upload to S3
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return res.serverError('Failed to download generated image');
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const s3Key = `projects/${projectId}/creatives/${Date.now()}.png`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: 'image/png',
    }));

    const publicUrl = `${CLOUDFRONT_URL}/${s3Key}`;

    // Optionally save the image URL to the campaign asset
    if (asset_id) {
      const project = result.Item;
      const currentAssets = project.assets || [];
      const assetIndex = currentAssets.findIndex(a => a.id === asset_id);
      if (assetIndex >= 0) {
        const idx = parseInt(campaign_index, 10) || 0;
        if (currentAssets[assetIndex].items[idx]) {
          if (!currentAssets[assetIndex].items[idx].generated_images) {
            currentAssets[assetIndex].items[idx].generated_images = [];
          }
          currentAssets[assetIndex].items[idx].generated_images.push({
            url: publicUrl,
            prompt,
            size,
            created_at: new Date().toISOString(),
          });
          await ddb.send(new UpdateCommand({
            TableName: TABLE,
            Key: { project_id: projectId },
            UpdateExpression: 'SET assets = :assets, updated_at = :now',
            ExpressionAttributeValues: { ':assets': currentAssets, ':now': new Date().toISOString() },
          }));
        }
      }
    }

    return res.ok({ status: 'success', image_url: publicUrl, prompt, size });
  } catch (err) {
    console.error('generateImage error:', err);
    return res.serverError(err.message);
  }
};
