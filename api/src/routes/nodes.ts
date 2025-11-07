import { Router } from 'express';
import { nodeRegistry } from '../services/nodeRegistry';
import type { NodeRegistration, NodeMetrics } from '../services/nodeRegistry';
import { HttpErrorStatusCodes, HttpSuccessStatusCodes } from '../constants';

export const nodesRouter = Router();

nodesRouter.post('/register', (req, res) => {
  try {
    const payload = req.body as NodeRegistration;
    if (!payload?.name || !payload?.role || !payload?.baseUrl) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'name, role and baseUrl are required' });
    }
    const node = nodeRegistry.registerNode(payload);
    return res.status(HttpSuccessStatusCodes.CREATED).send({ node });
  } catch (error) {
    console.error('Error registering node:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'Unable to register node' });
  }
});

nodesRouter.post('/heartbeat', (req, res) => {
  try {
    const { id, metrics } = req.body as { id?: string; metrics?: NodeMetrics };
    if (!id) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'id is required' });
    }
    const node = nodeRegistry.heartbeat(id, metrics);
    if (!node) {
      return res
        .status(HttpErrorStatusCodes.NOT_FOUND)
        .send({ message: 'Node not registered' });
    }
    return res.status(HttpSuccessStatusCodes.OK).send({ node });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'Unable to process heartbeat' });
  }
});

nodesRouter.get('/status', (_req, res) => {
  try {
    const nodes = nodeRegistry.getNodes();
    return res.status(HttpSuccessStatusCodes.OK).send({ nodes });
  } catch (error) {
    console.error('Error listing nodes:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'Unable to load nodes' });
  }
});
