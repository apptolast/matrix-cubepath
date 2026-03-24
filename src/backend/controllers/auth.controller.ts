import { Request, Response } from 'express';
import { createUser, verifyUser, userExists } from '../db/auth-db';
import { createSessionToken, COOKIE_NAME } from '../middleware/auth.middleware';
import { DEMO_USERNAME } from '../db/seed-demo';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const SECURE_COOKIE = process.env.SECURE_COOKIE === 'true';

function setCookie(res: Response, username: string): void {
  const token = createSessionToken(username);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function register(req: Request, res: Response): void {
  const { username, password } = req.body;

  if (userExists(username)) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  createUser(username, password);
  setCookie(res, username);
  res.status(201).json({ ok: true });
}

export function login(req: Request, res: Response): void {
  const { username, password } = req.body;

  if (!verifyUser(username, password)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  setCookie(res, username);
  res.json({ ok: true, username, isDemo: username === DEMO_USERNAME });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

export function checkSession(req: Request, res: Response): void {
  const username = req.matrixUser;
  res.json({ ok: true, username, isDemo: username === DEMO_USERNAME });
}
