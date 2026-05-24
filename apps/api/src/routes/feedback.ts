import { Router, Request, Response } from 'express';
import { Resend } from 'resend';

const router = Router();

const FEEDBACK_TYPES = ['Bug report', 'Feature suggestion', 'General feedback'] as const;

// POST /feedback
router.post('/', async (req: Request, res: Response) => {
  const { type, message } = req.body ?? {};

  if (!FEEDBACK_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid feedback type' });
  }
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ error: 'Message is too short' });
  }

  const toEmail = process.env.FEEDBACK_TO_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;

  if (!toEmail || !apiKey) {
    return res.status(503).json({ error: 'Feedback email not configured' });
  }

  const resend = new Resend(apiKey);
  const submitted = new Date().toUTCString();

  await resend.emails.send({
    from: 'WorshipSet Feedback <onboarding@resend.dev>',
    to: [toEmail],
    subject: `[WorshipSet] ${type}`,
    text: `Type: ${type}\n\nMessage:\n${message.trim()}\n\nSubmitted: ${submitted}`,
  });

  return res.json({ ok: true });
});

export default router;
