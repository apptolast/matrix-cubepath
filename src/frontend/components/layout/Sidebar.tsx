import React, { Fragment } from 'react';
import { useUiStore, Tab } from '../../stores/ui.store';
import { t } from '../../lib/i18n';
import { useDeadlines } from '../../hooks/useDeadlines';
import { useSettings } from '../../hooks/useSettings';

const tabs: { key: Tab; icon: string }[] = [
  { key: 'overview', icon: '◈' },
  { key: 'projects', icon: '◫' },
  { key: 'tasks', icon: '☰' },
  { key: 'ideas', icon: '✦' },
  { key: 'passwords', icon: '🔒' },
  { key: 'settings', icon: '⚙' },
];

export function Sidebar() {
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar, language, deadlinesHidden } = useUiStore();
  const { data: deadlines } = useDeadlines();
  const { data: settings } = useSettings();

  const enabled = settings?.['deadlineAlerts'] !== 'false';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.href = '/';
  }

  return (
    <aside
      className={`flex flex-col bg-matrix-surface border-r border-matrix-border transition-all ${
        sidebarCollapsed ? 'w-12' : 'w-48'
      }`}
    >
      <div className="flex items-center justify-between h-10 px-3 border-b border-matrix-border">
        {!sidebarCollapsed && <span className="text-matrix-accent font-semibold text-sm tracking-wide">MATRIX</span>}
        <button onClick={toggleSidebar} className="text-matrix-muted hover:text-gray-300 transition-colors text-xs">
          {sidebarCollapsed ? '→' : '←'}
        </button>
      </div>
      <nav className="flex-1 py-1">
        {tabs.map(({ key, icon }) => {
          const isActive = activeTab === key;
          const showBadge = key === 'tasks' && enabled && !deadlinesHidden && deadlines && deadlines.total > 0;
          return (
            <Fragment key={key}>
              <button
                onClick={() => setActiveTab(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors relative ${
                  isActive
                    ? 'bg-matrix-accent/10 text-matrix-accent'
                    : 'text-matrix-muted hover:text-matrix-accent hover:bg-matrix-accent/5'
                }`}
              >
                <span className="text-sm">{icon}</span>
                {!sidebarCollapsed && <span className="text-sm">{t(key, language)}</span>}
                {showBadge && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {deadlines.total > 9 ? '9+' : deadlines.total}
                  </span>
                )}
              </button>
              {key === 'settings' && (
                <>
                  <div className="border-t border-matrix-border mx-0 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-matrix-muted hover:text-red-400 hover:bg-red-400/5 transition-colors"
                    title={t('logout', language)}
                  >
                    <span className="text-sm">⏻</span>
                    {!sidebarCollapsed && <span>{t('logout', language)}</span>}
                  </button>
                </>
              )}
            </Fragment>
          );
        })}
      </nav>
    </aside>
  );
}
