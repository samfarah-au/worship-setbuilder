import app from './app';

export default function handler(req: any, res: any) {
  // Vite's dev proxy strips /api before hitting Express; Vercel doesn't, so we do it here.
  req.url = (req.url || '/').replace(/^\/api/, '') || '/';
  app(req, res);
}
