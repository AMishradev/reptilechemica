import type { IncomingMessage, ServerResponse } from 'http';

const atomisSystemPrompt =
  'You are Atomis, the Reptile Chemica lab guide. You only answer questions about the Reptile Chemica system-design lab, computer networking, distributed systems, cloud architecture, and system design. Keep answers under 90 words, friendly, direct, and plain text with no emoji, markdown, bullets, or bold markers. In this lab, valid fusions include APP + CACHE = FAST / Cached Service, APP + DB = CRUD, APP + QUEUE = ASYNC, LB + APP = POOL, API + APP = SVC, API + LB = ROUTE, DB + CACHE = READ, QUEUE + DB = JOBDB, CLIENT + DNS = EDGE, CDN + OBJ = MEDIA, CDN + API = BFF, CLIENT + CDN = STATIC, FAST + ASYNC = SCALE. If a user says APP and CACHE cannot combine, explain that they can: select the APP and CACHE lab components exactly, then perform the snap/fusion gesture.';

const readRequestBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 30_000) {
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

  const asiKey = process.env.ASI_API_KEY;
  const asiModel = process.env.ASI_MODEL || 'asi1-mini';

  if (!asiKey) {
    sendJson(res, 503, { error: 'ASI_API_KEY is not configured' });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(req)) as {
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

    const asiResponse = await fetch('https://api.asi1.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${asiKey}`,
      },
      body: JSON.stringify({
        model: asiModel,
        messages: [
          { role: 'system', content: atomisSystemPrompt },
          ...messages,
        ],
        max_tokens: 220,
        temperature: 0.35,
      }),
    });
    const payload = await asiResponse.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;

    if (!asiResponse.ok) {
      console.error('ASI:One chat API error:', payload?.error?.message ?? asiResponse.statusText);
      sendJson(res, asiResponse.status, { error: 'ASI:One chat request failed' });
      return;
    }

    const reply = payload?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      sendJson(res, 502, { error: 'ASI:One returned an empty response' });
      return;
    }

    sendJson(res, 200, { reply });
  } catch (error) {
    console.error('Agentverse chat API error:', error);
    sendJson(res, 500, { error: 'Agentverse chat API failed' });
  }
}
