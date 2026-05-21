/* global React, Icon, ToolGlyph, TermLine, HOOK_EVENTS, CC_TUI_LINES */
/* workbench-states.jsx — empty + edge + permission + state-machine + responsive */

// ─────────────────────────────────────────────────────────────────────────────
// 1) AGENT SIDEBAR STATES — empty / idle / awaiting / errored / disconnected
// ─────────────────────────────────────────────────────────────────────────────

function SidebarStates() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Agent sidebar · states</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            Every visible panel needs an empty / idle / loading / error variant. These five cover the full agent-sidebar state machine.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <StateColumn name="Empty" tag="fresh project" tagTone="ink" body={<EmptySidebar />}
            note="No session yet. The NOW block is a CTA — 'Submit a prompt in the terminal'. Files list reads 'nothing touched'." />
          <StateColumn name="Idle" tag="awaiting next prompt" tagTone="ink" body={<IdleSidebar />}
            note="Session is live but Claude isn't doing anything — just sent a response, waiting for you. NOW block dims; context + files persist." />
          <StateColumn name="Permission" tag="needs approval" tagTone="warning" body={<PermissionSidebar />}
            note="PreToolUse intercepted a risky tool call. NOW block becomes a permission card with Approve / Deny / Always. Sidebar accent flips to warning." />
          <StateColumn name="Errored" tag="tool failed" tagTone="error" body={<ErroredSidebar />}
            note="A tool returned non-zero. The last hook event reads error; sidebar shows a one-line banner with a re-try / view-log action." />
          <StateColumn name="Disconnected" tag="hook stream lost" tagTone="error" body={<DisconnectedSidebar />}
            note="The hook subscription dropped. Sidebar grays out, shows reconnect spinner; tool data is stale, last-known stays visible." />
        </div>
      </div>
    </div>
  );
}

function StateColumn({ name, tag, tagTone, body, note }) {
  const tones = {
    ink: { bg: 'var(--glass-panel-hi)', color: 'var(--ink-2)' },
    warning: { bg: 'var(--warning-tint)', color: 'var(--warning)' },
    error: { bg: 'var(--error-tint)', color: 'var(--error)' },
  };
  const tone = tones[tagTone] || tones.ink;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{name}</div>
        <span style={{
          display: 'inline-block', marginTop: 4,
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
          background: tone.bg, color: tone.color, letterSpacing: '0.02em',
        }}>{tag}</span>
      </div>
      <div className="wb-glass-card" style={{
        width: '100%', minHeight: 560,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(14,16,26,0.32)', overflow: 'hidden',
      }}>{body}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>{note}</div>
    </div>
  );
}

// ── Sidebar variants ────────────────────────────────────────────────────────

