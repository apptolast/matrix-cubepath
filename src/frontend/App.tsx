import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './components/auth/LoginPage';
import { ServiceWorkerRegister } from './components/pwa/ServiceWorkerRegister';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { useUiStore, Theme } from './stores/ui.store';
import { useSettings } from './hooks/useSettings';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 401s — vault is locked, retrying won't help
        if (error instanceof Error && error.message === 'Vault is locked') return false;
        return failureCount < 1;
      },
      staleTime: 5000,
    },
    mutations: {
      onError: (error) => {
        // Auto-redirect to lock screen when vault locks by inactivity
        if (error instanceof Error && error.message === 'Vault is locked') {
          queryClient.invalidateQueries({ queryKey: ['passwords', 'status'] });
        }
      },
    },
  },
});

// Also handle 401 on queries (auto-lock detection)
queryClient.getQueryCache().subscribe((event) => {
  if (
    event.type === 'updated' &&
    event.query.state.error instanceof Error &&
    event.query.state.error.message === 'Vault is locked'
  ) {
    queryClient.invalidateQueries({ queryKey: ['passwords', 'status'] });
  }
});

// Read cached theme before React renders to prevent flash
const cachedTheme = localStorage.getItem('matrix-theme');
if (cachedTheme === 'light' || cachedTheme === 'dark') {
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(cachedTheme);
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useUiStore();

  // On mount: localStorage > system preference > dark
  useEffect(() => {
    const cached = localStorage.getItem('matrix-theme');
    if (cached === 'light' || cached === 'dark') {
      setTheme(cached as Theme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, [setTheme]);

  // Sync theme → DOM + localStorage whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem('matrix-theme', theme);
  }, [theme]);

  return (
    <>
      {children}
      <Toaster position="top-center" theme={theme} richColors />
    </>
  );
}

/**
 * Hydrates Zustand store (language, theme) from backend settings once after login.
 * This ensures the UI matches whatever language/theme the user last saved,
 * regardless of browser locale or localStorage state.
 */
function SettingsHydrator() {
  const { data: settings } = useSettings();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || hydrated) return;
    const lang = settings.language;
    if (lang === 'en' || lang === 'es') useUiStore.getState().setLanguage(lang);
    setHydrated(true);
  }, [settings, hydrated]);

  return null;
}

export function App() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  function handleLoginSuccess(isDemo: boolean) {
    useUiStore.getState().setIsDemo(isDemo);
    setAuthState('authenticated');
  }

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          useUiStore.getState().setIsDemo(!!data.isDemo);
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      })
      .catch(() => setAuthState('unauthenticated'));
  }, []);

  if (authState === 'checking') {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-matrix-bg flex items-center justify-center">
          <span className="text-matrix-muted text-sm tracking-wider">…</span>
        </div>
      </ThemeProvider>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <ThemeProvider>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsHydrator />
        <AppShell />
        <ServiceWorkerRegister />
        <InstallPrompt />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
