import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import analyzeRoute from './routes/analyze';
import uploadRoute from './routes/upload';
import redFlagsRoute from './routes/red_flags';

const app = Fastify({ logger: true });

app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' });
app.register(rateLimit, { max: 20, timeWindow: '1 minute' });
app.register(analyzeRoute);
app.register(uploadRoute);
app.register(redFlagsRoute);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
});
