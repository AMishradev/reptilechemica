import type { LabVisionState } from './agentverseChat';

type OpenRouterVisionPayload = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

const formatLabState = (labState?: LabVisionState) => {
  if (!labState) return 'No structured lab state was provided.';

  return JSON.stringify(
    {
      status: labState.status,
      leftElement: labState.leftElement,
      rightElement: labState.rightElement,
      combinedElement: labState.combinedElement,
      shelf: labState.shelf,
      dashboardOpen: labState.dashboardOpen,
    },
    null,
    2
  );
};

const isValidImageDataUrl = (value?: string) =>
  Boolean(value && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value));

export async function createOpenRouterVisionContext({
  apiKey,
  model,
  labState,
  screenshotDataUrl,
}: {
  apiKey?: string;
  model: string;
  labState?: LabVisionState;
  screenshotDataUrl?: string;
}) {
  if (!apiKey) return undefined;

  const content: Array<
    | {
        type: 'text';
        text: string;
      }
    | {
        type: 'image_url';
        image_url: {
          url: string;
        };
      }
  > = [
    {
      type: 'text',
      text:
        'Describe the current Reptile Chemica lab screen for a reasoning agent. ' +
        'Focus only on visible lab state: selected left/right components, shelf components, ' +
        'fusion result, status message, and likely next action. Be concise, factual, ' +
        'and do not invent hidden state.\n\nStructured lab state:\n' +
        formatLabState(labState),
    },
  ];

  if (isValidImageDataUrl(screenshotDataUrl)) {
    content.push({
      type: 'image_url',
      image_url: {
        url: screenshotDataUrl as string,
      },
    });
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/AMishradev/reptilechemica',
      'X-Title': 'Reptile Chemica',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a vision context extractor. Return at most 70 words. ' +
            'No markdown. No advice beyond the next obvious lab action.',
        },
        {
          role: 'user',
          content,
        },
      ],
      max_tokens: 120,
      temperature: 0.1,
    }),
  });
  const payload = (await response.json().catch(() => null)) as OpenRouterVisionPayload | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || response.statusText);
  }

  return payload?.choices?.[0]?.message?.content?.trim() || undefined;
}
