import type { NodeRole, NodeMetrics } from './nodeRegistry';
import { nodeRegistry } from './nodeRegistry';
import { nodeLoadBalancer } from './nodeLoadBalancer';
import { NodeUnavailableError } from './nodeErrors';
export { NodeUnavailableError } from './nodeErrors';

interface CallOptions {
  path: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

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
  const attempted = new Set<string>();

  const execute = async (): Promise<T> => {
    const node = await nodeLoadBalancer.acquire(role, attempted);
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
    } catch (error) {
      if (error instanceof TypeError) {
        nodeRegistry.markNodeStatus(node.id, 'offline');
        attempted.add(node.id);
        if (nodeRegistry.getAvailableNodes(role).filter((n) => !attempted.has(n.id)).length > 0) {
          return execute();
        }
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      nodeLoadBalancer.complete(role, node.id);
    }
  };

  return execute();
};

export const updateNodeMetrics = (id: string, metrics?: NodeMetrics) => {
  nodeRegistry.heartbeat(id, metrics);
};

export const openNodeStream = async (
  role: NodeRole,
  path: string,
  options?: { method?: string; body?: unknown },
) => {
  const attempted = new Set<string>();

  const execute = async (): Promise<Response> => {
    const node = await nodeLoadBalancer.acquire(role, attempted);
    try {
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
    } catch (error) {
      if (error instanceof TypeError) {
        nodeRegistry.markNodeStatus(node.id, 'offline');
        attempted.add(node.id);
        if (nodeRegistry.getAvailableNodes(role).filter((n) => !attempted.has(n.id)).length > 0) {
          return execute();
        }
      }
      throw error;
    } finally {
      nodeLoadBalancer.complete(role, node.id);
    }
  };

  return execute();
};
