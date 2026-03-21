import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useObjectives } from '../../hooks/useObjectives';
import { useTasks } from '../../hooks/useTasks';
import { useIdeas } from '../../hooks/useIdeas';
import { useMission } from '../../hooks/useMission';
import { useUiStore } from '../../stores/ui.store';
import { t, LangKey } from '../../lib/i18n';

function barColor(value: number): string {
  if (value <= 33) return '#ef4444';
  if (value <= 66) return '#f59e0b';
  return '#22c55e';
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value?: number; progress?: number } }>;
}

const TASK_COLORS: Record<string, string> = {
  pending: '#6b7280',
  in_progress: '#f59e0b',
  done: '#22c55e',
};

const IDEA_COLORS: Record<string, string> = {
  pending: '#6b7280',
  evaluating: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
  promoted: '#a855f7',
};

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-matrix-surface border border-matrix-border rounded px-2 py-1 text-xs">
      <p className="text-gray-300">
        {d.name}: {d.value ?? d.progress}%
      </p>
    </div>
  );
};

export function AnalyticsView() {
  const { language } = useUiStore();
  const { data: missions } = useMission();
  const mission = missions?.[0];
  const { data: objectives } = useObjectives(mission?.id);
  const { data: allTasks } = useTasks();
  const { data: allIdeas } = useIdeas();

  // Objectives progress data
  const objData = (objectives || []).map((o) => ({
    name: o.title.length > 25 ? o.title.slice(0, 25) + '…' : o.title,
    progress: o.progress ?? 0,
  }));

  // Task distribution
  const taskCounts: Record<string, number> = { pending: 0, in_progress: 0, done: 0 };
  for (const task of allTasks || []) {
    taskCounts[task.status] = (taskCounts[task.status] || 0) + 1;
  }
  const taskData = Object.entries(taskCounts)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({ name: status, value }));

  // Idea distribution
  const ideaCounts: Record<string, number> = {};
  for (const idea of allIdeas || []) {
    ideaCounts[idea.status] = (ideaCounts[idea.status] || 0) + 1;
  }
  const ideaData = Object.entries(ideaCounts)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({ name: status, value }));

  return (
    <div className="p-4 max-w-5xl space-y-6">
      <h1 className="text-lg font-medium text-gray-200">{t('analytics' as LangKey, language)}</h1>

      {/* Objectives Progress */}
      <div className="bg-matrix-surface border border-matrix-border rounded-md p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">{t('objectivesProgress' as LangKey, language)}</h2>
        {objData.length === 0 ? (
          <p className="text-xs text-matrix-muted py-4 text-center">No objectives yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={objData.length * 50 + 20}>
            <BarChart data={objData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={20}>
                {objData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.progress)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two pie charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task Distribution */}
        <div className="bg-matrix-surface border border-matrix-border rounded-md p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-3">{t('taskDistribution' as LangKey, language)}</h2>
          {taskData.length === 0 ? (
            <p className="text-xs text-matrix-muted py-4 text-center">No tasks yet</p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={taskData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {taskData.map((entry, i) => (
                      <Cell key={i} fill={TASK_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {taskData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TASK_COLORS[d.name] }} />
                    <span className="text-matrix-muted">
                      {d.name} ({d.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ideas Pipeline */}
        <div className="bg-matrix-surface border border-matrix-border rounded-md p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-3">{t('ideasPipeline' as LangKey, language)}</h2>
          {ideaData.length === 0 ? (
            <p className="text-xs text-matrix-muted py-4 text-center">No ideas yet</p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={ideaData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {ideaData.map((entry, i) => (
                      <Cell key={i} fill={IDEA_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {ideaData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: IDEA_COLORS[d.name] }} />
                    <span className="text-matrix-muted">
                      {d.name} ({d.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
