import type { LabChatMessage } from './asiLabChat';

export type AgentverseChatMessage = LabChatMessage;

export async function askAgentverseBrain(messages: AgentverseChatMessage[]): Promise<string> {
  const response = await fetch('/api/agentverse-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const payload = await response.json().catch(() => null) as { reply?: string; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Agentverse chat request failed');
  }

  const reply = payload?.reply?.trim();
  if (!reply) {
    throw new Error('Agentverse chat returned an empty reply');
  }

  return reply;
}
