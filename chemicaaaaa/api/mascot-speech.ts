import type { IncomingMessage, ServerResponse } from 'http';

const readRequestBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_v3';

  if (!elevenLabsKey) {
    sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured' });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(req)) as { text?: string };
    const text = body.text?.trim().slice(0, 360);

    if (!text) {
      sendJson(res, 400, { error: 'Missing text' });
      return;
    }

    const speechResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey,
        },
        body: JSON.stringify({
          text,
          model_id: elevenLabsModelId,
          voice_settings: {
            stability: 0.32,
            similarity_boost: 0.78,
            style: 0.75,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!speechResponse.ok) {
      sendJson(res, speechResponse.status, { error: 'ElevenLabs speech request failed' });
      return;
    }

    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.end(audioBuffer);
  } catch (error) {
    console.error('Mascot speech API error:', error);
    sendJson(res, 500, { error: 'Mascot speech API failed' });
  }
}
