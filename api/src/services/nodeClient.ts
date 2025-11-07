import type { NodeRole, NodeMetrics } from './nodeRegistry';
import { nodeRegistry } from './nodeRegistry';

interface CallOptions {
  path: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class NodeUnavailableError extends Error {}

const sharedHeaders = (): Record<string, string> => {
  if (process.env.NODE_SHARED_SECRET) {
    return { 'x-node-secret': process.env.NODE_SHARED_SECRET };
  }
  return {};
};

export const callNodeService = async <T>(
  role: NodeRole,
  options: CallOptions,
): Promise<T> => {
  const node = nodeRegistry.getAvailableNode(role);
  if (!node) {
    throw new NodeUnavailableError(`No ${role} nodes available`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const response = await fetch(`${node.baseUrl}${options.path}`, {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...sharedHeaders(),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Node ${node.name} responded with ${response.status}: ${errorBody}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const updateNodeMetrics = (id: string, metrics?: NodeMetrics) => {
  nodeRegistry.heartbeat(id, metrics);
};

export const openNodeStream = async (
  role: NodeRole,
  path: string,
  options?: { method?: string; body?: unknown },
) => {
  const node = nodeRegistry.getAvailableNode(role);
  if (!node) {
    throw new NodeUnavailableError(`No ${role} nodes available`);
  }

  const response = await fetch(`${node.baseUrl}${path}`, {
    method: options?.method ?? 'POST',
    headers: {
      ...sharedHeaders(),
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Node ${node.name} responded with ${response.status}: ${errorBody}`,
    );
  }

  return response;
};
