import { tailSchemaExt } from './configSchemaTailExt';

export const tailSchema = {
  workspaceSnapshots: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        commitHash: { type: 'string' },
        sessionId: { type: 'string' },
        sessionLabel: { type: 'string' },
        timestamp: { type: 'number' },
        type: { type: 'string' },
        fileCount: { type: 'number' },
      },
    },
    default: [],
  },
  commandBlocksEnabled: {
    type: 'boolean',
    default: true,
  },
  promptPattern: {
    type: 'string',
    default: '',
  },
  terminalCursorStyle: {
    type: 'string',
    enum: ['block', 'underline', 'bar'],
    default: 'block',
  },
  formatOnSave: {
    type: 'boolean',
    default: false,
  },
  installedVsxExtensions: {
    type: 'array',
    items: { type: 'object' },
    default: [],
  },
  disabledVsxExtensions: {
    type: 'array',
    items: { type: 'string' },
    default: [],
  },
  webAccessPort: {
    type: 'number',
    minimum: 1024,
    maximum: 65535,
    default: 7890,
  },
  webAccessToken: {
    type: 'string',
    default: '',
  },
  webAccessPassword: {
    type: 'string',
    default: '',
  },
  modelProviders: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        baseUrl: { type: 'string' },
        apiKey: { type: 'string' },
        models: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              provider: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        enabled: { type: 'boolean' },
        builtIn: { type: 'boolean' },
      },
    },
    default: [],
  },
  modelSlots: {
    type: 'object',
    properties: {
      terminal: { type: 'string', default: '' },
      claudeMdGeneration: { type: 'string', default: '' },
      inlineCompletion: { type: 'string', default: '' },
    },
    default: {
      terminal: '',
      claudeMdGeneration: '',
      inlineCompletion: '',
    },
  },
  authOnboardingDismissed: {
    type: 'boolean',
    default: false,
  },
  claudeMdSettings: {
    type: 'object',
    additionalProperties: false,
    properties: {
      enabled: { type: 'boolean', default: false },
      triggerMode: {
        type: 'string',
        enum: ['post-session', 'post-commit', 'manual'],
        default: 'manual',
      },
      model: { type: 'string', enum: ['haiku', 'sonnet', 'opus'], default: 'sonnet' },
      autoCommit: { type: 'boolean', default: false },
      generateRoot: { type: 'boolean', default: true },
      generateSubdirs: { type: 'boolean', default: true },
      excludeDirs: { type: 'array', items: { type: 'string' }, default: [] },
      leanMode: { type: 'boolean', default: true },
      maxLines: { type: 'number', default: 200 },
    },
    default: {
      enabled: false,
      triggerMode: 'manual',
      model: 'sonnet',
      autoCommit: false,
      generateRoot: true,
      generateSubdirs: true,
      excludeDirs: [],
      leanMode: true,
      maxLines: 200,
    },
  },
  internalMcpEnabled: {
    type: 'boolean',
    default: true,
  },
  /** Wave 48 Phase B — gate Ouroboros MCP injection per spawn. */
  internalMcpScope: {
    type: 'string',
    enum: ['always', 'task-gated', 'never'],
    default: 'task-gated',
  },
  /** Wave 48 Phase D — use --mcp-config + --strict-mcp-config on each spawn (default true). */
  internalMcpUseStrictConfig: {
    type: 'boolean',
    default: true,
  },
  autoCheckpoint: {
    type: 'boolean',
    default: true,
  },
  trustedWorkspaces: {
    type: 'array',
    items: { type: 'string' },
    default: [],
  },
  usePtyHost: {
    type: 'boolean',
    default: false,
  },
  useExtensionHost: {
    type: 'boolean',
    default: false,
  },
  /** Wave 78 — default true so existing installs keep MCP injection active. */
  useMcpHost: {
    type: 'boolean',
    default: true,
  },
  /** Wave 6 (#103) — max concurrent background agent jobs. Default 2. */
  backgroundJobsMaxConcurrent: {
    type: 'number',
    minimum: 1,
    maximum: 10,
    default: 2,
  },
  /** Wave 8 (#115) — persist PTY session descriptors to SQLite for cross-restart restore. Default off. */
  persistTerminalSessions: { type: 'boolean', default: false },
  /** Wave 14 (Package 4) — codebase graph GC settings */
  codebaseGraph: {
    type: 'object',
    additionalProperties: false,
    properties: {
      gcEnabled: { type: 'boolean', default: true },
      gcDaysThreshold: { type: 'number', minimum: 1, maximum: 3650, default: 90 },
    },
    default: { gcEnabled: true, gcDaysThreshold: 90 },
  },
  /**
   * Wave 15 / Wave 53 — structured telemetry feature flag and retention policy.
   * `structured` is local-only; data stored in userData and never transmitted.
   * `remote` is reserved for future remote transmission; explicit opt-in required.
   */
  telemetry: {
    type: 'object',
    properties: {
      structured: { type: 'boolean', default: true },
      remote: { type: 'boolean', default: false },
      retentionDays: { type: 'number', default: 30 },
      /** Wave 52 Phase B — enable the queue+drain parity pipe at startup. */
      parityQueue: {
        type: 'object',
        properties: { enabled: { type: 'boolean', default: true } },
        default: { enabled: true },
      },
    },
  },
  ...tailSchemaExt,
};
