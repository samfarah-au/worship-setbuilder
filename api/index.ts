import dotenv from 'dotenv';
dotenv.config(); // no-op in Vercel production; loads root .env locally if running directly

import app from '../apps/api/src/app';

export default function handler(req: any, res: any) {
  // Vite's dev proxy strips /api before hitting Express; Vercel doesn't, so we do it here.
  req.url = (req.url || '/').replace(/^\/api/, '') || '/';
  app(req, res);
}
