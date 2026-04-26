import html2canvas from 'html2canvas';

import type { LabVisionState } from './agentverseChat';
import type { ElementData } from '../types';

const compactElement = (element?: ElementData | null) =>
  element
    ? {
        symbol: element.symbol,
        name: element.name,
      }
    : null;

export const buildLabVisionState = ({
  status,
  leftElement,
  rightElement,
  combinedElement,
  shelf,
  dashboardOpen,
}: {
  status: string;
  leftElement: ElementData;
  rightElement: ElementData;
  combinedElement: ElementData | null;
  shelf: ElementData[];
  dashboardOpen: boolean;
}): LabVisionState => ({
  status,
  leftElement: compactElement(leftElement) ?? undefined,
  rightElement: compactElement(rightElement) ?? undefined,
  combinedElement: compactElement(combinedElement),
  shelf: shelf.map(element => ({
    symbol: element.symbol,
    name: element.name,
  })),
  dashboardOpen,
});

export async function captureLabScreenshot() {
  const target = document.getElementById('reptile-chemica-lab') ?? document.body;
  const ignoredNodes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-vision-ignore="true"]')
  );
  const previousVisibility = ignoredNodes.map(node => node.style.visibility);
  const hadChatOpenClass = document.body.classList.contains('reptile-chat-open');

  ignoredNodes.forEach(node => {
    node.style.visibility = 'hidden';
  });
  document.body.classList.remove('reptile-chat-open');

  try {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    const canvas = await html2canvas(target, {
      backgroundColor: '#020607',
      ignoreElements: element => element.getAttribute('data-vision-ignore') === 'true',
      logging: false,
      scale: 0.45,
      useCORS: true,
    });
    const compactCanvas = document.createElement('canvas');
    const maxWidth = 960;
    const ratio = Math.min(1, maxWidth / canvas.width);
    compactCanvas.width = Math.round(canvas.width * ratio);
    compactCanvas.height = Math.round(canvas.height * ratio);
    compactCanvas
      .getContext('2d')
      ?.drawImage(canvas, 0, 0, compactCanvas.width, compactCanvas.height);

    return compactCanvas.toDataURL('image/jpeg', 0.62);
  } finally {
    ignoredNodes.forEach((node, index) => {
      node.style.visibility = previousVisibility[index];
    });
    if (hadChatOpenClass) {
      document.body.classList.add('reptile-chat-open');
    }
  }
}
