import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import songsRouter from './routes/songs';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/songs', songsRouter);
app.use('/settings', settingsRouter);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

export default app;