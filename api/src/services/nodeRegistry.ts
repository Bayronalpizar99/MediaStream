import { randomUUID } from 'node:crypto';

export type NodeRole = 'coordinator' | 'conversion' | 'streaming';

export type NodeStatus = 'online' | 'offline' | 'warning';

export interface NodeMetrics {
  cpu?: number;
  ram?: number;
  tasks?: number;
  uptimeSeconds?: number;
}

export interface NodeRegistration {
  id?: string;
  name: string;
  role: NodeRole;
  baseUrl: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisteredNode extends NodeRegistration {
  id: string;
  status: NodeStatus;
  lastHeartbeat: number;
  metrics?: NodeMetrics;
}

const HEARTBEAT_TIMEOUT_MS = 15_000;

class NodeRegistry {
  private nodes: Map<string, RegisteredNode> = new Map();

  registerNode(payload: NodeRegistration): RegisteredNode {
    const id = payload.id ?? randomUUID();
    const existing = this.nodes.get(id);
    const now = Date.now();

    const node: RegisteredNode = {
      ...payload,
      id,
      status: existing?.status ?? 'online',
      lastHeartbeat: now,
      metrics: existing?.metrics ?? {},
    };

    this.nodes.set(id, node);
    return node;
  }

  heartbeat(id: string, metrics?: NodeMetrics): RegisteredNode | undefined {
    const existing = this.nodes.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: RegisteredNode = {
      ...existing,
      status: 'online',
      lastHeartbeat: Date.now(),
      metrics: metrics ?? existing.metrics,
    };
    this.nodes.set(id, updated);
    return updated;
  }

  markOfflineIfStale() {
    const now = Date.now();
    this.nodes.forEach((node, id) => {
      if (now - node.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        this.nodes.set(id, { ...node, status: 'offline' });
      }
    });
  }

  getNodes(): RegisteredNode[] {
    this.markOfflineIfStale();
    return Array.from(this.nodes.values());
  }

  getAvailableNode(role: NodeRole): RegisteredNode | undefined {
    this.markOfflineIfStale();
    const candidates = Array.from(this.nodes.values()).filter(
      (node) => node.role === role && node.status === 'online',
    );
    return candidates[0];
  }
}

export const nodeRegistry = new NodeRegistry();
