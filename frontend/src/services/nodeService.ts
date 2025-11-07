import { API_CONFIG, HTTP_METHODS, CONTENT_TYPES } from '../constants';
import { authService } from './authService';

export interface NodeStatus {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'warning';
  lastHeartbeat: number;
  metrics?: {
    cpu?: number;
    ram?: number;
    tasks?: number;
    uptimeSeconds?: number;
  };
  location?: string;
}

export const nodeService = {
  async getNodes(): Promise<NodeStatus[]> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NODES.STATUS}`,
      {
        method: HTTP_METHODS.GET,
        headers: {
          ...authService.getSessionHeaders(),
          Accept: CONTENT_TYPES.JSON,
        },
      },
    );

    if (!response.ok) {
      throw new Error('Error fetching node status');
    }

    const data = (await response.json()) as { nodes: NodeStatus[] };
    return data.nodes ?? [];
  },
};
