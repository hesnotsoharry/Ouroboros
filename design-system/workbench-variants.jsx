/* global React, Icon, ToolGlyph, TermLine, HOOK_EVENTS, FILES_TOUCHED, CC_TUI_LINES, DIFF_HUNK */
/* workbench-variants.jsx — exploration artboards beyond the hero */

const { useState: useStateV } = React;

// ─────────────────────────────────────────────────────────────────────────────
// 1) TERMINAL TREATMENT MATRIX  — 4 ways to handle the black-canvas-vs-glass clash
// ─────────────────────────────────────────────────────────────────────────────

function MiniCCTUI({ lines = 12 }) {
  const subset = CC_TUI_LINES.slice(0, lines);
  return (
    <div style={{ padding: '10px 12px', flex: 1, overflow: 'hidden' }}>
      {subset.map((l, i) => <TermLine key={i} line={l} />)}
    </div>
  );
}

function TermTreatmentCard({ title, tag, body, bodyClass, bodyStyle, footer }) {
  return (
    <div className="wb-glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 360, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--stroke-faint)',
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 5,
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#0a0b14', fontSize: 10, fontWeight: 800,
        }}>A</span>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <span style={{ flex: 1 }} />
        <span className="wb-pill accent" style={{ fontSize: 10 }}>{tag}</span>
      </div>
      <div className={`wb-term ${bodyClass || ''}`} style={{
        flex: 1, margin: 12, borderRadius: 10, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        ...bodyStyle,
      }}>
        {body}
      </div>
      <div style={{ padding: '0 14px 12px', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
        {footer}
      </div>
    </div>
  );
}

function TerminalTreatments() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Terminal treatments
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 760 }}>
            The xterm canvas defaults to <span className="wb-mono" style={{ color: 'var(--ink-2)' }}>#0c0c0e</span> opaque
            — it punches a hole through the glass shell. Four ways to fix it, ordered from safest to most adventurous.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* A — Tinted well */}
          <TermTreatmentCard
            title="A · Tinted well  ⟶  recommended"
            tag="default"
            bodyStyle={{
              background: 'rgba(6, 8, 16, 0.62)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -50px 60px -20px rgba(0,0,0,0.4)',
            }}
            body={<MiniCCTUI lines={11} />}
            footer={<>
              Terminal bg drops from opaque <span className="wb-mono">#0c0c0e</span> to <span className="wb-mono">rgba(6,8,16,0.62)</span> with an inset shadow.
              Set <span className="wb-mono">--terminal-canvas-opacity: 0.86</span> on the xterm canvas so cell backgrounds tint with the glass underneath.
              Reads as a deeper well, not a hole.
            </>}
          />

          {/* B — Framed slab */}
          <TermTreatmentCard
            title="B · Framed slab"
            tag="conservative"
            bodyStyle={{
              background: '#06070f',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.04), 0 0 30px -8px rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(129, 140, 248, 0.18)',
            }}
            body={<MiniCCTUI lines={11} />}
            footer={<>
              Keep xterm fully opaque, but wrap it in heavy glass chrome — accent-tinted outer glow, 1px inner stroke, and
              a labelled chrome row above. The contrast is intentional: terminal as <i>monitor</i>, shell as <i>frame</i>.
            </>}
          />

          {/* C — Duotone */}
          <TermTreatmentCard
            title="C · Duotone"
            tag="bold"
            bodyStyle={{
              background: '#02030a',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              border: 'none',
              borderRadius: 0,
              margin: 0,
            }}
            body={<MiniCCTUI lines={11} />}
            footer={<>
              Don't try to unify the materials — embrace the contrast. Glass titlebar/rails/sidebar against a matte black
              terminal slab that goes edge-to-edge. The black <i>is</i> the design. Most legible for long terminal sessions.
            </>}
          />

          {/* D — Hover-glass cards */}
          <TermTreatmentCard
            title="D · Cards-only"
            tag="reimagine"
            bodyStyle={{
              background: 'rgba(6, 8, 16, 0.62)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            }}
            body={<HoverGlassPreview />}
            footer={<>
              Hide the raw terminal output entirely. Every hook event becomes a glass card; the CC TUI prompt sits at the
              bottom. Closer to the CC desktop app aesthetic — beautiful, but you give up the literal terminal.
            </>}
          />
        </div>
      </div>
    </div>
  );
}

