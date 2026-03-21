import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../../backend/db/auth-db', () => ({
  createUser: vi.fn(),
  verifyUser: vi.fn(),
  userExists: vi.fn(),
}));

vi.mock('../../backend/middleware/auth.middleware', () => ({
  createSessionToken: vi.fn(() => 'mock-token'),
  COOKIE_NAME: 'matrix_session',
}));

import { register, login, logout, checkSession } from '../../backend/controllers/auth.controller';
import { createUser, verifyUser, userExists } from '../../backend/db/auth-db';

const mockReq = (body: unknown = {}) => ({ body }) as unknown as Request;

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth.controller', () => {
  describe('register', () => {
    it('returns 400 when body is missing username or password', () => {
      const res = mockRes();
      register(mockReq({}), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when username fails regex (too short)', () => {
      const res = mockRes();
      register(mockReq({ username: 'ab', password: 'password123' }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('3-30') }));
    });

    it('returns 400 when username has invalid characters', () => {
      const res = mockRes();
      register(mockReq({ username: 'user name!', password: 'password123' }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when password is too short', () => {
      const res = mockRes();
      register(mockReq({ username: 'validuser', password: '1234567' }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('8') }));
    });

    it('returns 400 when password exceeds 128 chars', () => {
      const res = mockRes();
      register(mockReq({ username: 'validuser', password: 'a'.repeat(129) }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('128') }));
    });

    it('returns 409 when username is already taken', () => {
      vi.mocked(userExists).mockReturnValue(true);
      const res = mockRes();
      register(mockReq({ username: 'existinguser', password: 'password123' }), res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('creates user and sets cookie on valid input', () => {
      vi.mocked(userExists).mockReturnValue(false);
      const res = mockRes();
      register(mockReq({ username: 'newuser', password: 'password123' }), res);
      expect(createUser).toHaveBeenCalledWith('newuser', 'password123');
      expect(res.cookie).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('accepts username with underscore and hyphen', () => {
      vi.mocked(userExists).mockReturnValue(false);
      const res = mockRes();
      register(mockReq({ username: 'user_name-1', password: 'password123' }), res);
      expect(createUser).toHaveBeenCalled();
    });

    it('rejects username longer than 30 chars', () => {
      const res = mockRes();
      register(mockReq({ username: 'a'.repeat(31), password: 'password123' }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login', () => {
    it('returns 400 when body is missing credentials', () => {
      const res = mockRes();
      login(mockReq({}), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 401 when credentials are invalid', () => {
      vi.mocked(verifyUser).mockReturnValue(false);
      const res = mockRes();
      login(mockReq({ username: 'user', password: 'wrongpassword' }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('sets cookie and returns ok on valid credentials', () => {
      vi.mocked(verifyUser).mockReturnValue(true);
      const res = mockRes();
      login(mockReq({ username: 'user', password: 'correctpassword' }), res);
      expect(res.cookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('logout', () => {
    it('clears cookie and returns ok', () => {
      const req = mockReq();
      const res = mockRes();
      logout(req, res);
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('checkSession', () => {
    it('returns ok', () => {
      const req = mockReq();
      const res = mockRes();
      checkSession(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
