import { ElementData, CombinationResult } from "./types";

export const ELEMENTS: ElementData[] = [
  {
    symbol: "CLIENT",
    name: "Client",
    color: "#38BDF8",
    atomicNumber: 1,
    description: "The user-facing entry point that starts requests into the system.",
  },
  {
    symbol: "DNS",
    name: "DNS",
    color: "#A78BFA",
    atomicNumber: 2,
    description: "Translates human-readable domains into the network addresses clients can reach.",
  },
  {
    symbol: "CDN",
    name: "CDN",
    color: "#22D3EE",
    atomicNumber: 3,
    description: "Caches static content close to users to reduce latency and origin traffic.",
  },
  {
    symbol: "LB",
    name: "Load Balancer",
    color: "#34D399",
    atomicNumber: 4,
    description: "Distributes traffic across healthy backend instances.",
  },
  {
    symbol: "API",
    name: "API Gateway",
    color: "#F472B6",
    atomicNumber: 5,
    description: "Routes, authenticates, and shapes requests before they reach services.",
  },
  {
    symbol: "APP",
    name: "App Server",
    color: "#FACC15",
    atomicNumber: 6,
    description: "Runs the core business logic for the product.",
  },
  {
    symbol: "DB",
    name: "Database",
    color: "#FB923C",
    atomicNumber: 7,
    description: "Stores durable source-of-truth data for the application.",
  },
  {
    symbol: "CACHE",
    name: "Cache",
    color: "#4ADE80",
    atomicNumber: 8,
    description: "Keeps frequently accessed data in fast storage to reduce load and latency.",
  },
  {
    symbol: "QUEUE",
    name: "Queue",
    color: "#60A5FA",
    atomicNumber: 9,
    description: "Buffers asynchronous work so services can process jobs reliably.",
  },
  {
    symbol: "OBJ",
    name: "Object Store",
    color: "#E879F9",
    atomicNumber: 10,
    description: "Stores large binary assets such as images, videos, backups, and logs.",
  },
];

export const COMBINATIONS: CombinationResult[] = [
  {
    elements: ["CLIENT", "DNS"],
    result: {
      symbol: "EDGE",
      name: "Edge Entry",
      color: "#38BDF8",
      atomicNumber: 0,
      level: 2,
      description: "A user request that can resolve a service endpoint and enter the platform.",
    },
  },
  {
    elements: ["CDN", "OBJ"],
    result: {
      symbol: "MEDIA",
      name: "Media Delivery",
      color: "#C084FC",
      atomicNumber: 0,
      level: 2,
      description: "A static asset path optimized for cacheable, low-latency delivery.",
    },
  },
  {
    elements: ["LB", "APP"],
    result: {
      symbol: "POOL",
      name: "Service Pool",
      color: "#34D399",
      atomicNumber: 0,
      level: 2,
      description: "A horizontally scaled set of application servers behind traffic balancing.",
    },
  },
  {
    elements: ["API", "APP"],
    result: {
      symbol: "SVC",
      name: "Backend Service",
      color: "#F472B6",
      atomicNumber: 0,
      level: 2,
      description: "A routed service boundary that exposes business capabilities through an API.",
    },
  },
  {
    elements: ["APP", "DB"],
    result: {
      symbol: "CRUD",
      name: "Transactional Service",
      color: "#F97316",
      atomicNumber: 0,
      level: 2,
      description: "A service that reads and writes durable application data.",
    },
  },
  {
    elements: ["APP", "CACHE"],
    result: {
      symbol: "FAST",
      name: "Cached Service",
      color: "#4ADE80",
      atomicNumber: 0,
      level: 2,
      description: "A low-latency service path backed by cached reads.",
    },
  },
  {
    elements: ["APP", "QUEUE"],
    result: {
      symbol: "ASYNC",
      name: "Async Worker Flow",
      color: "#60A5FA",
      atomicNumber: 0,
      level: 2,
      description: "A resilient background-processing path for jobs outside the request cycle.",
    },
  },
  {
    elements: ["API", "LB"],
    result: {
      symbol: "ROUTE",
      name: "Routed Traffic",
      color: "#2DD4BF",
      atomicNumber: 0,
      level: 2,
      description: "Ingress traffic routed to healthy service capacity.",
    },
  },
  {
    elements: ["DB", "CACHE"],
    result: {
      symbol: "READ",
      name: "Read Path",
      color: "#A3E635",
      atomicNumber: 0,
      level: 2,
      description: "A data access pattern that can serve hot reads from cache and fall back to storage.",
    },
  },
  {
    elements: ["QUEUE", "DB"],
    result: {
      symbol: "JOBDB",
      name: "Job Persistence",
      color: "#818CF8",
      atomicNumber: 0,
      level: 2,
      description: "Queued work with durable progress, retry, and result tracking.",
    },
  },
  {
    elements: ["CDN", "API"],
    result: {
      symbol: "BFF",
      name: "Frontend Gateway",
      color: "#06B6D4",
      atomicNumber: 0,
      level: 2,
      description: "A user-facing gateway that can mix cached assets with dynamic API calls.",
    },
  },
  {
    elements: ["CLIENT", "CDN"],
    result: {
      symbol: "STATIC",
      name: "Static Frontend",
      color: "#67E8F9",
      atomicNumber: 0,
      level: 2,
      description: "A frontend delivery path served close to users through edge caching.",
    },
  },
  {
    elements: ["EDGE", "ROUTE"],
    result: {
      symbol: "WEBAPP",
      name: "Web Application",
      color: "#38BDF8",
      atomicNumber: 0,
      level: 3,
      description: "A complete entry path from user request through edge routing into backend capacity.",
    },
  },
  {
    elements: ["SVC", "CRUD"],
    result: {
      symbol: "APIAPP",
      name: "API Application",
      color: "#FB7185",
      atomicNumber: 0,
      level: 3,
      description: "A backend application that exposes APIs and persists transactional data.",
    },
  },
  {
    elements: ["FAST", "ASYNC"],
    result: {
      symbol: "SCALE",
      name: "Scalable Service",
      color: "#22C55E",
      atomicNumber: 0,
      level: 3,
      description: "A service that combines low-latency reads with asynchronous background processing.",
    },
  },
  {
    elements: ["MEDIA", "STATIC"],
    result: {
      symbol: "CONTENT",
      name: "Content Platform",
      color: "#A78BFA",
      atomicNumber: 0,
      level: 3,
      description: "A system for serving frontend assets and user media through durable storage and edge delivery.",
    },
  },
  {
    elements: ["READ", "CRUD"],
    result: {
      symbol: "DATA",
      name: "Data Platform",
      color: "#F59E0B",
      atomicNumber: 0,
      level: 3,
      description: "A data layer that supports durable writes and optimized read access.",
    },
  },
  {
    elements: ["JOBDB", "ASYNC"],
    result: {
      symbol: "WORKER",
      name: "Worker Platform",
      color: "#818CF8",
      atomicNumber: 0,
      level: 3,
      description: "A background processing system with queued work, durable state, and retryable execution.",
    },
  },
];

export const GESTURE_COOLDOWN = 1000; // ms
