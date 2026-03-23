import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, checkSession } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authRegisterBody, authLoginBody } from '../validations/auth.validation';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// Public routes
authRouter.get('/auth/info', (_req, res) => {
  res.json({ registrationOpen: process.env.ALLOW_REGISTRATION === 'true' });
});

authRouter.post(
  '/auth/register',
  authLimiter,
  (req, res, next) => {
    if (process.env.ALLOW_REGISTRATION !== 'true') {
      res.status(403).json({ error: 'Registration is currently closed' });
      return;
    }
    next();
  },
  validate({ body: authRegisterBody }),
  register,
);
authRouter.post('/auth/login', authLimiter, validate({ body: authLoginBody }), login);
authRouter.post('/auth/logout', logout);

// Protected — client polls this to check if session is still valid
authRouter.get('/auth/session', requireAuth, checkSession);
