import { create } from 'zustand';

export type Tab = 'overview' | 'projects' | 'tasks' | 'ideas' | 'passwords' | 'settings';
export type Theme = 'dark' | 'light';

interface UiState {
  activeTab: Tab;
  sidebarCollapsed: boolean;
  language: 'en' | 'es';
  theme: Theme;
  quickCreateModal: { type: 'task' | 'idea' | null };
  deadlinesHidden: boolean;
  setActiveTab: (tab: Tab) => void;
  toggleSidebar: () => void;
  setLanguage: (lang: 'en' | 'es') => void;
  setTheme: (theme: Theme) => void;
  openQuickCreate: (type: 'task' | 'idea') => void;
  closeQuickCreate: () => void;
  toggleDeadlinesHidden: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'overview',
  sidebarCollapsed: false,
  language: 'en',
  theme: 'dark',
  quickCreateModal: { type: null },
  deadlinesHidden: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme }),
  openQuickCreate: (type) => set({ quickCreateModal: { type } }),
  closeQuickCreate: () => set({ quickCreateModal: { type: null } }),
  toggleDeadlinesHidden: () => set((s) => ({ deadlinesHidden: !s.deadlinesHidden })),
}));
