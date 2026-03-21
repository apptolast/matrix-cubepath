import { useState, FormEvent } from 'react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;

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

  return (
    <div className="min-h-screen bg-matrix-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-matrix-accent tracking-widest uppercase">Matrix</h1>
          <p className="text-xs text-matrix-muted mt-1 tracking-wider">Personal Management System</p>
        </div>

        {/* Tab toggle */}
        <div className="flex mb-4 border border-matrix-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-xs font-medium tracking-wide uppercase transition-colors ${
              mode === 'login' ? 'bg-matrix-accent text-matrix-bg' : 'text-matrix-muted hover:text-matrix-text'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 text-xs font-medium tracking-wide uppercase transition-colors ${
              mode === 'register' ? 'bg-matrix-accent text-matrix-bg' : 'text-matrix-muted hover:text-matrix-text'
            }`}
          >
            Register
          </button>
        </div>

        <form
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
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isRegister ? '3-30 chars, letters/numbers/_/-' : ''}
              className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-2 text-sm text-matrix-text placeholder:text-matrix-muted/50 focus:outline-none focus:border-matrix-accent transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-matrix-muted mb-1 tracking-wide uppercase">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? 'At least 8 characters' : ''}
              className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-2 text-sm text-matrix-text placeholder:text-matrix-muted/50 focus:outline-none focus:border-matrix-accent transition-colors"
              required
            />
          </div>

          {isRegister && (
            <div>
              <label htmlFor="confirm" className="block text-xs text-matrix-muted mb-1 tracking-wide uppercase">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-2 text-sm text-matrix-text focus:outline-none focus:border-matrix-accent transition-colors"
                required
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-matrix-accent text-matrix-bg font-semibold text-sm py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading
              ? isRegister
                ? 'Creating account…'
                : 'Authenticating…'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
