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
  const { ad_id, video_url } = body;

  if (!ad_id || !video_url) return res.badRequest('ad_id and video_url required');

  try {
    console.log('Transcribing video', { ad_id, video_url: video_url.substring(0, 80) });

    // Step 1: Download video from URL
    const videoResponse = await fetch(video_url);
    if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.status}`);

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
    const extension = contentType.includes('mp4') ? 'mp4' : contentType.includes('webm') ? 'webm' : 'mp4';

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
      UpdateExpression: 'SET video_transcript = :t, primary_text = if_not_exists(primary_text, :t)',
      ExpressionAttributeValues: { ':t': transcript },
    }));

    return res.ok({
      transcript,
      s3_key: s3Key,
      message: 'Video transcribed successfully',
    });

  } catch (err) {
    console.error('Transcription failed', { ad_id, error: err.message });
    return res.serverError(`Transcription failed: ${err.message}`);
  }
};
