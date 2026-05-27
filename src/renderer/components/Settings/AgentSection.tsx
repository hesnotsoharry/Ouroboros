/**
 * AgentSection.tsx — Settings controls for agent features (inline edit, background jobs).
 *
 * Wave 100 Phase H: Agent Chat groups, Context Layer group, and AgentContextPacketSection
 * removed (those config keys are cut with the chat surface).
 */

import type { CSSProperties } from 'react';
import React from 'react';

import type { AppConfig } from '../../types/electron';
import {
  claudeSectionBudgetInputStyle,
  claudeSectionRootStyle,
  claudeSectionSectionDescriptionStyle,
} from './claudeSectionContentStyles';
import { SectionLabel } from './settingsStyles';

const BACKGROUND_JOBS_MIN = 1;
const BACKGROUND_JOBS_MAX = 8;

interface AgentSectionProps {
  draft: AppConfig;
  onChange: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}

export function AgentSection({ draft, onChange }: AgentSectionProps): React.ReactElement {
  return (
    <div style={claudeSectionRootStyle}>
      <AgentFeaturesGroup draft={draft} onChange={onChange} />
    </div>
  );
}

function BackgroundJobsSection({ draft, onChange }: AgentSectionProps): React.ReactElement {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const parsed = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onChange(
      'backgroundJobsMaxConcurrent',
      Math.min(BACKGROUND_JOBS_MAX, Math.max(BACKGROUND_JOBS_MIN, parsed)),
    );
  }

  return (
    <section>
      <SectionLabel>Background Jobs Concurrency</SectionLabel>
      <p className="text-text-semantic-muted" style={claudeSectionSectionDescriptionStyle}>
        Maximum number of background agent jobs that can run in parallel (1–8).
      </p>
      <div style={concurrencyRowStyle}>
        <input
          aria-label="Background jobs max concurrency"
          className="text-text-semantic-primary"
          max={BACKGROUND_JOBS_MAX}
          min={BACKGROUND_JOBS_MIN}
          step={1}
          style={claudeSectionBudgetInputStyle}
          type="number"
          value={draft.backgroundJobsMaxConcurrent ?? 2}
          onChange={handleChange}
        />
        <span className="text-text-semantic-faint" style={restartHintStyle}>
          Applies on next restart
        </span>
      </div>
    </section>
  );
}

function AgentFeaturesGroup({ draft, onChange }: AgentSectionProps): React.ReactElement {
  return (
    <>
      <SectionLabel style={{ marginTop: '8px' }}>Inline Edit &amp; Jobs</SectionLabel>
      <BackgroundJobsSection draft={draft} onChange={onChange} />
    </>
  );
}

const concurrencyRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const restartHintStyle: CSSProperties = {
  fontSize: '11px',
};
