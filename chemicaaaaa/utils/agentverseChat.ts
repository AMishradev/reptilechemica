export interface AgentverseChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LabVisionState {
  status: string;
  leftElement?: {
    symbol: string;
    name: string;
  };
  rightElement?: {
    symbol: string;
    name: string;
  };
  combinedElement?: {
    symbol: string;
    name: string;
  } | null;
  shelf: Array<{
    symbol: string;
    name: string;
  }>;
  dashboardOpen: boolean;
}

export interface AgentverseBrainContext {
  labState?: LabVisionState;
  screenshotDataUrl?: string;
}

export async function askAgentverseBrain(
  messages: AgentverseChatMessage[],
  context?: AgentverseBrainContext
): Promise<string> {
  const response = await fetch('/api/agentverse-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...context }),
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
