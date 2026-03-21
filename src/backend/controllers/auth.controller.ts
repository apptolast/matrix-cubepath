import { Request, Response } from 'express';
import { createUser, verifyUser, userExists } from '../db/auth-db';
import { createSessionToken, COOKIE_NAME } from '../middleware/auth.middleware';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const IS_PROD = process.env.NODE_ENV === 'production';
const SECURE_COOKIE = process.env.SECURE_COOKIE !== 'false' && IS_PROD;

// Username: 3-30 chars, alphanumeric + underscore + hyphen only
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;

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
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  if (!USERNAME_RE.test(username)) {
    res.status(400).json({
      error: 'Username must be 3-30 characters: letters, numbers, _ or -',
    });
    return;
  }
  if (password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
    return;
  }
  if (userExists(username)) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  createUser(username, password);
  setCookie(res, username);
  res.status(201).json({ ok: true });
}

export function login(req: Request, res: Response): void {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  if (!verifyUser(username, password)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  setCookie(res, username);
  res.json({ ok: true });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

export function checkSession(_req: Request, res: Response): void {
  res.json({ ok: true });
}
