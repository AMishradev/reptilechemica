
import { ElementData } from '../types';

export function getMascotFact(el: ElementData): string {
  // Base Components (Level 1)
  if (el.symbol === 'CLIENT') return "The client is where demand begins: browser, app, device, or another service making a request.";
  if (el.symbol === 'DNS') return "DNS is the system's address book. It turns names into reachable network targets before traffic can flow.";
  if (el.symbol === 'CDN') return "A CDN keeps cacheable content near users, which improves latency and reduces pressure on the origin.";
  if (el.symbol === 'LB') return "A load balancer spreads requests across healthy instances so one server does not become the bottleneck.";
  if (el.symbol === 'API') return "An API gateway is the front door for backend capabilities: routing, auth, rate limits, and request shaping.";
  if (el.symbol === 'APP') return "The app server owns product behavior and business logic. It usually coordinates reads, writes, and external calls.";
  if (el.symbol === 'DB') return "The database is the durable source of truth. Its schema, indexes, and consistency model shape the whole system.";
  if (el.symbol === 'CACHE') return "A cache trades freshness complexity for speed. It is great for hot reads and expensive computed results.";
  if (el.symbol === 'QUEUE') return "A queue decouples work from the request path, making retries and burst handling much easier.";
  if (el.symbol === 'OBJ') return "Object storage is ideal for large blobs like media, logs, backups, and exported files.";
  
  // Composed Components (Level 2)
  if (el.symbol === 'EDGE') return "An edge entry gives the request a resolved path into the platform.";
  if (el.symbol === 'MEDIA') return "Media delivery pairs durable object storage with edge caching for fast static assets.";
  if (el.symbol === 'POOL') return "A service pool is the basic scalable backend shape: many app instances behind balanced traffic.";
  if (el.symbol === 'SVC') return "A backend service gives business logic a routed API boundary.";
  if (el.symbol === 'CRUD') return "A transactional service combines application logic with durable reads and writes.";
  if (el.symbol === 'FAST') return "A cached service speeds up hot paths while keeping a source of truth behind it.";
  if (el.symbol === 'ASYNC') return "An async worker flow moves slow or retryable work outside the user request.";
  if (el.symbol === 'ROUTE') return "Routed traffic is the bridge between ingress rules and healthy backend capacity.";
  if (el.symbol === 'READ') return "A read path balances cache speed with database correctness.";
  if (el.symbol === 'JOBDB') return "Job persistence gives background work a durable record for retries, progress, and results.";
  if (el.symbol === 'BFF') return "A frontend gateway can tailor backend responses for a specific client experience.";
  if (el.symbol === 'STATIC') return "A static frontend is a fast, cacheable delivery path for browser assets.";
  if (el.symbol === 'WEBAPP') return "A web application links user entry, routing, and backend capacity into a working product path.";
  if (el.symbol === 'APIAPP') return "An API application exposes capabilities and persists transactional state.";
  if (el.symbol === 'SCALE') return "A scalable service mixes fast reads and asynchronous processing so load spikes are easier to handle.";
  if (el.symbol === 'CONTENT') return "A content platform combines durable storage with edge delivery so static assets and media stay fast worldwide.";
  if (el.symbol === 'DATA') return "A data platform balances reliable writes with efficient read paths, which is the backbone of many product systems.";
  if (el.symbol === 'WORKER') return "A worker platform handles slow or retryable jobs outside the request path while preserving job state.";
  
  // Fallback for any other composed components
  if (el.atomicNumber === 0) return "This is a composed system component built from smaller infrastructure pieces.";
  
  // Final fallback to component description
  return el.description || "Select a component to learn how it fits into a system design.";
}

export function getSystemMessage(status: string): string {
  if (status.includes("LAB READY")) return "I'm ready for the next design. Pick two components.";
  if (status.includes("HOLD TO FUSE")) return "Stabilizing reaction... Hold it steady!";
  if (status.includes("FUSION SUCCESS")) return "Nice! A composed system component has been formed.";
  if (status.includes("Failed")) return "That design needs another enabling layer before it works.";
  if (status.includes("Incompatible")) return "Those components do not form a known pattern yet.";
  if (status.includes("SAVED")) return "Great work! I've added that to your collection.";
  if (status.includes("SWAPPED")) return "Component selected. What will you pair it with?";
  return "Observing experiment parameters...";
}