// Preview of the "cards-only" world
function HoverGlassPreview() {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'hidden' }}>
      <MiniHookCard tool="Read" path="TerminalPane.tsx" meta="412 lines · 240ms" />
      <MiniHookCard tool="Grep" path='"hookEvent"' meta="38 matches · 12 files" />
      <MiniHookCard tool="Edit" path="TerminalPane.tsx" meta="+28 −12" active />
      <MiniHookCard tool="Bash" path="pnpm typecheck" meta="✓ 1.3s" />
      <div style={{ flex: 1 }} />
      <div className="wb-cc-prompt" style={{ margin: 0 }}>
        <span className="wb-cc-prompt-chevron">&gt;</span>
        <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>add a snapshot test…</span>
        <span className="wb-cursor" />
      </div>
    </div>
  );
}

function MiniHookCard({ tool, path, meta, active }) {
  return (
    <div className="wb-glass-card" style={{
      padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8,
      borderColor: active ? 'var(--accent-edge)' : 'var(--stroke-inner)',
      background: active ? 'var(--accent-tint)' : 'var(--glass-panel-hi)',
    }}>
      <ToolGlyph tool={tool} size={11} />
      <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>{tool}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{meta}</span>
      {active && <span className="wb-dot live" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) COMMAND-BLOCK / HOOK-EVENT TREATMENT MATRIX
// ─────────────────────────────────────────────────────────────────────────────

function CommandBlockTreatments() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Hook event treatments
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            We can't reliably parse the CC TUI scrollback, but the <span className="wb-mono" style={{ color: 'var(--ink-2)' }}>PreToolUse</span>
            {' / '}<span className="wb-mono" style={{ color: 'var(--ink-2)' }}>PostToolUse</span>{' / '}
            <span className="wb-mono" style={{ color: 'var(--ink-2)' }}>Stop</span> hooks fire reliable JSON events. Each treatment uses the same data — just rendered differently.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          <CmdBlockCard
            title="A · Subtle pills"
            tag="dense"
            body={<SubtlePills />}
            footer={<>One-line pills. Tool + path + timing. Ten can fit in 200px. Best when you trust the agent and want a glance, not detail.</>}
          />
          <CmdBlockCard
            title="B · Adaptive cards"
            tag="recommended"
            body={<AdaptiveCards />}
            footer={<>Running calls are full glass cards; completed ones shrink to one-line summaries. Detail when you need it, density when you don't.</>}
          />
          <CmdBlockCard
            title="C · Threaded timeline"
            tag="reimagine"
            body={<ThreadedTimeline />}
            footer={<>Each prompt opens a tree. Sub-agent spawns branch out. The whole session reads like a flame chart you can step through.</>}
          />
        </div>
      </div>
    </div>
  );
}

function CmdBlockCard({ title, tag, body, footer }) {
  return (
    <div className="wb-glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 480 }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <span style={{ flex: 1 }} />
        <span className="wb-pill accent" style={{ fontSize: 10 }}>{tag}</span>
      </div>
      <div style={{ flex: 1, padding: 12, overflow: 'auto', minHeight: 0 }}>{body}</div>
      <div style={{ padding: '0 14px 12px', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>{footer}</div>
    </div>
  );
}

function SubtlePills() {
  const events = HOOK_EVENTS.filter((e) => e.kind === 'tool');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {events.map((e) => (
        <div key={e.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px', borderRadius: 8,
          background: e.status === 'running' ? 'var(--accent-tint)' : 'transparent',
          border: e.status === 'running' ? '1px solid var(--accent-edge)' : '1px solid transparent',
        }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background:
            e.status === 'ok' ? 'var(--success)' :
            e.status === 'warn' ? 'var(--warning)' :
            e.status === 'running' ? 'var(--accent)' : 'var(--ink-3)' }} />
          <ToolGlyph tool={e.tool} size={11} />
          <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500, minWidth: 36 }}>{e.tool}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>{e.target}</span>
          {e.adds > 0 && <span style={{ fontSize: 10, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>+{e.adds}</span>}
          {e.dels > 0 && <span style={{ fontSize: 10, color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>−{e.dels}</span>}
          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'right' }}>
            {e.status === 'running' ? '…' : (e.duration < 1000 ? `${e.duration}ms` : `${(e.duration/1000).toFixed(1)}s`)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AdaptiveCards() {
  const events = HOOK_EVENTS.filter((e) => e.kind === 'tool').slice(-6);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map((e, i) => {
        const expanded = e.status === 'running' || i === events.length - 2;
        return expanded ? (
          <div key={e.id} className="wb-glass-card" style={{
            padding: 10, borderColor: e.status === 'running' ? 'var(--accent-edge)' : 'var(--stroke-inner)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ToolGlyph tool={e.tool} size={13} />
              <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{e.tool}</span>
              {e.status === 'running' && (
                <span className="wb-pill accent" style={{ fontSize: 9 }}>
                  <span className="wb-dot accent" /> running
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                {e.status === 'running' ? 'now' : `${(e.duration/1000).toFixed(1)}s`}
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
              background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{e.target}</div>
            {e.status === 'running' && (
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '72%', background: 'var(--accent)', boxShadow: 'var(--accent-glow)' }} />
              </div>
            )}
            {(e.adds || e.dels) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--success)' }}>+{e.adds || 0}</span>
                <span style={{ color: 'var(--error)' }}>−{e.dels || 0}</span>
              </div>
            )}
          </div>
        ) : (
          <div key={e.id} style={{
            padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8,
            opacity: 0.7,
          }}>
            <ToolGlyph tool={e.tool} size={11} />
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{e.tool}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>{e.target}</span>
            <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              {(e.duration/1000).toFixed(1)}s
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ThreadedTimeline() {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.65 }}>
      <ThreadRow icon="prompt" color="var(--accent)" label='"refactor TerminalPane to use the new hook event API"' />
      <ThreadRow icon="branch" indent={1} tool="Read" sub="TerminalPane.tsx" tail="240ms" />
      <ThreadRow icon="branch" indent={1} tool="Read" sub="CommandBlockOverlay.tsx" tail="180ms" />
      <ThreadRow icon="branch" indent={1} tool="Grep" sub='"hookEvent" · 38 matches' tail="320ms" />
      <ThreadRow icon="think" indent={1} label="Thinking" tail="4.2s" />
      <ThreadRow icon="branch" indent={1} tool="Edit" sub="TerminalPane.tsx · +28 −12" tail="410ms" />
      <ThreadRow icon="branch" indent={1} tool="Bash" sub="pnpm typecheck · ✓" tail="1.3s" />
      <ThreadRow icon="subagent" indent={1} label="↳ spawned: writer" sub="add hook subscription helper" />
      <ThreadRow icon="branch" indent={2} tool="Write" sub="useHookSubscription.ts · +64" tail="380ms" />
      <ThreadRow icon="branch" indent={2} tool="Bash" sub="pnpm test:run · ✓ 24 / ⚠ 2 snapshots" tail="4.2s" />
      <ThreadRow icon="done" indent={1} label="Done · 1m 18s · $0.08" />
    </div>
  );
}

function ThreadRow({ icon, indent = 0, color, label, tool, sub, tail }) {
  const colorMap = {
    prompt: 'var(--accent)', branch: 'var(--ink-3)', think: 'var(--purple)',
    subagent: 'var(--info)', done: 'var(--success)',
  };
  const dot = color || colorMap[icon];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: indent * 16, position: 'relative' }}>
      {indent > 0 && (
        <span style={{
          position: 'absolute', left: indent * 16 - 10, top: 0, bottom: -4,
          width: 1, background: 'var(--stroke-faint)',
        }} />
      )}
      <span style={{
        marginTop: 6, width: 7, height: 7, borderRadius: icon === 'subagent' ? 2 : 999,
        background: dot, flexShrink: 0,
        boxShadow: icon === 'prompt' ? 'var(--accent-glow)' : 'none',
      }} />
      {tool ? (
        <>
          <span style={{ display: 'inline-flex', marginTop: 2 }}><ToolGlyph tool={tool} size={11} /></span>
          <span style={{ color: 'var(--ink-2)', fontWeight: 500, minWidth: 36 }}>{tool}</span>
          <span style={{ color: 'var(--ink-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
        </>
      ) : (
        <>
          <span style={{ color: icon === 'prompt' ? 'var(--ink)' : icon === 'subagent' ? 'var(--info)' : 'var(--ink-2)', flex: 1, fontStyle: icon === 'prompt' ? 'italic' : 'normal' }}>{label}</span>
          {sub && <span style={{ color: 'var(--ink-3)' }}>{sub}</span>}
        </>
      )}
      {tail && <span style={{ color: 'var(--ink-4)' }}>{tail}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) AGENT ACTIVITY SIDEBAR VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

function SidebarVariants() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Agent activity surface
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            Where does the live state live? Three placements, each with trade-offs in screen real-estate and glanceability.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          <SbVariant
            title="A · Right rail (default)"
            tag="recommended"
            body={<SbRightRail />}
            footer={<>Persistent 348px panel. Always-on glance: now block, context donut, files, latest hunk, hook timeline. Cost: a chunk of horizontal space.</>}
          />
          <SbVariant
            title="B · Floating HUD"
            tag="minimal"
            body={<SbFloatingHUD />}
            footer={<>Collapses to a single glass pill in the corner — tool + duration. Click to expand a popover with the full panel. Reclaims 348px for the terminals.</>}
          />
          <SbVariant
            title="C · Bottom dock"
            tag="alternative"
            body={<SbBottomDock />}
            footer={<>Activity lives in a horizontal strip under the terminals. Hook events scroll left to right. Good if you favour vertical space.</>}
          />
        </div>
      </div>
    </div>
  );
}

function SbVariant({ title, tag, body, footer }) {
  return (
    <div className="wb-glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 540 }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <span style={{ flex: 1 }} />
        <span className="wb-pill accent" style={{ fontSize: 10 }}>{tag}</span>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden',
        background: 'rgba(0,0,0,0.18)', borderRadius: '0 0 10px 10px', minHeight: 0,
      }}>{body}</div>
      <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>{footer}</div>
    </div>
  );
}

// Mini fake workbench background for sidebar variants
function MiniWorkbenchBg({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      background: 'linear-gradient(135deg, rgba(20,22,36,0.4), rgba(10,12,20,0.6))',
    }}>
      {/* fake project rail */}
      <div style={{ width: 24, background: 'rgba(0,0,0,0.2)', borderRight: '1px solid var(--stroke-faint)' }} />
      {/* fake inner rail */}
      <div style={{ width: 60, background: 'rgba(0,0,0,0.12)', borderRight: '1px solid var(--stroke-faint)', padding: 6 }}>
        <div style={{ height: 6, background: 'var(--stroke-inner)', borderRadius: 3, marginBottom: 4 }} />
        <div style={{ height: 6, background: 'var(--stroke-faint)', borderRadius: 3, marginBottom: 4 }} />
        <div style={{ height: 6, background: 'var(--stroke-faint)', borderRadius: 3 }} />
      </div>
      {children}
    </div>
  );
}

function SbRightRail() {
  return (
    <MiniWorkbenchBg>
      <div style={{ flex: 1, padding: 8 }}>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 6, height: '100%', padding: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', overflow: 'hidden' }}>
          <div className="ink2">✻ Welcome to Claude Code</div>
          <div style={{ height: 4 }} />
          <div>⏺ <span className="pur">Read</span><span className="dim">(TerminalPane.tsx)</span></div>
          <div className="dim">  ⎿ 412 lines</div>
          <div>⏺ <span className="pur">Edit</span><span className="dim">(TerminalPane.tsx)</span></div>
        </div>
      </div>
      {/* the rail itself */}
      <div style={{ width: 160, background: 'var(--glass-panel)', backdropFilter: 'var(--blur-soft)', borderLeft: '1px solid var(--stroke-faint)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="wb-glass-card" style={{ padding: 8 }}>
          <div className="wb-label" style={{ fontSize: 8, color: 'var(--accent-hi)' }}>NOW</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <ToolGlyph tool="Edit" size={10} />
            <span style={{ fontSize: 9, color: 'var(--ink)' }}>Edit · 6s</span>
          </div>
          <div style={{ height: 2, background: 'var(--accent)', borderRadius: 99, marginTop: 4, width: '60%' }} />
        </div>
        <div className="wb-glass-card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, border: '2px solid var(--accent)', borderBottomColor: 'transparent' }} />
          <span style={{ fontSize: 8, color: 'var(--ink-2)' }}>23% · 46k</span>
        </div>
        <div style={{ fontSize: 8, color: 'var(--ink-3)' }}>FILES · 4</div>
        <div className="wb-glass-card" style={{ padding: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-2)' }}>TerminalPane.tsx <span style={{ color: 'var(--success)' }}>+28</span></div>
        <div className="wb-glass-card" style={{ padding: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-2)' }}>useHookSubscription.ts <span style={{ color: 'var(--success)' }}>+64</span></div>
      </div>
    </MiniWorkbenchBg>
  );
}

function SbFloatingHUD() {
  return (
    <MiniWorkbenchBg>
      <div style={{ flex: 1, padding: 8, position: 'relative' }}>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 6, height: '100%', padding: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', overflow: 'hidden' }}>
          <div className="ink2">✻ Welcome to Claude Code</div>
          <div style={{ height: 4 }} />
          <div>⏺ <span className="pur">Read</span><span className="dim">(TerminalPane.tsx)</span></div>
          <div className="dim">  ⎿ 412 lines</div>
          <div>⏺ <span className="pur">Grep</span><span className="dim">("hookEvent")</span></div>
          <div className="dim">  ⎿ 38 matches</div>
          <div>⏺ <span className="pur">Edit</span><span className="dim">(TerminalPane.tsx)</span></div>
          <div>  ⎿  <span style={{ color: 'var(--success)' }}>+28</span> <span style={{ color: 'var(--error)' }}>−12</span></div>
          <div>⏺ <span className="pur">Bash</span><span className="dim">(pnpm typecheck)</span></div>
        </div>
        {/* The HUD pill */}
        <div className="wb-glass-card" style={{
          position: 'absolute', bottom: 18, right: 18,
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
          borderColor: 'var(--accent-edge)', background: 'var(--accent-tint)',
          boxShadow: 'var(--accent-glow), var(--shadow-card)',
        }}>
          <div style={{ position: 'relative', width: 20, height: 20 }}>
            <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)', borderRadius: 999, animation: 'dotPulse 1.6s linear infinite' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--accent-hi)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ToolGlyph tool="Edit" size={10} /> Edit · 6s
            </div>
            <div style={{ fontSize: 8, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>TerminalPane.tsx</div>
          </div>
          <span style={{ width: 1, height: 18, background: 'var(--stroke-inner)', margin: '0 2px' }} />
          <div style={{ fontSize: 8, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span><span style={{ color: 'var(--success)' }}>+28</span> <span style={{ color: 'var(--error)' }}>−12</span></span>
            <span>23% ctx</span>
          </div>
        </div>
      </div>
    </MiniWorkbenchBg>
  );
}

function SbBottomDock() {
  return (
    <MiniWorkbenchBg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 8, gap: 6 }}>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', overflow: 'hidden' }}>
          <div className="ink2">✻ Welcome to Claude Code</div>
          <div style={{ height: 4 }} />
          <div>⏺ <span className="pur">Read</span> · 412 lines</div>
          <div>⏺ <span className="pur">Edit</span> · TerminalPane.tsx</div>
        </div>
        {/* The dock */}
        <div style={{
          background: 'var(--glass-panel)', backdropFilter: 'var(--blur-soft)',
          borderRadius: 8, border: '1px solid var(--stroke-faint)',
          padding: 6, display: 'flex', alignItems: 'center', gap: 4,
          height: 56,
        }}>
          {[
            { tool: 'Read', tail: '240ms', ok: true },
            { tool: 'Read', tail: '180ms', ok: true },
            { tool: 'Grep', tail: '320ms', ok: true },
            { tool: 'Edit', tail: '410ms', ok: true },
            { tool: 'Bash', tail: '1.3s', ok: true },
            { tool: 'Edit', tail: 'now', running: true },
          ].map((c, i) => (
            <div key={i} style={{
              flex: 1, minWidth: 0, height: '100%',
              padding: 6, borderRadius: 6,
              background: c.running ? 'var(--accent-tint)' : 'rgba(255,255,255,0.03)',
              border: c.running ? '1px solid var(--accent-edge)' : '1px solid var(--stroke-faint)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            }}>
              <ToolGlyph tool={c.tool} size={10} />
              <span style={{ fontSize: 8, color: 'var(--ink-2)' }}>{c.tool}</span>
              <span style={{ fontSize: 7, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{c.tail}</span>
            </div>
          ))}
          <div style={{ width: 1, height: '70%', background: 'var(--stroke-faint)' }} />
          <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>23%</span>
            <span style={{ fontSize: 7, color: 'var(--ink-3)' }}>CTX</span>
          </div>
        </div>
      </div>
    </MiniWorkbenchBg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) THEME SHOWCASE — same content, 3 themes
// ─────────────────────────────────────────────────────────────────────────────

function ThemeShowcase() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Theme showcase
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            Glass survives the theme swap by recolouring the wash, accent, and stroke layers. Retro is the special case —
            phosphor + scanlines need an opaque material; we drop glass and lean into CRT.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          <ThemePreview theme="modern" name="Modern" sub="indigo · default · glass" />
          <ThemePreview theme="warp"   name="Warp"   sub="amber · sand · glass" />
          <ThemePreview theme="retro"  name="Retro"  sub="phosphor green · CRT · matte" />
        </div>
      </div>
    </div>
  );
}

function ThemePreview({ theme, name, sub }) {
  return (
    <div className="wb-glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 520 }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{sub}</div>
        </div>
      </div>
      <div data-theme={theme} className="wb-stage" style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', borderRadius: '0 0 10px 10px' }}>
        <ThemeMiniBench />
      </div>
    </div>
  );
}

function ThemeMiniBench() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 10, gap: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8,
        border: '1px solid var(--stroke-faint)',
      }}>
        <Icon.Branch size={11} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>agent-ide</span>
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>· wave/96-glass-pivot</span>
      </div>

      <div className="wb-term" style={{
        flex: 1, borderRadius: 8, padding: '10px 12px', minHeight: 0, overflow: 'hidden',
        background: 'var(--term-bg)', boxShadow: 'var(--term-inset)',
      }}>
        {CC_TUI_LINES.slice(0, 12).map((l, i) => <TermLine key={i} line={l} />)}
      </div>

      <div className="wb-glass-card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="wb-dot live" />
        <ToolGlyph tool="Edit" size={11} />
        <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500 }}>Edit</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>TerminalPane.tsx</span>
        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>+28 −12</span>
      </div>

      <div className="wb-cc-prompt" style={{ margin: 0 }}>
        <span className="wb-cc-prompt-chevron">&gt;</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>add a snapshot test…</span>
        <span className="wb-cursor" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) PROJECT RAIL VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
function RailVariants() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Project + session rail
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 820 }}>
            You typically run 2–3 projects with 1–2 sessions each. The dual-rail (outer projects, inner sessions+files) is
            the default — but here's how it could compress for laptops.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <SbVariant
            title="A · Dual rail (default)"
            tag="recommended"
            body={<DualRailBody />}
            footer={<>Outer rail = projects (56px). Inner rail = sessions + filetree (256px). The session list and shells live inside the project context.</>}
          />
          <SbVariant
            title="B · Unified rail"
            tag="compact"
            body={<UnifiedRailBody />}
            footer={<>One 220px rail, projects shown as collapsible groups. Sessions and files nest under their project. Saves 92px when you only have one project open.</>}
          />
        </div>
      </div>
    </div>
  );
}

function DualRailBody() {
  return (
    <div style={{ display: 'flex', height: '100%', background: 'rgba(0,0,0,0.18)' }}>
      <div style={{ width: 48, background: 'rgba(20,22,36,0.5)', backdropFilter: 'var(--blur-soft)', borderRight: '1px solid var(--stroke-faint)', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {[
          { c: '#818cf8', i: 'A', active: true },
          { c: '#f472b6', i: 'P' },
          { c: '#34d399', i: 'L' },
        ].map((p, i) => (
          <div key={i} style={{
            width: 30, height: 30, borderRadius: 9, fontSize: 12, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: p.active ? `linear-gradient(135deg, ${p.c}, ${p.c}cc)` : 'rgba(255,255,255,0.05)',
            color: p.active ? '#0a0b14' : 'var(--ink-2)',
            boxShadow: p.active ? `0 4px 12px -3px ${p.c}80` : 'none',
            border: '1px solid var(--stroke-faint)',
          }}>{p.i}</div>
        ))}
      </div>
      <div style={{ flex: 1, background: 'rgba(14,16,26,0.32)', backdropFilter: 'var(--blur-soft)', padding: 8 }}>
        <div className="wb-label" style={{ fontSize: 9, padding: '0 4px 4px' }}>SESSIONS</div>
        <RailSessionRow active label="claude · main" sub="editing TerminalPane.tsx" status="live" />
        <RailSessionRow label="claude · refactor" sub="awaiting permission" status="warn" />
        <div className="wb-label" style={{ fontSize: 9, padding: '8px 4px 4px', color: 'var(--ink-4)' }}>SHELLS</div>
        <RailSessionRow label="dev server" sub="vite · :5173" status="live" kind="shell" />
        <RailSessionRow label="test:watch" sub="✓ 24" status="live" kind="shell" />
        <div className="wb-label" style={{ fontSize: 9, padding: '8px 4px 4px' }}>FILES</div>
        <RailFile name="src" depth={0} dir open />
        <RailFile name="Terminal" depth={1} dir open />
        <RailFile name="TerminalPane.tsx" depth={2} badge="M" />
        <RailFile name="RichInputBody.tsx" depth={2} />
      </div>
    </div>
  );
}

function UnifiedRailBody() {
  return (
    <div style={{ display: 'flex', height: '100%', background: 'rgba(0,0,0,0.18)' }}>
      <div style={{ width: 220, background: 'rgba(14,16,26,0.32)', backdropFilter: 'var(--blur-soft)', padding: 6, borderRight: '1px solid var(--stroke-faint)' }}>
        {/* project A (open) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--accent-tint)', borderRadius: 6, border: '1px solid var(--accent-edge)' }}>
          <Icon.ChevronD size={10} />
          <div style={{ width: 16, height: 16, borderRadius: 4, background: 'linear-gradient(135deg, #818cf8, #818cf8cc)', color: '#0a0b14', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>A</div>
          <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, flex: 1 }}>agent-ide</span>
          <span style={{ fontSize: 9, color: 'var(--warning)', background: 'var(--warning-tint)', padding: '0 4px', borderRadius: 999 }}>4</span>
        </div>
        <div style={{ paddingLeft: 12, marginTop: 4 }}>
          <RailSessionRow active label="claude · main" sub="6s" status="live" compact />
          <RailSessionRow label="claude · refactor" sub="awaiting" status="warn" compact />
          <RailSessionRow label="dev server" status="live" kind="shell" compact />
          <RailSessionRow label="test:watch" status="live" kind="shell" compact />
          <div className="wb-label" style={{ fontSize: 9, padding: '8px 0 4px' }}>FILES</div>
          <RailFile name="src" depth={0} dir open />
          <RailFile name="Terminal" depth={1} dir open />
          <RailFile name="TerminalPane.tsx" depth={2} badge="M" />
        </div>

        {/* project B */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginTop: 8, borderRadius: 6 }}>
          <Icon.Chevron size={10} />
          <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(244,114,182,0.2)', color: '#f472b6', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>P</div>
          <span style={{ fontSize: 11, color: 'var(--ink-2)', flex: 1 }}>pinpoint</span>
        </div>

        {/* project C */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6 }}>
          <Icon.Chevron size={10} />
          <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(52,211,153,0.2)', color: '#34d399', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>L</div>
          <span style={{ fontSize: 11, color: 'var(--ink-2)', flex: 1 }}>lumen-cli</span>
          <span style={{ fontSize: 9, color: 'var(--warning)', background: 'var(--warning-tint)', padding: '0 4px', borderRadius: 999 }}>2</span>
        </div>
      </div>
      <div style={{ flex: 1, padding: 14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>
        <div className="ink2">✻ Claude Code · sonnet-4.5</div>
        <div style={{ height: 4 }} />
        <div>⏺ <span className="pur">Edit</span><span className="dim">(TerminalPane.tsx)</span></div>
        <div className="dim">  ⎿  <span style={{ color: 'var(--success)' }}>+28</span> <span style={{ color: 'var(--error)' }}>−12</span></div>
      </div>
    </div>
  );
}

function RailSessionRow({ label, sub, status = 'idle', active, kind = 'cc', compact }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: compact ? '3px 6px' : '5px 8px', borderRadius: 6,
      background: active ? 'var(--accent-tint)' : 'transparent',
      border: active ? '1px solid var(--accent-edge)' : '1px solid transparent',
      marginBottom: 2,
    }}>
      <span className={`wb-dot ${status}`} />
      <span style={{ color: active ? 'var(--accent-hi)' : 'var(--ink-3)', display: 'inline-flex' }}>
        {kind === 'cc' ? <Icon.Sparkle size={10} /> : <Icon.Terminal size={10} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sub && !compact && <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{sub}</div>}
      </div>
      {sub && compact && <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>{sub}</span>}
    </div>
  );
}
function RailFile({ name, depth, dir, open, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', paddingLeft: 8 + depth * 10, borderRadius: 4, fontSize: 10, color: 'var(--ink-2)' }}>
      {dir ? (open ? <Icon.ChevronD size={9} /> : <Icon.Chevron size={9} />) : <span style={{ width: 9 }} />}
      <span style={{ color: dir ? 'var(--accent-hi)' : 'var(--ink-3)', display: 'inline-flex' }}>
        {dir ? <Icon.Folder size={10} /> : <Icon.File size={10} />}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {badge && <span style={{ fontSize: 8, fontWeight: 700, color: badge === 'A' ? 'var(--success)' : 'var(--warning)' }}>{badge}</span>}
    </div>
  );
}

Object.assign(window, {
  TerminalTreatments, CommandBlockTreatments, SidebarVariants, ThemeShowcase, RailVariants,
});
