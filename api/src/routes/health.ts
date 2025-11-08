import { Router } from 'express';
import { HEALTH_CONSTANTS } from '../constants';


export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: HEALTH_CONSTANTS.STATUS_OK, uptime: `${process.uptime()} seconds` });
});
