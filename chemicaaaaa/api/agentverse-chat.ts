import type { IncomingMessage, ServerResponse } from 'http';

import { createAsiLabReply, type LabChatMessage } from '../utils/asiLabChat';

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
    const messages: LabChatMessage[] = sourceMessages
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

    const { reply, toolUsed, toolResult } = await createAsiLabReply(
      asiKey,
      asiModel,
      messages
    );

    sendJson(res, 200, { reply, toolUsed, toolResult });
  } catch (error) {
    console.error('Agentverse chat API error:', error);
    sendJson(res, 500, { error: 'Agentverse chat API failed' });
  }
}
