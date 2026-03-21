import React, { useState } from 'react';
import { useMission } from '../../hooks/useMission';
import { useObjectives } from '../../hooks/useObjectives';
import { usePlans } from '../../hooks/usePlans';
import { useTasks } from '../../hooks/useTasks';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';
import { SchemaViewMode, SchemaViewToggle } from './views/SchemaViewToggle';
import { TreeView } from './views/TreeView';
import { DashboardView } from './views/DashboardView';
import { RoadmapView } from './views/RoadmapView';
import { StrategicSchemaSetup } from './StrategicSchemaSetup';
import { SectionCard } from './primitives';
import {
  StatsCard,
  ActiveProjectsCard,
  RecentActivityCard,
  QuickCaptureCard,
  ObjectivesGlanceCard,
  FocusQueueCard,
  TaskDistributionCard,
  UpcomingDeadlinesCard,
  ScratchpadCard,
} from './DashboardCards';
import { ObjectivesChartCard, TaskPieCard, IdeasPieCard, WeeklyHeatmapCard } from './ChartCards';

function StrategicSchemaActive() {
  const { data: missions } = useMission();
  const mission = missions?.[0];
  const { data: objectives } = useObjectives(mission?.id);
  const { data: allPlans } = usePlans();
  const { data: allTasks } = useTasks();

  const [schemaView, setSchemaView] = useState<SchemaViewMode>('tree');

  if (!mission) return null;

  if (schemaView === 'tree') {
    return <TreeView schemaView={schemaView} setSchemaView={setSchemaView} />;
  }

  const viewProps = {
    mission,
    objectives: objectives || [],
    allPlans: allPlans || [],
    allTasks: allTasks || [],
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <SchemaViewToggle value={schemaView} onChange={setSchemaView} />
      </div>
      {schemaView === 'dashboard' && <DashboardView {...viewProps} />}
      {schemaView === 'roadmap' && <RoadmapView {...viewProps} />}
    </div>
  );
}

export function OverviewView() {
  const { language } = useUiStore();
  const { data: missions, isLoading } = useMission();
  const mission = missions?.[0];

  if (isLoading) return <div className="p-4 text-matrix-muted text-sm">{t('loading', language)}</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-medium text-gray-200">{t('overview', language)}</h1>

      {/* Top row: Schema left, side cards right */}
      <div className="flex gap-4">
        {/* Left: Strategic Schema + bottom cards */}
        <div className="flex-1 min-w-0 space-y-4">
          <SectionCard title="Strategic Schema" icon="◈">
            {mission ? <StrategicSchemaActive /> : <StrategicSchemaSetup />}
          </SectionCard>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StatsCard language={language} />
            <ActiveProjectsCard language={language} />
            <RecentActivityCard language={language} />
            <QuickCaptureCard language={language} />
          </div>
          {/* Analytics Charts */}
          <ObjectivesChartCard language={language} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TaskPieCard language={language} />
            <IdeasPieCard language={language} />
          </div>
        </div>

        {/* Right column: visible on xl+ */}
        <div className="hidden xl:flex flex-col gap-4 w-80 shrink-0">
          <ObjectivesGlanceCard language={language} />
          <FocusQueueCard language={language} />
          <TaskDistributionCard language={language} />
          <WeeklyHeatmapCard language={language} />
          <UpcomingDeadlinesCard language={language} />
          <ScratchpadCard language={language} />
        </div>
      </div>

      {/* Show right-column cards below on smaller screens */}
      <div className="xl:hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ObjectivesGlanceCard language={language} />
        <FocusQueueCard language={language} />
        <TaskDistributionCard language={language} />
        <WeeklyHeatmapCard language={language} />
        <UpcomingDeadlinesCard language={language} />
        <ScratchpadCard language={language} />
      </div>
    </div>
  );
}
