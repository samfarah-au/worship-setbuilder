import express from 'express';
import cors from 'cors';
import songsRouter from './routes/songs';
import settingsRouter from './routes/settings';
import pcoRouter from './routes/pco';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/songs', songsRouter);
app.use('/settings', settingsRouter);
app.use('/pco', pcoRouter);

export default app;