function SbHeader({ status = 'live', label = 'claude · main', sub = '5m 12s · 12 calls', tone }) {
  return (
    <div style={{
      padding: '10px 12px', borderBottom: '1px solid var(--stroke-faint)',
      display: 'flex', alignItems: 'center', gap: 8,
      background: tone || 'transparent',
    }}>
      <span className={`wb-dot ${status}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--ink)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{sub}</div>
      </div>
    </div>
  );
}

function EmptySidebar() {
  return (
    <>
      <SbHeader status="idle" label="no session yet" sub="waiting for first prompt" />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, marginTop: 30 }}>
        <span style={{
          width: 56, height: 56, borderRadius: 18,
          background: 'var(--accent-tint)', border: '1px dashed var(--accent-edge)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-hi)', filter: 'drop-shadow(0 0 12px var(--accent))',
        }}>
          <Icon.Sparkle size={26} />
        </span>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 6 }}>Ready when you are</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.55, maxWidth: 220 }}>
            Submit a prompt in the terminal and Claude's activity will appear here — tool calls, files touched, diffs.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          {['/init', '/plan', '/test'].map((s) => (
            <span key={s} className="wb-pill" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--stroke-faint)', fontSize: 10, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon.Layers size={10} />
        <span>Hooks subscribed · waiting for events</span>
      </div>
    </>
  );
}

function IdleSidebar() {
  return (
    <>
      <SbHeader status="idle" label="claude · main" sub="response sent · idle 14s" />
      <div style={{ padding: 12 }}>
        <div className="wb-glass-card" style={{ padding: 12, marginBottom: 10, opacity: 0.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="wb-label" style={{ color: 'var(--ink-3)' }}>NOW</span>
            <span style={{ flex: 1 }} />
            <span className="wb-pill" style={{ fontSize: 10 }}>idle</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0 4px' }}>
            Waiting for next prompt
          </div>
        </div>

        <MiniContext used={23} />
        <MiniFilesPersisted />
      </div>
    </>
  );
}

function PermissionSidebar() {
  return (
    <>
      <SbHeader status="warn" label="claude · main" sub="paused · permission required" tone="rgba(251,191,36,0.05)" />
      <div style={{ padding: 12 }}>
        <div className="wb-glass-card" style={{ padding: 12, marginBottom: 10, borderColor: 'var(--warning)', background: 'rgba(251,191,36,0.08)', boxShadow: '0 0 0 1px rgba(251,191,36,0.18), 0 0 24px -6px rgba(251,191,36,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ color: 'var(--warning)', display: 'inline-flex' }}><Icon.Bell size={12} /></span>
            <span className="wb-label" style={{ color: 'var(--warning)' }}>PERMISSION</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>paused</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ToolGlyph tool="Bash" size={14} />
            <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>Bash</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>wants to run</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)',
            background: 'rgba(0,0,0,0.4)', padding: '6px 8px', borderRadius: 4,
            marginBottom: 10, border: '1px solid var(--stroke-faint)',
          }}>$ rm -rf node_modules && pnpm install</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="wb-btn accent" style={{ width: '100%', justifyContent: 'center', padding: '6px 10px', fontSize: 11 }}>
              <Icon.Check size={11} /> Approve once
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="wb-btn ghost-border" style={{ flex: 1, justifyContent: 'center', padding: '5px 8px', fontSize: 10.5 }}>
                Always for Bash
              </button>
              <button className="wb-btn ghost-border" style={{ flex: 1, justifyContent: 'center', padding: '5px 8px', fontSize: 10.5, color: 'var(--error)', borderColor: 'rgba(248,113,113,0.3)' }}>
                <Icon.X size={10} /> Deny
              </button>
            </div>
          </div>
        </div>
        <MiniContext used={23} />
      </div>
    </>
  );
}

function ErroredSidebar() {
  return (
    <>
      <SbHeader status="err" label="claude · main" sub="last tool failed · exit 1" tone="rgba(248,113,113,0.05)" />
      <div style={{ padding: 12 }}>
        <div className="wb-glass-card" style={{ padding: 10, marginBottom: 10, borderColor: 'var(--error)', background: 'rgba(248,113,113,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ color: 'var(--error)', display: 'inline-flex' }}><Icon.X size={12} /></span>
            <span className="wb-label" style={{ color: 'var(--error)' }}>TOOL FAILED</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>exit 1</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <ToolGlyph tool="Bash" size={12} />
            <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>Bash</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-2)' }}>pnpm typecheck</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--error)',
            background: 'rgba(0,0,0,0.4)', padding: '6px 8px', borderRadius: 4,
          }}>error TS2345: type 'string' not assignable to 'HookEvent'</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button className="wb-btn ghost-border" style={{ flex: 1, justifyContent: 'center', padding: '4px 8px', fontSize: 11 }}>
              Re-run
            </button>
            <button className="wb-btn ghost-border" style={{ flex: 1, justifyContent: 'center', padding: '4px 8px', fontSize: 11 }}>
              <Icon.Eye size={10} /> Open log
            </button>
          </div>
        </div>
        <MiniContext used={23} />
        <MiniFilesPersisted />
      </div>
    </>
  );
}

function DisconnectedSidebar() {
  return (
    <>
      <SbHeader status="err" label="claude · main" sub="hook stream offline" tone="rgba(248,113,113,0.05)" />
      <div style={{
        padding: '8px 12px', background: 'rgba(248,113,113,0.08)',
        borderBottom: '1px solid rgba(248,113,113,0.2)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: 'var(--error)',
      }}>
        <div style={{ width: 12, height: 12, borderRadius: 999, border: '2px solid var(--error)', borderTopColor: 'transparent', animation: 'dotPulse 1.2s linear infinite' }} />
        <span>Hook stream disconnected · reconnecting…</span>
      </div>
      <div style={{ padding: 12, opacity: 0.5, pointerEvents: 'none' }}>
        <div className="wb-glass-card" style={{ padding: 12, marginBottom: 10 }}>
          <div className="wb-label">NOW · stale</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <ToolGlyph tool="Edit" size={13} />
            <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Edit · TerminalPane.tsx</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>last update 12s ago</div>
        </div>
        <MiniContext used={23} muted />
        <MiniFilesPersisted />
      </div>
    </>
  );
}

function MiniContext({ used = 23, muted }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="wb-glass-card" style={{ padding: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, opacity: muted ? 0.7 : 1 }}>
      <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="22" cy="22" r={r} fill="none" stroke={muted ? 'var(--ink-3)' : 'var(--accent)'} strokeWidth="3"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - used / 100)}
            transform="rotate(-90 22 22)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{used}%</span>
        </div>
      </div>
      <div>
        <div className="wb-label" style={{ marginBottom: 2 }}>CONTEXT</div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>46.2k / 200k</div>
      </div>
    </div>
  );
}

function MiniFilesPersisted() {
  return (
    <div>
      <div className="wb-label" style={{ padding: '0 4px 6px' }}>FILES · 4</div>
      {['TerminalPane.tsx', 'useHookSubscription.ts', 'RichInputBody.tsx', 'CommandBlockOverlay.tsx'].map((f, i) => (
        <div key={i} className="wb-glass-card" style={{ padding: '6px 10px', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon.File size={11} style={{ color: 'var(--ink-3)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) PERMISSION PROMPT — full design at scale (inline overlay + sidebar)
// ─────────────────────────────────────────────────────────────────────────────

function PermissionPromptArtboard() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Permission prompt</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            When <span className="wb-mono" style={{ color: 'var(--ink-2)' }}>PreToolUse</span> returns
            <span className="wb-mono" style={{ color: 'var(--ink-2)' }}>{' { permission: "request" } '}</span>
            CC pauses. The workbench surfaces the request in two places: the agent sidebar (primary), and an inline overlay on the terminal (peripheral — so you see it without focus-shifting).
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
          {/* Inline terminal overlay */}
          <div className="wb-glass-card" style={{ minHeight: 600, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Terminal overlay</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Glass card lifts above the terminal canvas. Keyboard shortcuts: <span className="wb-mono">Y</span> approve · <span className="wb-mono">N</span> deny · <span className="wb-mono">A</span> always.</div>
            </div>
            <div style={{ flex: 1, padding: 14, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
              <div className="wb-term" style={{
                position: 'absolute', inset: 14, borderRadius: 10, overflow: 'hidden',
                background: 'var(--term-bg)', boxShadow: 'var(--term-inset)',
                padding: '14px 16px',
              }}>
                {CC_TUI_LINES.slice(0, 18).map((l, i) => <TermLine key={i} line={l} />)}
                {/* Faded last line */}
                <div className="wb-term-line dim" style={{ marginTop: 4 }}>⏺ <span className="pur">Bash</span> <span className="dim">(rm -rf node_modules && pnpm install)</span></div>
              </div>
              {/* The prompt overlay */}
              <PermissionOverlay />
            </div>
          </div>

          {/* Sidebar takeover */}
          <div className="wb-glass-card" style={{ minHeight: 600, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Sidebar takeover</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>The NOW block becomes the permission card; the rest of the sidebar dims until resolved.</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(14,16,26,0.32)', backdropFilter: 'var(--blur-soft)', overflow: 'hidden' }}>
              <PermissionSidebar />
            </div>
          </div>
        </div>

        {/* Spec strip */}
        <div className="wb-glass-card" style={{ padding: 18, marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <SpecBlock title="Trigger" body={<><span className="wb-mono" style={{ color: 'var(--ink)' }}>PreToolUse</span> returns <span className="wb-mono" style={{ color: 'var(--ink)' }}>{`{ permission: 'request', reason }`}</span> from a settings.json rule or a custom hook. Tool call is held until resolution.</>} />
          <SpecBlock title="Levels" body={<>Three answers persist differently — <i>once</i> (this call only), <i>always for [tool]</i> (whitelist for the session), <i>deny</i> (cancel + log). A fourth, <i>always-allow project</i>, ships in v2.</>} />
          <SpecBlock title="Audit" body={<>Every approval writes a row to <span className="wb-mono" style={{ color: 'var(--ink)' }}>~/.agent-ide/audit.jsonl</span> with tool, args, decision, timestamp. View via <span className="wb-mono" style={{ color: 'var(--ink)' }}>/audit</span>.</>} />
          <SpecBlock title="Timeout" body={<>If the user is away &gt; 5 minutes, the prompt auto-denies and CC receives a <span className="wb-mono" style={{ color: 'var(--ink)' }}>timeout</span> reason. Configurable.</>} />
        </div>
      </div>
    </div>
  );
}

function PermissionOverlay() {
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)',
      width: 460, maxWidth: 'calc(100% - 28px)',
      background: 'var(--glass-overlay)',
      backdropFilter: 'var(--blur-strong)', WebkitBackdropFilter: 'var(--blur-strong)',
      border: '1px solid var(--warning)',
      borderRadius: 12,
      padding: 14,
      boxShadow: '0 24px 60px -20px rgba(251,191,36,0.4), 0 0 0 1px rgba(251,191,36,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
      animation: 'slideUp 240ms ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--warning-tint)', color: 'var(--warning)',
        }}><Icon.Bell size={13} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>Permission required</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>claude · main wants to run a Bash command</div>
        </div>
        <span className="wb-pill" style={{ fontSize: 10, color: 'var(--warning)', background: 'var(--warning-tint)', border: '1px solid rgba(251,191,36,0.3)' }}>paused</span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)',
        background: 'rgba(0,0,0,0.45)', padding: '8px 12px', borderRadius: 6,
        marginBottom: 10, border: '1px solid var(--stroke-faint)',
      }}>$ rm -rf node_modules && pnpm install</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
        This will delete <span className="wb-mono" style={{ color: 'var(--ink-2)' }}>node_modules/</span> and reinstall deps. Affects current project only.
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="wb-btn accent" style={{ flex: 1, justifyContent: 'center', padding: '7px 10px' }}>
          <Icon.Check size={12} /> Approve  <span className="wb-mono" style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>Y</span>
        </button>
        <button className="wb-btn ghost-border" style={{ padding: '7px 10px', fontSize: 11 }}>
          Always · Bash <span className="wb-mono" style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>A</span>
        </button>
        <button className="wb-btn ghost-border" style={{ padding: '7px 10px', fontSize: 11, color: 'var(--error)', borderColor: 'rgba(248,113,113,0.3)' }}>
          <Icon.X size={11} /> Deny <span className="wb-mono" style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>N</span>
        </button>
      </div>
    </div>
  );
}

function SpecBlock({ title, body }) {
  return (
    <div>
      <div className="wb-label" style={{ marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) SESSION STATE MACHINE — diagram of the lifecycle
// ─────────────────────────────────────────────────────────────────────────────

function StateMachineArtboard() {
  // State nodes laid out around a horizontal flow
  const nodes = [
    { id: 'fresh',   x:  90, y: 200, label: 'fresh',         tone: 'ink',     desc: 'project opened · no CC yet' },
    { id: 'idle',    x: 320, y: 200, label: 'idle',          tone: 'idle',    desc: 'session live · awaiting prompt' },
    { id: 'thinking',x: 560, y: 110, label: 'thinking',      tone: 'purple',  desc: 'pre-tool reasoning · stream on' },
    { id: 'running', x: 560, y: 290, label: 'running',       tone: 'accent',  desc: 'PreToolUse → tool exec → PostToolUse' },
    { id: 'await',   x: 820, y: 290, label: 'awaiting',      tone: 'warning', desc: 'permission requested · paused' },
    { id: 'errored', x: 820, y: 110, label: 'errored',       tone: 'error',   desc: 'tool returned non-zero · pinned' },
    { id: 'done',    x:1060, y: 200, label: 'done',          tone: 'success', desc: 'Stop hook fired · response sent' },
  ];
  // Edges (transitions)
  const edges = [
    { from: 'fresh',    to: 'idle',     label: '/init prompt' },
    { from: 'idle',     to: 'thinking', label: 'UserPromptSubmit' },
    { from: 'thinking', to: 'running',  label: 'PreToolUse' },
    { from: 'running',  to: 'running',  label: 'next tool', curve: 'self-bottom' },
    { from: 'running',  to: 'await',    label: 'permission' },
    { from: 'await',    to: 'running',  label: 'approve' },
    { from: 'await',    to: 'errored',  label: 'deny' },
    { from: 'running',  to: 'errored',  label: 'tool failed' },
    { from: 'errored',  to: 'idle',     label: 'dismiss' },
    { from: 'running',  to: 'done',     label: 'Stop' },
    { from: 'done',     to: 'idle',     label: 'new prompt' },
  ];
  const toneColors = {
    ink: 'var(--ink-3)', idle: 'var(--ink-2)', purple: 'var(--purple)',
    accent: 'var(--accent)', warning: 'var(--warning)', error: 'var(--error)', success: 'var(--success)',
  };
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Session state machine</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            Every CC session moves through these seven states, driven entirely by hook events. The status dot in the agent globe and tab badges mirror the current state.
          </div>
        </div>

        <div className="wb-glass-card" style={{ position: 'relative', height: 480, overflow: 'hidden' }}>
          {/* SVG layer for edges */}
          <svg width="100%" height="100%" viewBox="0 0 1200 400" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill="rgba(184,188,207,0.4)" />
              </marker>
              <marker id="arrowAcc" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = byId[e.from], b = byId[e.to];
              if (!a || !b) return null;
              // self loop
              if (e.curve === 'self-bottom') {
                const cx = a.x;
                return (
                  <g key={i}>
                    <path d={`M${cx + 30} ${a.y + 10} C ${cx + 100} ${a.y + 100}, ${cx - 100} ${a.y + 100}, ${cx - 30} ${a.y + 10}`} fill="none" stroke="rgba(184,188,207,0.3)" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x={cx} y={a.y + 95} fontSize="11" fill="var(--ink-3)" textAnchor="middle">{e.label}</text>
                  </g>
                );
              }
              const dx = b.x - a.x, dy = b.y - a.y;
              const len = Math.hypot(dx, dy);
              const nx = dx / len, ny = dy / len;
              const r = 36;
              const x1 = a.x + nx * r, y1 = a.y + ny * r;
              const x2 = b.x - nx * r, y2 = b.y - ny * r;
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
              const isApprove = e.label === 'approve';
              return (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isApprove ? 'var(--accent)' : 'rgba(184,188,207,0.32)'} strokeWidth={isApprove ? 1.8 : 1.5} markerEnd={isApprove ? 'url(#arrowAcc)' : 'url(#arrow)'} />
                  <rect x={mx - String(e.label).length * 3.2 - 6} y={my - 9} width={String(e.label).length * 6.4 + 12} height={18} rx={9} fill="var(--wash-2)" stroke="var(--stroke-faint)" />
                  <text x={mx} y={my + 4} fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--ink-2)" textAnchor="middle">{e.label}</text>
                </g>
              );
            })}
          </svg>
          {/* Nodes */}
          {nodes.map((n) => {
            const c = toneColors[n.tone];
            return (
              <div key={n.id} style={{
                position: 'absolute',
                left: `${(n.x / 1200) * 100}%`, top: n.y,
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
              }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(180deg, ${c}33, ${c}11)`,
                  border: `1.5px solid ${c}`,
                  boxShadow: `0 0 20px -4px ${c}80, inset 0 1px 0 rgba(255,255,255,0.06)`,
                  fontSize: 12, fontWeight: 700, color: 'var(--ink)',
                  fontFamily: 'var(--font-mono)',
                }}>{n.label}</div>
                <div style={{
                  position: 'absolute', top: 78, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', textAlign: 'center',
                }}>{n.desc}</div>
              </div>
            );
          })}
        </div>

        {/* State table */}
        <div className="wb-glass-card" style={{ padding: 0, marginTop: 18, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1.4fr 1fr', padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            <span>State</span><span>Visual cue</span><span>Triggered by</span><span>Exits to</span>
          </div>
          {[
            ['fresh',   'gray dot · empty sidebar',           'project opened',                                 'idle (after /init)'],
            ['idle',    'idle dot · NOW block dimmed',         'response sent · Stop hook',                      'thinking, done'],
            ['thinking','purple dot · NOW shows brain icon',   'UserPromptSubmit · stream begins',               'running, idle (early stop)'],
            ['running', 'accent pulse · NOW shows tool',       'PreToolUse fires',                               'running, await, errored, done'],
            ['awaiting','warning glow · permission card',      'PreToolUse returns permission:request',           'running (approve), errored (deny), timeout'],
            ['errored', 'error banner · last hook flagged',    'tool exit non-zero · uncaught',                  'idle (dismiss), running (retry)'],
            ['done',    'success badge · 3s linger',           'Stop hook fires · no pending tools',             'idle (auto), fresh (close)'],
          ].map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 1.4fr 1fr',
              padding: '10px 14px', borderBottom: i < 6 ? '1px solid var(--stroke-faint)' : 'none',
              fontSize: 12, color: 'var(--ink-2)', alignItems: 'center',
            }}>
              <span className="wb-mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{row[0]}</span>
              <span style={{ color: 'var(--ink-3)' }}>{row[1]}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>{row[2]}</span>
              <span style={{ color: 'var(--ink-3)' }}>{row[3]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) RESPONSIVE COLLAPSE — what happens at each breakpoint
// ─────────────────────────────────────────────────────────────────────────────

function ResponsiveArtboard() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Responsive collapse</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            The design targets 1760px. Below that, panels collapse in this order: <b style={{ color: 'var(--ink)' }}>activity rail → unified rail → activity HUD → single-pane</b>. The terminal and tab bar are the last to give up space.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <BreakpointCard
            range="≥ 1760px"
            label="Full"
            tag="default"
            layout={['project', 'inner', 'term', 'agent']}
            notes="All four columns. Agent rail at 348px. The design as drawn."
          />
          <BreakpointCard
            range="1440 – 1759px"
            label="Compact"
            tag="laptops"
            layout={['project', 'inner', 'term', 'agent-narrow']}
            notes="Agent rail narrows to 300px — drops the latest-hunk diff (collapses to a one-line indicator). Everything else holds."
          />
          <BreakpointCard
            range="1180 – 1439px"
            label="Unified"
            tag="13&quot;"
            layout={['unified', 'term', 'agent-narrow']}
            notes="Project rail auto-collapses into the unified rail. Centre + agent rail share the remaining space."
          />
          <BreakpointCard
            range="< 1180px"
            label="HUD"
            tag="split / portrait"
            layout={['unified', 'term', 'hud']}
            notes="Agent rail collapses to a floating glass HUD (the one explored in section 5). User can pop it open."
          />
        </div>

        <div className="wb-glass-card" style={{ padding: 18, marginTop: 18 }}>
          <div className="wb-label" style={{ marginBottom: 10 }}>RULES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <div>
              <b style={{ color: 'var(--ink)' }}>The terminal is sacred</b><br />
              The CC TUI never goes below 720×420. Below that, kick non-terminal panels off-canvas before shrinking it.
            </div>
            <div>
              <b style={{ color: 'var(--ink)' }}>Collapse in this order</b><br />
              ① Agent latest-hunk → ② Agent rail narrows → ③ Project rail merges into inner → ④ Agent rail becomes HUD → ⑤ Inner rail becomes drawer.
            </div>
            <div>
              <b style={{ color: 'var(--ink)' }}>Tabs hold their ground</b><br />
              Terminal tab bars always render. Each tab can shrink to its status dot + project initial — never disappear.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakpointCard({ range, label, tag, layout, notes }) {
  const colorMap = {
    project: { c: '#818cf8', w: 8, label: 'P' },
    inner: { c: 'rgba(255,255,255,0.08)', w: 26, label: '' },
    unified: { c: 'rgba(129,140,248,0.18)', w: 30, label: 'U' },
    term: { c: 'rgba(6,8,16,0.7)', w: 'flex', label: '' },
    agent: { c: 'rgba(255,255,255,0.06)', w: 36, label: '' },
    'agent-narrow': { c: 'rgba(255,255,255,0.06)', w: 30, label: '' },
    hud: { c: 'rgba(129,140,248,0.3)', w: 'overlay', label: '' },
  };
  return (
    <div className="wb-glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{label}</div>
          <span className="wb-pill" style={{ fontSize: 10 }}>{tag}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{range}</div>
      </div>
      {/* mini layout sketch */}
      <div style={{
        margin: 14, height: 120, borderRadius: 8, overflow: 'hidden',
        border: '1px solid var(--stroke-faint)', background: 'rgba(0,0,0,0.2)',
        display: 'flex', position: 'relative',
      }}>
        {layout.filter((p) => p !== 'hud').map((p, i) => {
          const cfg = colorMap[p];
          if (cfg.w === 'flex') {
            return (
              <div key={i} style={{ flex: 1, background: cfg.c, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} />
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 2 }} />
                  <div style={{ flex: 0.6, background: 'rgba(255,255,255,0.02)', borderRadius: 2 }} />
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{
              width: cfg.w, background: cfg.c,
              borderRight: '1px solid rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: 'var(--ink-3)', fontWeight: 700,
            }}>{cfg.label}</div>
          );
        })}
        {/* HUD overlay */}
        {layout.includes('hud') && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            width: 56, height: 22, borderRadius: 999,
            background: 'var(--accent-tint)', border: '1px solid var(--accent-edge)',
            boxShadow: 'var(--accent-glow)',
          }} />
        )}
      </div>
      <div style={{ padding: '0 14px 14px', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{notes}</div>
    </div>
  );
}

Object.assign(window, { SidebarStates, PermissionPromptArtboard, StateMachineArtboard, ResponsiveArtboard });
