import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { healthRouter, authRouter } from './routes';
import { 
  ERROR_MESSAGES, 
  ENV_VARIABLES, 
  VALID_NODE_ENVS,
  LOG_FORMATS,
  STRINGS,
  API_INFO
} from './constants';

const app = express();


const PORT = Number(process.env.PORT);
const NODE_ENV = process.env.NODE_ENV;

const corsOrigins = (process.env.CORS_ORIGIN || STRINGS.EMPTY_STRING).split(STRINGS.COMMA).map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
// Use detailed logs in production and concise 'dev' logs otherwise
app.use(morgan(NODE_ENV === VALID_NODE_ENVS.PRODUCTION ? LOG_FORMATS.PRODUCTION : LOG_FORMATS.DEVELOPMENT));


app.use('/health', healthRouter);
app.use('/auth', authRouter);

app.get('/', (_req, res) => {
  res.json({
    name: API_INFO.NAME,
    version: API_INFO.VERSION,
    status: API_INFO.STATUS_OK,
  });
});

// 404 handler
app.use((req, res, _next) => {
  res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND, path: req.path });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`${ERROR_MESSAGES.UNHANDLED_ERROR}:`, err);
  res.status(500).json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
});

app.listen(PORT, () => {
  console.log(`[api] Listening on http://localhost:${PORT}`);
});
