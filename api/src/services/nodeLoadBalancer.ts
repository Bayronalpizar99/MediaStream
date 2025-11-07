import { nodeRegistry } from './nodeRegistry';
import type { NodeRole, RegisteredNode } from './nodeRegistry';
import { NodeUnavailableError } from './nodeErrors';

const DEFAULT_MAX_CONCURRENCY = Number(process.env.NODE_MAX_TASKS_PER_NODE ?? '2');

type Resolver = () => void;

class NodeLoadBalancer {
  private activeCounts = new Map<string, number>();
  private waitQueues = new Map<NodeRole, Resolver[]>();
  private maxConcurrency: number;

  constructor(maxConcurrency: number) {
    this.maxConcurrency = Math.max(1, maxConcurrency);
  }

  private getActiveCount(nodeId: string) {
    return this.activeCounts.get(nodeId) ?? 0;
  }

  private increment(nodeId: string) {
    this.activeCounts.set(nodeId, this.getActiveCount(nodeId) + 1);
  }

  private decrement(nodeId: string) {
    const next = Math.max(0, this.getActiveCount(nodeId) - 1);
    this.activeCounts.set(nodeId, next);
  }

  private pickNode(role: NodeRole, excluded: Set<string>): RegisteredNode | undefined {
    const candidates = nodeRegistry
      .getAvailableNodes(role)
      .filter((node) => !excluded.has(node.id))
      .sort((a, b) => this.getActiveCount(a.id) - this.getActiveCount(b.id));

    return candidates.find((node) => this.getActiveCount(node.id) < this.maxConcurrency);
  }

  private waitForSlot(role: NodeRole) {
    return new Promise<void>((resolve) => {
      const queue = this.waitQueues.get(role) ?? [];
      queue.push(resolve);
      this.waitQueues.set(role, queue);
    });
  }

  private release(role: NodeRole) {
    const queue = this.waitQueues.get(role);
    if (queue && queue.length > 0) {
      const resolve = queue.shift();
      resolve?.();
    }
  }

  async acquire(role: NodeRole, attemptedNodes: Set<string>) {
    while (true) {
      const node = this.pickNode(role, attemptedNodes);
      if (node) {
        this.increment(node.id);
        return node;
      }

      const available = nodeRegistry
        .getAvailableNodes(role)
        .filter((node) => !attemptedNodes.has(node.id));

      if (available.length === 0) {
        throw new NodeUnavailableError(`No ${role} nodes available`);
      }

      await this.waitForSlot(role);
    }
  }

  complete(role: NodeRole, nodeId: string) {
    this.decrement(nodeId);
    this.release(role);
  }
}

export const nodeLoadBalancer = new NodeLoadBalancer(DEFAULT_MAX_CONCURRENCY);
