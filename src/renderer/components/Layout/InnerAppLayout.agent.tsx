/**
 * InnerAppLayout.agent.tsx — AgentSidebarContent and its ChatErrorBoundary.
 * Extracted from InnerAppLayout.tsx to keep that file under 300 lines.
 *
 * Wave 100: AgentChat imports removed. Chat/memory/rules slots → null.
 * IDE shell intentionally non-functional pending future wave redesign.
 */

import React from 'react';

import { useConfig } from '../../hooks/useConfig';
import { SubagentPanelHost } from '../AgentMonitor/SubagentPanelHost';
import { DispatchScreen } from '../Dispatch/DispatchScreen';
import { GitPanel } from '../GitPanel';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { LazyPanelFallback } from './LazyPanelFallback';
import { RightSidebarTabs } from './RightSidebarTabs';

const AgentMonitorManager = React.lazy(() =>
  import('../AgentMonitor').then((m) => ({ default: m.AgentMonitorManager })),
);
const AnalyticsDashboard = React.lazy(() =>
  import('../Analytics').then((m) => ({ default: m.AnalyticsDashboard })),
);

function AnalyticsSuspense(): React.ReactElement {
  return (
    <ErrorBoundary label="Analytics">
      <React.Suspense fallback={<LazyPanelFallback />}>
        <AnalyticsDashboard />
      </React.Suspense>
    </ErrorBoundary>
  );
}

// ── AgentSidebarContent ───────────────────────────────────────────────────────

function AgentRightSidebarTabs({ projectRoot: _projectRoot, dispatchEnabled }: { projectRoot: string | null; dispatchEnabled: boolean }): React.ReactElement {
  return (
    <RightSidebarTabs
      monitorContent={<ErrorBoundary label="Agent Monitor"><React.Suspense fallback={<LazyPanelFallback />}><AgentMonitorManager /></React.Suspense></ErrorBoundary>}
      gitContent={<ErrorBoundary label="Git Panel"><GitPanel /></ErrorBoundary>}
      analyticsContent={<AnalyticsSuspense />}
      dispatchContent={dispatchEnabled ? <ErrorBoundary label="Dispatch"><DispatchScreen /></ErrorBoundary> : null}
      showDispatch={dispatchEnabled}
    />
  );
}

export function AgentSidebarContent({
  projectRoot,
}: {
  projectRoot: string | null;
}): React.ReactElement {
  const { config } = useConfig();
  const subagentUxEnabled = config?.agentic?.subagentUx !== false;
  const dispatchEnabled =
    config?.sessionDispatch?.enabled === true || config?.mobileAccess?.enabled === true;
  return (
    <>
      <AgentRightSidebarTabs projectRoot={projectRoot} dispatchEnabled={dispatchEnabled} />
      <SubagentPanelHost enabled={subagentUxEnabled} />
    </>
  );
}
