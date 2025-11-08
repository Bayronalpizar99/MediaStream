import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import os from 'node:os';
import { healthRouter, authRouter, mediaRouter, nodesRouter } from './routes';
import { 
  ERROR_MESSAGES, 
  ENV_VARIABLES, 
  VALID_NODE_ENVS,
  LOG_FORMATS,
  STRINGS,
  API_INFO,
  CORS_CONFIG,
  NUMBERS,
  HttpErrorStatusCodes
} from './constants';
import { nodeRegistry } from './services/nodeRegistry';

const app = express();
const coordinatorNodeId = process.env.COORDINATOR_NODE_ID ?? 'coordinator-node';


const PORT = Number(process.env.PORT);
const NODE_ENV = process.env.NODE_ENV;

const corsOrigins = (process.env.CORS_ORIGIN || STRINGS.EMPTY_STRING).split(STRINGS.COMMA).map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: corsOrigins.length > NUMBERS.ZERO ? corsOrigins : true,
  credentials: CORS_CONFIG.CREDENTIALS,
  methods: CORS_CONFIG.METHODS,
  allowedHeaders: CORS_CONFIG.ALLOWED_HEADERS,
}));

app.use(express.json());
app.use(morgan(NODE_ENV === VALID_NODE_ENVS.PRODUCTION ? LOG_FORMATS.PRODUCTION : LOG_FORMATS.DEVELOPMENT));


app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/media', mediaRouter);
app.use('/nodes', nodesRouter);

app.get('/', (_req, res) => {
  res.json({
    name: API_INFO.NAME,
    version: API_INFO.VERSION,
    status: API_INFO.STATUS_OK,
  });
});

app.use((req, res, _next) => {
  res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND, path: req.path });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`${ERROR_MESSAGES.UNHANDLED_ERROR}:`, err);
  res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
});

app.listen(PORT, () => {
  console.log(`[api] Listening on http://localhost:${PORT}`);
  nodeRegistry.registerNode({
    id: coordinatorNodeId,
    name: 'coordinator',
    role: 'coordinator',
    baseUrl: `http://localhost:${PORT}`,
    location: process.env.NODE_LOCATION ?? 'local',
  });

  setInterval(() => {
    nodeRegistry.heartbeat(coordinatorNodeId, {
      cpu: Math.min(100, (os.loadavg()[0] / os.cpus().length) * 100),
      ram: Math.min(100, (process.memoryUsage().rss / os.totalmem()) * 100),
      uptimeSeconds: process.uptime(),
    });
  }, 5000);
});
