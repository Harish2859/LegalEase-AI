import Fastify from 'fastify';
import analyzeRoute from './routes/analyze';
import uploadRoute from './routes/upload';

const app = Fastify({ logger: true });

app.register(analyzeRoute);
app.register(uploadRoute);

app.listen({ port: 3001 }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
});
