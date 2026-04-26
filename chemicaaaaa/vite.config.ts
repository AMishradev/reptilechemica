import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const readRequestBody = (req: import('http').IncomingMessage, maxLength = 10_000) =>
  new Promise<string>((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxLength) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const sendJson = (res: import('http').ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const atomisSystemPrompt =
  'You are Atomis, the Reptile Chemica lab guide. You only answer questions about the Reptile Chemica system-design lab, computer networking, distributed systems, cloud architecture, and system design. Keep answers under 90 words, friendly, direct, and plain text with no emoji, markdown, bullets, or bold markers. In this lab, valid fusions include APP + CACHE = FAST / Cached Service, APP + DB = CRUD, APP + QUEUE = ASYNC, LB + APP = POOL, API + APP = SVC, API + LB = ROUTE, DB + CACHE = READ, QUEUE + DB = JOBDB, CLIENT + DNS = EDGE, CDN + OBJ = MEDIA, CDN + API = BFF, CLIENT + CDN = STATIC, FAST + ASYNC = SCALE. If a user says APP and CACHE cannot combine, explain that they can: select the APP and CACHE lab components exactly, then perform the snap/fusion gesture.';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Support both GEMINI_API_KEY and VITE_GEMINI_API_KEY
    const geminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    const elevenLabsKey = env.ELEVENLABS_API_KEY;
    const elevenLabsVoiceId = env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
    const elevenLabsModelId = env.ELEVENLABS_MODEL_ID || 'eleven_v3';
    const asiKey = env.ASI_API_KEY;
    const asiModel = env.ASI_MODEL || 'asi1-mini';
     
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'mascot-elevenlabs-dev-proxy',
          configureServer(server) {
            server.middlewares.use('/api/mascot-speech', async (req, res) => {
              if (req.method !== 'POST') {
                sendJson(res, 405, { error: 'Method not allowed' });
                return;
              }

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
                console.error('Mascot speech proxy error:', error);
                sendJson(res, 500, { error: 'Mascot speech proxy failed' });
              }
            });
          },
        },
        {
          name: 'atomis-agentverse-chat-dev-proxy',
          configureServer(server) {
            server.middlewares.use('/api/agentverse-chat', async (req, res) => {
              if (req.method !== 'POST') {
                sendJson(res, 405, { error: 'Method not allowed' });
                return;
              }

              if (!asiKey) {
                sendJson(res, 503, { error: 'ASI_API_KEY is not configured' });
                return;
              }

              try {
                const body = JSON.parse(await readRequestBody(req, 30_000)) as {
                  text?: string;
                  messages?: Array<{ role?: string; content?: string }>;
                };
                const sourceMessages = Array.isArray(body.messages)
                  ? body.messages
                  : [{ role: 'user', content: body.text }];
                const messages = sourceMessages
                  .filter(item => item.role === 'user' || item.role === 'assistant')
                  .map(item => ({
                    role: item.role as 'user' | 'assistant',
                    content: (item.content ?? '').trim().slice(0, 2_000),
                  }))
                  .filter(item => item.content)
                  .slice(-12);

                if (!messages.length || messages[messages.length - 1].role !== 'user') {
                  sendJson(res, 400, { error: 'Missing user message' });
                  return;
                }

                sendJson(res, 200, { reply: `received ${messages.length} messages with model ${asiModel}` });
              } catch (error) {
                console.error('Agentverse chat proxy error:', error);
                sendJson(res, 500, { error: 'Agentverse chat proxy failed' });
              }
            });
          },
        },
      ],
      optimizeDeps: {
        exclude: ['@react-three/drei'],
      },
      css: {
        postcss: {
          plugins: [],
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        // Inject as a global constant that can be accessed
        '__GEMINI_API_KEY__': JSON.stringify(geminiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
