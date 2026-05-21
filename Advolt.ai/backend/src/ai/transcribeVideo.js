/**
 * Video Transcription Lambda
 * Downloads video from URL → uploads to S3 (audio/ prefix) → sends to Groq Whisper → returns transcript
 */
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = require('/opt/nodejs/lib/dynamo');
const res = require('/opt/nodejs/lib/response');
const { getUserFromEvent } = require('/opt/nodejs/lib/getUserFromEvent');

const s3 = new S3Client({});

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return res.unauthorized();

  const body = JSON.parse(event.body || '{}');
  const { ad_id, video_url, audio_base64, format } = body;

  if (!ad_id || (!video_url && !audio_base64)) return res.badRequest('ad_id and video_url or audio_base64 required');

  const TRANSCRIBE_COST = 30;

  // Check and deduct tokens
  const userResult = await ddb.send(new (require('@aws-sdk/lib-dynamodb').GetCommand)({
    TableName: process.env.DYNAMODB_TABLE_USERS,
    Key: { user_id: user.user_id },
  }));
  if (!userResult.Item) return res.unauthorized();

  const { getUserTokenBalance } = require('/opt/nodejs/lib/tokenCosts');
  const balance = getUserTokenBalance(userResult.Item);

  if (userResult.Item.subscription_plan === 'pro' && userResult.Item.ai_provider !== 'own_key') {
    if (balance.total < TRANSCRIBE_COST) {
      return res.paymentRequired(JSON.stringify({ error: 'insufficient_tokens', required: TRANSCRIBE_COST, available: balance.total }));
    }
    const deductMonthly = Math.min(balance.monthly, TRANSCRIBE_COST);
    const deductPurchased = TRANSCRIBE_COST - deductMonthly;
    const updates = [];
    const values = {};
    if (deductMonthly > 0) { updates.push('monthly_tokens = monthly_tokens - :md'); values[':md'] = deductMonthly; }
    if (deductPurchased > 0) { updates.push('purchased_tokens = purchased_tokens - :pd'); values[':pd'] = deductPurchased; }
    if (updates.length) {
      await ddb.send(new UpdateCommand({ TableName: process.env.DYNAMODB_TABLE_USERS, Key: { user_id: user.user_id }, UpdateExpression: `SET ${updates.join(', ')}`, ExpressionAttributeValues: values }));
    }
  }

  try {
    console.log('Transcribing', { ad_id, hasVideoUrl: !!video_url, hasAudio: !!audio_base64 });

    let videoBuffer;
    let contentType;
    let extension;

    if (audio_base64) {
      // Audio uploaded directly from extension recording
      videoBuffer = Buffer.from(audio_base64, 'base64');
      contentType = `audio/${format || 'webm'}`;
      extension = format || 'webm';
    } else {
      // Download video from URL
      const videoResponse = await fetch(video_url);
      if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.status}`);
      videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      contentType = videoResponse.headers.get('content-type') || 'video/mp4';
      extension = contentType.includes('mp4') ? 'mp4' : contentType.includes('webm') ? 'webm' : 'mp4';
    }

    // Step 2: Upload to S3 under audio/ prefix (auto-deletes in 30 days)
    const s3Key = `audio/${user.user_id}/${ad_id}.${extension}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.ADS_BUCKET,
      Key: s3Key,
      Body: videoBuffer,
      ContentType: contentType,
    }));

    console.log('Video uploaded to S3', { s3Key, size: videoBuffer.length });

    // Step 3: Send to Groq Whisper for transcription
    const formData = new FormData();
    const blob = new Blob([videoBuffer], { type: contentType });
    formData.append('file', blob, `video.${extension}`);
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'text');

    const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const err = await whisperResponse.text();
      throw new Error(`Groq Whisper error: ${whisperResponse.status} — ${err}`);
    }

    const transcript = await whisperResponse.text();
    console.log('Transcription complete', { ad_id, length: transcript.length });

    // Step 4: Update the ad record with the transcript
    await ddb.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_ADS,
      Key: { ad_id },
      UpdateExpression: 'SET video_transcript = :t',
      ExpressionAttributeValues: { ':t': transcript },
    }));

    return res.ok({
      transcript,
      s3_key: s3Key,
      message: 'Video transcribed successfully',
    });

  } catch (err) {
    console.error('Transcription failed', { ad_id, error: err.message });
    // Refund tokens on failure
    if (userResult.Item.subscription_plan === 'pro' && userResult.Item.ai_provider !== 'own_key') {
      await ddb.send(new UpdateCommand({ TableName: process.env.DYNAMODB_TABLE_USERS, Key: { user_id: user.user_id }, UpdateExpression: 'ADD monthly_tokens :refund', ExpressionAttributeValues: { ':refund': TRANSCRIBE_COST } }));
    }
    return res.serverError(`Transcription failed: ${err.message}`);
  }
};
