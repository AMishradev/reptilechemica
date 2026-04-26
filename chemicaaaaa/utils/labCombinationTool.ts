export interface CombinationLookupResult {
  found: boolean;
  elementA: string;
  elementB: string;
  resultSymbol?: string;
  resultName?: string;
  description?: string;
  guidance: string;
}

const combinations: Record<string, Omit<CombinationLookupResult, 'found' | 'elementA' | 'elementB' | 'guidance'>> = {
  'CLIENT+DNS': {
    resultSymbol: 'EDGE',
    resultName: 'Edge Entry',
    description: 'A user request that can resolve a service endpoint and enter the platform.',
  },
  'CDN+OBJ': {
    resultSymbol: 'MEDIA',
    resultName: 'Media Delivery',
    description: 'A static asset path optimized for cacheable, low-latency delivery.',
  },
  'APP+LB': {
    resultSymbol: 'POOL',
    resultName: 'Service Pool',
    description: 'A horizontally scaled set of application servers behind traffic balancing.',
  },
  'API+APP': {
    resultSymbol: 'SVC',
    resultName: 'Backend Service',
    description: 'A routed service boundary that exposes business capabilities through an API.',
  },
  'APP+DB': {
    resultSymbol: 'CRUD',
    resultName: 'Transactional Service',
    description: 'A service that reads and writes durable application data.',
  },
  'APP+CACHE': {
    resultSymbol: 'FAST',
    resultName: 'Cached Service',
    description: 'A low-latency service path backed by cached reads.',
  },
  'APP+QUEUE': {
    resultSymbol: 'ASYNC',
    resultName: 'Async Worker Flow',
    description: 'A resilient background-processing path for jobs outside the request cycle.',
  },
  'API+LB': {
    resultSymbol: 'ROUTE',
    resultName: 'Routed Traffic',
    description: 'Ingress traffic routed to healthy service capacity.',
  },
  'CACHE+DB': {
    resultSymbol: 'READ',
    resultName: 'Read Path',
    description: 'A data access pattern that can serve hot reads from cache and fall back to storage.',
  },
  'DB+QUEUE': {
    resultSymbol: 'JOBDB',
    resultName: 'Job Persistence',
    description: 'Queued work with durable progress, retry, and result tracking.',
  },
  'API+CDN': {
    resultSymbol: 'BFF',
    resultName: 'Frontend Gateway',
    description: 'A user-facing gateway that can mix cached assets with dynamic API calls.',
  },
  'CDN+CLIENT': {
    resultSymbol: 'STATIC',
    resultName: 'Static Frontend',
    description: 'A frontend delivery path served close to users through edge caching.',
  },
  'EDGE+ROUTE': {
    resultSymbol: 'WEBAPP',
    resultName: 'Web Application',
    description: 'A complete entry path from user request through edge routing into backend capacity.',
  },
  'CRUD+SVC': {
    resultSymbol: 'APIAPP',
    resultName: 'API Application',
    description: 'A backend application that exposes APIs and persists transactional data.',
  },
  'ASYNC+FAST': {
    resultSymbol: 'SCALE',
    resultName: 'Scalable Service',
    description: 'A service that combines low-latency reads with asynchronous background processing.',
  },
  'MEDIA+STATIC': {
    resultSymbol: 'CONTENT',
    resultName: 'Content Platform',
    description: 'A system for serving frontend assets and user media through durable storage and edge delivery.',
  },
  'CRUD+READ': {
    resultSymbol: 'DATA',
    resultName: 'Data Platform',
    description: 'A data layer that supports durable writes and optimized read access.',
  },
  'ASYNC+JOBDB': {
    resultSymbol: 'WORKER',
    resultName: 'Worker Platform',
    description: 'A background processing system with queued work, durable state, and retryable execution.',
  },
};

const aliases: Record<string, string> = {
  APPLICATION: 'APP',
  APPSERVER: 'APP',
  APPP: 'APP',
  SERVER: 'APP',
  DATABASE: 'DB',
  DBMS: 'DB',
  CACHING: 'CACHE',
  LOADBALANCER: 'LB',
  BALANCER: 'LB',
  APIGATEWAY: 'API',
  GATEWAY: 'API',
  OBJECTSTORE: 'OBJ',
  OBJECTSTORAGE: 'OBJ',
};

export const lookupCombinationTool = {
  type: 'function',
  function: {
    name: 'lookup_combination',
    description: 'Look up the Reptile Systems composition result for two architecture component symbols or names.',
    parameters: {
      type: 'object',
      properties: {
        element_a: {
          type: 'string',
          description: 'The first architecture component, such as APP, CACHE, DB, LB, API, EDGE, or ROUTE.',
        },
        element_b: {
          type: 'string',
          description: 'The second architecture component, such as APP, CACHE, DB, LB, API, EDGE, or ROUTE.',
        },
      },
      required: ['element_a', 'element_b'],
      additionalProperties: false,
    },
  },
};

export const normalizeElementSymbol = (value: string) => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (aliases[compact]) return aliases[compact];
  if (compact.startsWith('APP')) return 'APP';
  if (compact.startsWith('CACHE')) return 'CACHE';
  return compact;
};

const pairKey = (elementA: string, elementB: string) =>
  [normalizeElementSymbol(elementA), normalizeElementSymbol(elementB)].sort().join('+');

export function lookupCombination(elementA: string, elementB: string): CombinationLookupResult {
  const normalizedA = normalizeElementSymbol(elementA);
  const normalizedB = normalizeElementSymbol(elementB);
  const result = combinations[pairKey(normalizedA, normalizedB)];

  if (!result) {
    return {
      found: false,
      elementA: normalizedA,
      elementB: normalizedB,
      guidance: `No known Reptile Systems composition exists for ${normalizedA} + ${normalizedB}. Try selecting a valid pair from the component shelf, then use the snap/compose gesture.`,
    };
  }

  return {
    found: true,
    elementA: normalizedA,
    elementB: normalizedB,
    ...result,
    guidance: `${normalizedA} + ${normalizedB} composes into ${result.resultSymbol} / ${result.resultName}. Select those two architecture components exactly, then perform the snap/compose gesture.`,
  };
}

export function shouldUseCombinationTool(text: string) {
  const normalized = text.toLowerCase();
  const mentionsFusionAction = /combine|compose|composition|fusion|fuse|mix|pair|merge|snap|\+/.test(normalized);
  const componentMentions = [
    /\bapp\b|application|appserver/,
    /\bcache\b|caching/,
    /\bdb\b|database/,
    /\blb\b|load\s*balancer|balancer/,
    /\bapi\b|gateway/,
    /\bqueue\b/,
    /\bcdn\b/,
    /\bdns\b/,
    /\bclient\b/,
    /\bobj\b|object\s*stor/,
    /\bedge\b/,
    /\broute\b/,
    /\bfast\b/,
    /\basync\b/,
    /\bcrud\b/,
    /\bread\b/,
    /\bsvc\b/,
    /\bmedia\b/,
    /\bstatic\b/,
    /\bjobdb\b/,
  ].filter(pattern => pattern.test(normalized)).length;
  const asksAboutTwoComponents =
    componentMentions >= 2 &&
    /add|with|between|relate|layer|stuck|wrong|can't|cant|cannot|doesn't|dont|do not|won't|into/.test(
      normalized
    );

  return mentionsFusionAction || asksAboutTwoComponents;
}
