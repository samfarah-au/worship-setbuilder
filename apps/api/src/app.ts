import express from 'express';
import cors from 'cors';
import songsRouter from './routes/songs';
import settingsRouter from './routes/settings';
import pcoRouter from './routes/pco';
import feedbackRouter from './routes/feedback';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/songs', songsRouter);
app.use('/settings', settingsRouter);
app.use('/pco', pcoRouter);
app.use('/feedback', feedbackRouter);

export default app;
