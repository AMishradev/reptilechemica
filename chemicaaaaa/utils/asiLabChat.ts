import {
  lookupCombination,
  lookupCombinationTool,
  shouldUseCombinationTool,
  type CombinationLookupResult,
} from './labCombinationTool';

export type LabChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AsiLabReply = {
  reply: string;
  toolUsed: boolean;
  toolResult?: CombinationLookupResult;
};

type AsiToolCall = {
  id: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type AsiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: AsiToolCall[];
  tool_call_id?: string;
};

type AsiPayload = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: AsiToolCall[];
    };
  }>;
  error?: {
    message?: string;
  };
};

const atomisSystemPrompt =
  'You are Reptile Chemica, the Reptile Chemica lab guide. You only answer questions about the Reptile Chemica system-design lab, computer networking, distributed systems, cloud architecture, and system design. Keep answers under 90 words, friendly, direct, and plain text with no emoji, markdown, bullets, or bold markers. Use the lookup_combination tool whenever the user asks whether lab components combine, what a fusion creates, or how two components relate in the lab. After the tool returns, explain the exact fusion result and the next lab action. If APP and CACHE seem stuck, tell the user to select the APP and CACHE lab components exactly, then perform the snap/fusion gesture.';

const parseToolArguments = (value?: string) => {
  try {
    const parsed = JSON.parse(value || '{}') as {
      element_a?: string;
      element_b?: string;
    };

    return {
      element_a: String(parsed.element_a || ''),
      element_b: String(parsed.element_b || ''),
    };
  } catch {
    return { element_a: '', element_b: '' };
  }
};

const requestAsi = async (
  asiKey: string,
  asiModel: string,
  messages: AsiMessage[],
  withCombinationTool: boolean
) => {
  const body: Record<string, unknown> = {
    model: asiModel,
    messages,
    max_tokens: 220,
    temperature: 0.35,
  };

  if (withCombinationTool) {
    body.tools = [lookupCombinationTool];
    body.tool_choice = {
      type: 'function',
      function: { name: 'lookup_combination' },
    };
  }

  const response = await fetch('https://api.asi1.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${asiKey}`,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as AsiPayload | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || response.statusText);
  }

  return payload;
};

export async function createAsiLabReply(
  asiKey: string,
  asiModel: string,
  messages: LabChatMessage[]
): Promise<AsiLabReply> {
  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user');
  const baseMessages: AsiMessage[] = [
    { role: 'system', content: atomisSystemPrompt },
    ...messages,
  ];
  const shouldCallTool = Boolean(lastUserMessage && shouldUseCombinationTool(lastUserMessage.content));
  const firstPayload = await requestAsi(asiKey, asiModel, baseMessages, shouldCallTool);
  const firstMessage = firstPayload?.choices?.[0]?.message;
  const toolCall = firstMessage?.tool_calls?.find(
    call => call.function?.name === 'lookup_combination'
  );

  if (!toolCall) {
    const reply = firstMessage?.content?.trim();
    if (!reply) {
      throw new Error('ASI:One returned an empty response');
    }

    return { reply, toolUsed: false };
  }

  const args = parseToolArguments(toolCall.function?.arguments);
  const toolResult = lookupCombination(args.element_a, args.element_b);
  const finalPayload = await requestAsi(
    asiKey,
    asiModel,
    [
      ...baseMessages,
      {
        role: 'assistant',
        content: firstMessage?.content ?? null,
        tool_calls: [toolCall],
      },
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      },
    ],
    false
  );
  const reply = finalPayload?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('ASI:One returned an empty response');
  }

  return { reply, toolUsed: true, toolResult };
}
