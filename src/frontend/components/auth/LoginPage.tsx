import { useState, useRef, FormEvent } from 'react';
import { PasswordInput } from '../ui/PasswordInput';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const DEMO_USER = 'demo';
const DEMO_PASS = 'demo1234';
const TYPE_SPEED = 90;
const CURSOR_MOVE_MS = 600;
const PAUSE_MS = 500;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getElementCenter(el: Element) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

async function doLogin(user: string, pass: string, onSuccess: () => void, onError: (msg: string) => void) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  if (res.ok) return onSuccess();
  const data = await res.json().catch(() => ({}));
  onError(data.error || 'Login failed');
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demotyping, setDemotyping] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorAnimating, setCursorAnimating] = useState(false);
  const abortRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const demoBtnRef = useRef<HTMLButtonElement>(null);

  const isRegister = mode === 'register';

  function validate(): string | null {
    if (!USERNAME_RE.test(username)) return 'Username must be 3-30 characters: letters, numbers, _ or -';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password.length > 128) return 'Password must be at most 128 characters';
    if (isRegister && password !== confirmPassword) return 'Passwords do not match';
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        onLoginSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (isRegister ? 'Registration failed' : 'Login failed'));
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode: 'login' | 'register') {
    setMode(newMode);
    setError('');
    setConfirmPassword('');
  }

  function cancelDemo() {
    abortRef.current = true;
    setDemotyping(false);
    setCursorPos(null);
    setCursorAnimating(false);
  }

  async function typeText(text: string, setter: (v: string) => void) {
    for (let i = 0; i <= text.length; i++) {
      if (abortRef.current) return;
      setter(text.slice(0, i));
      await wait(TYPE_SPEED);
    }
  }

  async function moveCursorTo(el: Element) {
    setCursorPos(getElementCenter(el));
    await wait(CURSOR_MOVE_MS);
  }

  async function handleDemoLogin() {
    if (demotyping || loading) return;
    abortRef.current = false;
    setDemotyping(true);
    setError('');
    switchMode('login');
    setUsername('');
    setPassword('');

    // Show fake cursor at the demo button instantly
    if (demoBtnRef.current) {
      setCursorAnimating(false);
      setCursorPos(getElementCenter(demoBtnRef.current));
    }

    await wait(400);
    await typeText(DEMO_USER, setUsername);
    if (abortRef.current) return;
    await wait(PAUSE_MS);

    await typeText(DEMO_PASS, setPassword);
    if (abortRef.current) return;
    await wait(PAUSE_MS);

    // Move cursor to eye icon → click → reveal password
    setCursorAnimating(true);
    const eyeBtn = formRef.current?.querySelector<HTMLButtonElement>(
      '[aria-label="Show password"], [aria-label="Hide password"]',
    );
    if (eyeBtn && !abortRef.current) {
      await moveCursorTo(eyeBtn);
      if (abortRef.current) return;
      eyeBtn.click();
      await wait(800);
      if (abortRef.current) return;
    }

    // Move cursor to Sign in → submit
    const submitBtn = formRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitBtn && !abortRef.current) {
      await moveCursorTo(submitBtn);
      if (abortRef.current) return;
      await wait(300);
    }

    setCursorPos(null);
    setCursorAnimating(false);
    setDemotyping(false);
    setLoading(true);
    try {
      await doLogin(DEMO_USER, DEMO_PASS, onLoginSuccess, setError);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`min-h-screen bg-matrix-bg flex items-center justify-center p-4${demotyping ? ' cursor-none' : ''}`}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-matrix-accent tracking-widest uppercase">Matrix</h1>
          <p className="text-xs text-matrix-muted mt-1 tracking-wider">Projects Management System</p>
        </div>

        {/* Tab toggle */}
        <div className="relative flex mb-4 border border-matrix-border rounded-lg overflow-hidden">
          <div
            className="absolute inset-y-0 w-1/2 bg-matrix-accent rounded-md transition-transform duration-300 ease-out"
            style={{ transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`relative flex-1 py-2 text-xs font-medium tracking-wide uppercase transition-colors duration-300 ${
              mode === 'login' ? 'text-matrix-bg' : 'text-matrix-muted hover:text-matrix-text'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`relative flex-1 py-2 text-xs font-medium tracking-wide uppercase transition-colors duration-300 ${
              mode === 'register' ? 'text-matrix-bg' : 'text-matrix-muted hover:text-matrix-text'
            }`}
          >
            Register
          </button>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-matrix-surface border border-matrix-border rounded-lg p-6 space-y-4"
        >
          <div>
            <label htmlFor="username" className="block text-xs text-matrix-muted mb-1 tracking-wide uppercase">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => {
                cancelDemo();
                setUsername(e.target.value);
              }}
              placeholder={isRegister ? '3-30 chars, letters/numbers/_/-' : ''}
              className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-2 text-sm text-matrix-text placeholder:text-matrix-muted/50 focus:outline-none focus:border-matrix-accent focus:shadow-[0_0_8px_rgba(var(--matrix-accent),0.12)] transition-all duration-200"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-matrix-muted mb-1 tracking-wide uppercase">
              Password
            </label>
            <PasswordInput
              id="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => {
                cancelDemo();
                setPassword(e.target.value);
              }}
              placeholder={isRegister ? 'At least 8 characters' : ''}
              className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-2 text-sm text-matrix-text placeholder:text-matrix-muted/50 focus:outline-none focus:border-matrix-accent focus:shadow-[0_0_8px_rgba(var(--matrix-accent),0.12)] transition-all duration-200"
              required
            />
          </div>

          {isRegister && (
            <div>
              <label htmlFor="confirm" className="block text-xs text-matrix-muted mb-1 tracking-wide uppercase">
                Confirm password
              </label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-2 text-sm text-matrix-text placeholder:text-matrix-muted/50 focus:outline-none focus:border-matrix-accent focus:shadow-[0_0_8px_rgba(var(--matrix-accent),0.12)] transition-all duration-200"
                required
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400 text-center animate-[shake_0.3s_ease-in-out]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-matrix-accent text-matrix-bg font-semibold text-sm py-2.5 rounded hover:brightness-110 hover:shadow-[0_0_16px_rgba(var(--matrix-accent),0.25)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-matrix-bg/30 border-t-matrix-bg rounded-full animate-spin" />
                {isRegister ? 'Creating account' : 'Authenticating'}
              </span>
            ) : isRegister ? (
              'Create account'
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <button
          ref={demoBtnRef}
          type="button"
          onClick={handleDemoLogin}
          disabled={demotyping || loading}
          className="mt-5 mx-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-matrix-border/50 text-matrix-muted text-xs font-mono tracking-wide hover:border-matrix-accent/60 hover:text-matrix-accent hover:shadow-[0_0_12px_rgba(var(--matrix-accent),0.15)] transition-all duration-300 disabled:opacity-40"
        >
          <span className="text-matrix-accent/70">$</span>
          <span>access</span>
          <span className="text-matrix-accent">--demo</span>
          <span
            className={`w-1.5 h-3.5 bg-current ${demotyping ? 'animate-pulse' : 'animate-[blink_1s_step-end_infinite]'}`}
          />
        </button>
      </div>

      {/* Animated demo cursor */}
      {cursorPos && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            transition: cursorAnimating
              ? `left ${CURSOR_MOVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), top ${CURSOR_MOVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
              : 'none',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="-translate-x-1 -translate-y-1 drop-shadow-[0_0_6px_rgba(var(--matrix-accent),0.5)]"
          >
            <path
              d="M5 3l14 8.5L12.5 14l-2 6.5L5 3z"
              fill="rgb(var(--matrix-accent))"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth="1.2"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
