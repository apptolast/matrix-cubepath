import React, { useState } from 'react';
import { useProjects, Project } from '../../hooks/useProjects';
import { useStats } from '../../hooks/useStats';
import { useMission } from '../../hooks/useMission';
import { useObjectives } from '../../hooks/useObjectives';
import { useTasks, useUpdateTask } from '../../hooks/useTasks';
import { useCreateIdea } from '../../hooks/useIdeas';
import { useCreateTask } from '../../hooks/useTasks';
import { usePlans } from '../../hooks/usePlans';
import { useActivity } from '../../hooks/useActivity';
import { useUiStore } from '../../stores/ui.store';
import { t, LangKey } from '../../lib/i18n';
import { ProgressBar, SectionCard } from './primitives';
import { Dropdown } from '../ui/Dropdown';
import { ResizableTextarea } from '../ui/ResizableTextarea';

// --- StatsCard ---

export function StatsCard({ language }: { language: 'en' | 'es' }) {
  const { data: stats } = useStats();
  if (!stats) return null;
  const items = [
    {
      label: t('tasks' as LangKey, language),
      value: `${stats.completedTasks}/${stats.totalTasks}`,
      sub: stats.totalTasks > 0,
    },
    { label: t('activePlans' as LangKey, language), value: String(stats.activePlans) },
    { label: t('pendingIdeas' as LangKey, language), value: String(stats.pendingIdeas) },
    { label: t('completionRate' as LangKey, language), value: `${stats.completionRate}%` },
  ];
  return (
    <SectionCard title={t('globalStats' as LangKey, language)} icon="◪">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-lg font-semibold text-gray-200">{item.value}</p>
            <p className="text-[10px] text-matrix-muted">{item.label}</p>
          </div>
        ))}
      </div>
      {stats.totalTasks > 0 && (
        <div className="mt-3">
          <ProgressBar value={stats.completionRate} />
        </div>
      )}
    </SectionCard>
  );
}

// --- ActiveProjectsCard ---

export function ActiveProjectsCard({ language }: { language: 'en' | 'es' }) {
  const { data: allProjects } = useProjects();
  const { setActiveTab } = useUiStore();
  const active = (allProjects || []).filter((p: Project) => p.status === 'active').slice(0, 5);
  return (
    <SectionCard title={t('activeProjects' as LangKey, language)} icon="◫">
      {active.length === 0 ? (
        <p className="text-xs text-matrix-muted py-4 text-center">{t('noProjects' as LangKey, language)}</p>
      ) : (
        <div className="space-y-2">
          {active.map((p: Project) => (
            <button
              key={p.id}
              onClick={() => setActiveTab('projects')}
              className="w-full flex items-center gap-2 text-left hover:bg-white/[0.02] rounded px-1 py-1 transition-colors"
            >
              <span className="text-sm text-gray-300 flex-1 truncate">{p.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-matrix-border/50 text-matrix-muted'}`}
              >
                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </span>
              {p.scan && (
                <div className="w-12">
                  <ProgressBar value={p.scan.progressPercent} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// --- RecentActivityCard ---

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const activityIcons: Record<string, string> = {
  created: '+',
  completed: '✓',
  promoted: '↑',
  scanned: '⟲',
  deleted: '✕',
  decided: '⚖',
};

export function RecentActivityCard({ language }: { language: 'en' | 'es' }) {
  const { data: activity } = useActivity(10);
  return (
    <SectionCard title={t('recentActivity' as LangKey, language)} icon="⟲">
      {!activity || activity.length === 0 ? (
        <p className="text-xs text-matrix-muted py-4 text-center">{t('noActivity' as LangKey, language)}</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-4">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start gap-2 py-1 text-xs">
              <span className="text-matrix-accent shrink-0 w-3 text-center">{activityIcons[a.action] || '•'}</span>
              <span className="text-gray-400 flex-1 truncate">{a.description}</span>
              <span className="text-matrix-muted/50 shrink-0">{timeAgo(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// --- QuickCaptureCard ---

export function QuickCaptureCard({ language }: { language: 'en' | 'es' }) {
  const [mode, setMode] = useState<'idea' | 'task'>('idea');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [planId, setPlanId] = useState<number | ''>('');
  const [saved, setSaved] = useState(false);

  const createIdea = useCreateIdea();
  const createTask = useCreateTask();
  const { data: plans } = usePlans();

  const isSaving = createIdea.isPending || createTask.isPending;

  const handleSave = () => {
    if (!title.trim() || isSaving) return;
    const onSuccess = () => {
      setTitle('');
      setDescription('');
      setPlanId('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    };
    if (mode === 'idea') {
      createIdea.mutate({ title: title.trim(), description: description.trim() || undefined }, { onSuccess });
    } else {
      if (!planId) return;
      createTask.mutate({ planId: Number(planId), title: title.trim() }, { onSuccess });
    }
  };

  const inputCls =
    'w-full bg-matrix-bg border border-matrix-border rounded px-2 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-matrix-accent/60 transition-colors';

  return (
    <SectionCard title={t('quickCapture' as LangKey, language)} icon="✦">
      <div className="space-y-2">
        <div className="flex gap-1">
          {(['idea', 'task'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs px-3 py-1 rounded transition-colors ${mode === m ? 'bg-matrix-accent/10 text-matrix-accent' : 'text-matrix-muted hover:text-gray-300'}`}
            >
              {t(m as LangKey, language)}
            </button>
          ))}
        </div>
        {mode === 'task' && plans && (
          <Dropdown
            value={String(planId)}
            onChange={(val) => setPlanId(val ? Number(val) : '')}
            options={[
              { value: '', label: t('selectPlan' as LangKey, language) },
              ...plans.map((p) => ({ value: String(p.id), label: p.title })),
            ]}
          />
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mode === 'idea' ? 'Idea title...' : t('taskTitle' as LangKey, language)}
          className={inputCls}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        {mode === 'idea' && (
          <ResizableTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={2}
          />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim() || (mode === 'task' && !planId) || isSaving}
            className="text-xs px-3 py-1.5 bg-matrix-accent/10 text-matrix-accent rounded hover:bg-matrix-accent/20 transition-colors disabled:opacity-50"
          >
            {isSaving ? '...' : t('create' as LangKey, language)}
          </button>
          {saved && <span className="text-xs text-green-400">{t('saved' as LangKey, language)} ✓</span>}
          {(createIdea.isError || createTask.isError) && <span className="text-xs text-red-400">Error</span>}
        </div>
      </div>
    </SectionCard>
  );
}

// --- ObjectivesGlanceCard ---

export function ObjectivesGlanceCard({ language }: { language: 'en' | 'es' }) {
  const { data: missions } = useMission();
  const mission = missions?.[0];
  const { data: objectives } = useObjectives(mission?.id);

  return (
    <SectionCard title={language === 'es' ? 'Objetivos' : 'Objectives at a Glance'} icon="◎">
      {!objectives || objectives.length === 0 ? (
        <p className="text-xs text-matrix-muted py-4 text-center">
          {language === 'es' ? 'Sin objetivos' : 'No objectives yet'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {objectives.map((obj) => (
            <div key={obj.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-300 truncate flex-1">{obj.title}</span>
                <span className="text-[10px] font-mono text-matrix-muted ml-2">{obj.progress}%</span>
              </div>
              <ProgressBar value={obj.progress} />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// --- FocusQueueCard ---

export function FocusQueueCard({ language }: { language: 'en' | 'es' }) {
  const { data: allTasks } = useTasks();
  const updateTask = useUpdateTask();

  const statusIcon: Record<string, string> = { pending: '○', in_progress: '◐', done: '●' };
  const statusColor: Record<string, string> = {
    pending: 'text-gray-500',
    in_progress: 'text-matrix-warning',
    done: 'text-matrix-success',
  };
  const nextStatus: Record<string, string> = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
  const prioOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const prioDot: Record<string, string> = {
    low: 'bg-gray-500',
    medium: 'bg-blue-400',
    high: 'bg-orange-400',
    urgent: 'bg-red-400',
  };

  const focusTasks = [...(allTasks || [])].sort((a, b) => {
    // done tasks go to the bottom
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9);
  });

  return (
    <SectionCard title={language === 'es' ? 'Cola de enfoque' : 'Focus Queue'} icon="▸">
      {focusTasks.length === 0 ? (
        <p className="text-xs text-matrix-muted py-4 text-center">
          {language === 'es' ? 'Sin tareas pendientes' : 'All clear!'}
        </p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto pr-4">
          {focusTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 py-1 group">
              <button
                onClick={() => updateTask.mutate({ id: task.id, status: nextStatus[task.status] })}
                className={`text-xs ${statusColor[task.status]}`}
              >
                {statusIcon[task.status]}
              </button>
              <span
                className={`text-sm flex-1 truncate ${task.status === 'done' ? 'line-through text-gray-600' : 'text-gray-300'}`}
              >
                {task.title}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${prioDot[task.priority]}`} />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// --- TaskDistributionCard ---

export function TaskDistributionCard({ language }: { language: 'en' | 'es' }) {
  const { data: allTasks } = useTasks();

  const counts: Record<string, number> = { pending: 0, in_progress: 0, done: 0 };
  for (const t of allTasks || []) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }
  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  const bars = [
    { key: 'done', label: language === 'es' ? 'Hecho' : 'Done', color: 'bg-green-500', count: counts.done },
    {
      key: 'in_progress',
      label: language === 'es' ? 'En progreso' : 'In Progress',
      color: 'bg-amber-500',
      count: counts.in_progress,
    },
    { key: 'pending', label: language === 'es' ? 'Pendiente' : 'Pending', color: 'bg-gray-500', count: counts.pending },
  ];

  return (
    <SectionCard title={language === 'es' ? 'Distribución de tareas' : 'Task Breakdown'} icon="◔">
      {total === 0 ? (
        <p className="text-xs text-matrix-muted py-4 text-center">{t('noTasks' as LangKey, language)}</p>
      ) : (
        <div className="space-y-2">
          {/* Stacked bar */}
          <div className="flex h-3 rounded-full overflow-hidden">
            {bars
              .filter((b) => b.count > 0)
              .map((b) => (
                <div key={b.key} className={`${b.color}/70`} style={{ width: `${(b.count / total) * 100}%` }} />
              ))}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {bars.map((b) => (
              <div key={b.key} className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${b.color}/70`} />
                <span className="text-gray-400 flex-1">{b.label}</span>
                <span className="text-matrix-muted font-mono text-[10px]">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// --- UpcomingDeadlinesCard ---

export function UpcomingDeadlinesCard({ language }: { language: 'en' | 'es' }) {
  const { data: allTasks } = useTasks();

  const tasksWithDeadline = [...(allTasks || [])]
    .filter((t) => t.deadline && t.status !== 'done')
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
    .slice(0, 5);

  const daysLeft = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    return diff;
  };
  const daysColor = (d: number) =>
    d <= 1 ? 'text-red-400' : d <= 3 ? 'text-orange-400' : d <= 7 ? 'text-amber-400' : 'text-gray-500';

  // If no real deadlines, show mock data
  const mockDeadlines = [
    { title: 'API contracts finalization', deadline: '2026-03-12', dLeft: 3 },
    { title: 'Design review sprint 4', deadline: '2026-03-14', dLeft: 5 },
    { title: 'Staging deployment', deadline: '2026-03-16', dLeft: 7 },
    { title: 'Documentation update', deadline: '2026-03-20', dLeft: 11 },
  ];

  const hasReal = tasksWithDeadline.length > 0;
  const items = hasReal
    ? tasksWithDeadline.map((t) => ({ title: t.title, dLeft: daysLeft(t.deadline!) }))
    : mockDeadlines.map((m) => ({ title: m.title, dLeft: m.dLeft }));

  return (
    <SectionCard title={language === 'es' ? 'Próximos vencimientos' : 'Upcoming Deadlines'} icon="⏰">
      {!hasReal && <p className="text-[10px] text-matrix-muted/50 mb-2 italic">Sample data</p>}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={`${daysColor(item.dLeft)} font-mono text-[10px] w-7 text-right shrink-0`}>
              {item.dLeft <= 0 ? 'today' : `${item.dLeft}d`}
            </span>
            <span className="text-gray-400 flex-1 truncate">{item.title}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// --- ScratchpadCard ---

export function ScratchpadCard({ language }: { language: 'en' | 'es' }) {
  const [notes, setNotes] = useState(() => {
    try {
      return localStorage.getItem('matrix-scratchpad') || '';
    } catch {
      return '';
    }
  });

  const handleChange = (val: string) => {
    setNotes(val);
    try {
      localStorage.setItem('matrix-scratchpad', val);
    } catch {
      /* ignore */
    }
  };

  return (
    <SectionCard title={language === 'es' ? 'Bloc de notas' : 'Scratchpad'} icon="✏">
      <ResizableTextarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={language === 'es' ? 'Escribe notas rápidas aquí...' : 'Quick notes, reminders, ideas...'}
        rows={5}
      />
      <p className="text-[10px] text-gray-500 mt-1 text-right">
        {language === 'es' ? 'Guardado localmente' : 'Saved locally'}
      </p>
    </SectionCard>
  );
}
