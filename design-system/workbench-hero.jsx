/* global React, Icon, ToolGlyph, TermLine, PROJECTS, TERM_TABS_UPPER, TERM_TABS_LOWER, FILE_TREE, HOOK_EVENTS, FILES_TOUCHED, DIFF_HUNK, CC_TUI_LINES, SHELL_LINES */
/* workbench-hero.jsx — the main full workbench */

const { useState, useEffect, useRef, useMemo } = React;

// ─────────────────────────────────────────────────────────────────────────────
// TITLE BAR
// ─────────────────────────────────────────────────────────────────────────────
function TitleBar({ project }) {
  return (
    <div style={{
      height: 40, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 0 0 12px', gap: 10,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.005))',
      borderBottom: '1px solid var(--stroke-faint)',
      position: 'relative', zIndex: 5,
    }}>
      {/* app mark (Windows: app icon on the left, no traffic lights) */}
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: 'linear-gradient(135deg, var(--accent), var(--purple))',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#0a0b14', fontSize: 11, fontWeight: 800,
        boxShadow: 'var(--accent-glow)',
        flexShrink: 0,
      }}>A</div>

      {/* project pill (clickable) */}
      <TitleChip>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 5,
          background: `linear-gradient(135deg, ${project.color}, ${project.color}80)`,
          color: '#0a0b14', fontSize: 10, fontWeight: 800,
        }}>{project.initial}</span>
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{project.name}</span>
        <Icon.ChevronD size={10} style={{ color: 'var(--ink-4)', marginLeft: -2 }} />
      </TitleChip>

      {/* branch pill */}
      <TitleChip>
        <Icon.Branch size={11} style={{ color: 'var(--ink-3)' }} />
        <span style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{project.branch}</span>
        <Icon.ChevronD size={10} style={{ color: 'var(--ink-4)', marginLeft: -2 }} />
      </TitleChip>

      <div style={{ flex: 1 }} />

      {/* CENTER: agent globe — the live state of the active session */}
      <AgentGlobe />

      <div style={{ flex: 1 }} />

      {/* RIGHT: command palette / bell / settings */}
      <button className="wb-btn" style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--stroke-inner)',
        padding: '4px 6px 4px 8px', gap: 6, color: 'var(--ink-3)',
      }} title="Command palette">
        <Icon.Search size={12} />
        <span className="wb-mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>Ctrl K</span>
      </button>

      <button className="wb-btn" style={{ position: 'relative', padding: 6 }} title="Notifications · 3 pending permissions">
        <Icon.Bell size={14} />
        <span style={{
          position: 'absolute', top: 3, right: 3,
          width: 8, height: 8, borderRadius: 999, background: 'var(--warning)',
          boxShadow: '0 0 6px var(--warning), 0 0 0 2px var(--wash-2)',
        }} />
      </button>
      <button className="wb-btn" style={{ padding: 6, marginRight: 6 }} title="Settings"><Icon.Settings size={14} /></button>

      {/* Windows window controls (right edge, full-height) */}
      <WindowControls />
    </div>
  );
}

// Windows window controls — minimize, maximize/restore, close.
// Borderless, full-title-bar height, hover bg; close hover is the Windows red.
function WindowControls() {
  const btn = {
    width: 46, height: 40, padding: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--ink-2)', transition: 'background 120ms, color 120ms',
  };
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'stretch', flexShrink: 0 }}>
      <button
        title="Minimize"
        style={btn}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
      <button
        title="Maximize"
        style={btn}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
      </button>
      <button
        title="Close"
        style={btn}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}

// Clickable title-bar chip — flat by default, hint of border on hover.
function TitleChip({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 26, padding: '0 8px',
      background: 'transparent',
      border: '1px solid transparent',
      borderRadius: 7,
      color: 'var(--ink-2)',
      fontSize: 12, fontFamily: 'var(--font-ui)',
      cursor: 'pointer',
      transition: 'background 120ms, border-color 120ms',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      e.currentTarget.style.borderColor = 'var(--stroke-inner)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderColor = 'transparent';
    }}>{children}</button>
  );
}

// The centered live-agent pill — replaces the giant ⌘K search.
// Reads as: ✻ model · 🔧 tool · 📂 target · ⏱ duration
// When idle, dims and shows model + "idle".
function AgentGlobe() {
  const [tick, setTick] = useState(6);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <button title="Click to focus active session" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      height: 28, padding: '0 12px 0 10px',
      background: 'linear-gradient(180deg, var(--accent-tint), rgba(129,140,248,0.04))',
      border: '1px solid var(--accent-edge)',
      borderRadius: 999,
      cursor: 'pointer',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 0 0 1px rgba(129,140,248,0.04), 0 4px 20px -8px rgba(129,140,248,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      {/* shimmer sweep */}
      <span style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        animation: 'shimmerSweep 3s linear infinite',
        pointerEvents: 'none',
      }} />
      <span style={{ color: 'var(--accent-hi)', display: 'inline-flex', filter: 'drop-shadow(0 0 4px var(--accent))' }}>
        <Icon.Sparkle size={12} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>sonnet-4.5</span>
      <span style={{ width: 1, height: 14, background: 'var(--stroke-strong)' }} />
      <ToolGlyph tool="Edit" size={12} />
      <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500 }}>Edit</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)',
        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>TerminalPane.tsx</span>
      <span style={{ width: 1, height: 14, background: 'var(--stroke-strong)' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent-hi)', fontWeight: 600 }}>{tick}s</span>
      <span className="wb-dot live" style={{ marginLeft: 1 }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT RAIL (outer left, 56px)
// ─────────────────────────────────────────────────────────────────────────────
function ProjectRail({ projects, activeId, onSelect, onCollapse }) {
  return (
    <div style={{
      width: 56, flexShrink: 0, padding: '10px 0',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'var(--glass-rail)',
      backdropFilter: 'var(--blur-soft)', WebkitBackdropFilter: 'var(--blur-soft)',
      borderRight: '1px solid var(--stroke-faint)',
    }}>
      {onCollapse && (
        <button className="wb-btn" style={{
          width: 24, height: 18, borderRadius: 6, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-4)', marginBottom: 2,
        }} title="Collapse rails" onClick={onCollapse}>
          <Icon.Chevron size={11} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
      {projects.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect?.(p.id)}
            title={p.name}
            style={{
              position: 'relative', width: 38, height: 38, borderRadius: 11,
              background: active
                ? `linear-gradient(135deg, ${p.color}, ${p.color}cc)`
                : 'rgba(255,255,255,0.04)',
              border: active ? '1px solid var(--stroke-strong)' : '1px solid var(--stroke-faint)',
              color: active ? '#0a0b14' : 'var(--ink-2)',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', transition: 'all 150ms',
              boxShadow: active ? `0 6px 18px -4px ${p.color}90, var(--inset-hi)` : 'none',
            }}
          >
            {p.initial}
            {p.dirty > 0 && !active && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                minWidth: 14, height: 14, padding: '0 4px',
                borderRadius: 999, background: 'var(--warning)', color: '#0a0b14',
                fontSize: 9, fontWeight: 700, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid var(--wash-2)',
              }}>{p.dirty}</span>
            )}
            {active && (
              <span style={{
                position: 'absolute', left: -10, top: 6, bottom: 6,
                width: 3, borderRadius: 999, background: p.color,
                boxShadow: `0 0 10px ${p.color}`,
              }} />
            )}
          </button>
        );
      })}
      <button className="wb-btn" style={{
        width: 38, height: 38, borderRadius: 11, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px dashed var(--stroke-inner)', marginTop: 4,
      }}>
        <Icon.Plus size={16} />
      </button>

      <div style={{ flex: 1 }} />

      <button className="wb-btn" style={{ width: 38, height: 38, padding: 0, justifyContent: 'center', color: 'var(--ink-3)' }} title="Layout">
        <Icon.Layers size={15} />
      </button>
      <button className="wb-btn" style={{ width: 38, height: 38, padding: 0, justifyContent: 'center', color: 'var(--ink-3)' }} title="Profile">
        <span style={{ width: 22, height: 22, borderRadius: 999, background: 'linear-gradient(135deg, #818cf8, #c084fc)' }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER RAIL (cross-project running + filetree, 256px)
// Sessions section repurposed: shows what's running ACROSS projects so it's
// not redundant with the centre tabs (which already list current sessions).
// ─────────────────────────────────────────────────────────────────────────────
function InnerRail({ onCollapseRails }) {
  return (
    <div style={{
      width: 256, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(14, 16, 26, 0.32)',
      backdropFilter: 'var(--blur-soft)', WebkitBackdropFilter: 'var(--blur-soft)',
      borderRight: '1px solid var(--stroke-faint)',
    }}>
      {/* Running across projects */}
      <div style={{ padding: '12px 10px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, padding: '0 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="wb-dot live" />
            <span className="wb-label">Running</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {onCollapseRails && (
              <button className="wb-btn" style={{ padding: 2 }} title="Collapse to unified rail" onClick={onCollapseRails}>
                <Icon.Chevron size={11} style={{ transform: 'rotate(180deg)' }} />
              </button>
            )}
            <button className="wb-btn" style={{ padding: 2 }}><Icon.Plus size={12} /></button>
          </div>
        </div>
        <CrossProjectRow projColor="#818cf8" projInitial="A" current label="claude · main" sub="editing TerminalPane.tsx" status="live" active />
        <CrossProjectRow projColor="#818cf8" projInitial="A" current label="claude · refactor" sub="awaiting permission" status="warn" />
        <CrossProjectRow projColor="#818cf8" projInitial="A" current kind="shell" label="dev server" sub="vite · :5173" status="live" />
        <CrossProjectRow projColor="#818cf8" projInitial="A" current kind="shell" label="test:watch" sub="vitest · 24 passed" status="live" />
        <div style={{ height: 6 }} />
        <CrossProjectRow projColor="#34d399" projInitial="L" label="claude · streaming" sub="running tests" status="live" />
      </div>

      <div style={{ height: 1, background: 'var(--stroke-faint)', margin: '0 10px' }} />

      {/* File tree */}
      <div style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, padding: '0 8px' }}>
          <span className="wb-label">Files</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="wb-btn" style={{ padding: 2 }}><Icon.Search size={11} /></button>
            <button className="wb-btn" style={{ padding: 2 }}><Icon.Plus size={11} /></button>
          </div>
        </div>
        {FILE_TREE.map((n, i) => <FileNode key={i} node={n} />)}
      </div>

      {/* Git footer */}
      <div style={{
        flexShrink: 0, padding: '8px 12px', borderTop: '1px solid var(--stroke-faint)',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)',
      }}>
        <Icon.Branch size={12} />
        <span style={{ color: 'var(--ink-2)' }}>wave/96-glass-pivot</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--success)' }}>+126</span>
        <span style={{ color: 'var(--error)' }}>−42</span>
      </div>
    </div>
  );
}

// One row in the cross-project Running panel — has a small project chip prefix.
function CrossProjectRow({ projColor, projInitial, current, label, sub, status, active, kind = 'cc' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px',
      borderRadius: 8, cursor: 'pointer',
      background: active ? 'var(--accent-tint)' : 'transparent',
      border: active ? '1px solid var(--accent-edge)' : '1px solid transparent',
      marginBottom: 2, opacity: current ? 1 : 0.85,
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        background: `linear-gradient(135deg, ${projColor}, ${projColor}cc)`,
        color: '#0a0b14', fontSize: 9, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{projInitial}</span>
      <span style={{ color: active ? 'var(--accent-hi)' : 'var(--ink-3)', display: 'inline-flex' }}>
        {kind === 'cc' ? <Icon.Sparkle size={11} /> : <Icon.Terminal size={11} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <span className={`wb-dot ${status}`} />
    </div>
  );
}

function SessionRow({ icon, label, sub, status, active }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
      borderRadius: 8, cursor: 'pointer',
      background: active ? 'var(--accent-tint)' : 'transparent',
      border: active ? '1px solid var(--accent-edge)' : '1px solid transparent',
      marginBottom: 2,
    }}>
      <span className={`wb-dot ${status}`} />
      <span style={{ color: active ? 'var(--accent-hi)' : 'var(--ink-2)', display: 'inline-flex' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
    </div>
  );
}

function FileNode({ node }) {
  const indent = 6 + node.depth * 12;
  const isDir = node.type === 'dir';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 8px', paddingLeft: indent, borderRadius: 6,
      fontSize: 12, color: isDir ? 'var(--ink-2)' : 'var(--ink-2)',
      cursor: 'pointer',
    }}>
      {isDir ? (
        node.open ? <Icon.ChevronD size={11} /> : <Icon.Chevron size={11} />
      ) : (
        <span style={{ width: 11 }} />
      )}
      <span style={{ color: isDir ? 'var(--accent-hi)' : 'var(--ink-3)', display: 'inline-flex' }}>
        {isDir ? <Icon.Folder size={12} /> : <Icon.File size={12} />}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      {node.badge && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: node.badge === 'A' ? 'var(--success)' : 'var(--warning)',
          width: 14, textAlign: 'center',
        }}>{node.badge}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED RAIL — both project rail and inner rail collapsed into one ~272px panel.
// Toggled via the inner rail's collapse-button (or the railMode tweak).
// Projects become accordion groups; each contains its sessions + files nested.
// ─────────────────────────────────────────────────────────────────────────────
function UnifiedRail({ projects, activeId, onSelect, onExpandRails }) {
  return (
    <div style={{
      width: 272, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(14, 16, 26, 0.36)',
      backdropFilter: 'var(--blur-soft)', WebkitBackdropFilter: 'var(--blur-soft)',
      borderRight: '1px solid var(--stroke-faint)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 10px 8px', borderBottom: '1px solid var(--stroke-faint)',
      }}>
        <Icon.Layers size={13} style={{ color: 'var(--accent-hi)' }} />
        <span className="wb-label" style={{ fontSize: 11 }}>Projects</span>
        <span style={{ flex: 1 }} />
        <button className="wb-btn" style={{ padding: 2 }}><Icon.Plus size={12} /></button>
        {onExpandRails && (
          <button className="wb-btn" style={{ padding: 2 }} title="Expand to dual rail" onClick={onExpandRails}>
            <Icon.Chevron size={11} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 8 }}>
        {projects.map((p) => (
          <ProjectAccordion
            key={p.id}
            project={p}
            expanded={p.id === activeId}
            onSelect={() => onSelect?.(p.id)}
          />
        ))}
      </div>

      <div style={{
        flexShrink: 0, padding: '8px 12px', borderTop: '1px solid var(--stroke-faint)',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)',
      }}>
        <Icon.Branch size={12} />
        <span style={{ color: 'var(--ink-2)' }}>wave/96-glass-pivot</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--success)' }}>+126</span>
        <span style={{ color: 'var(--error)' }}>−42</span>
      </div>
    </div>
  );
}

function ProjectAccordion({ project, expanded, onSelect }) {
  const p = project;
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={onSelect} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
        borderRadius: 8, cursor: 'pointer',
        background: expanded ? 'var(--accent-tint)' : 'transparent',
        border: expanded ? '1px solid var(--accent-edge)' : '1px solid transparent',
      }}>
        {expanded ? <Icon.ChevronD size={11} /> : <Icon.Chevron size={11} />}
        <span style={{
          width: 20, height: 20, borderRadius: 6,
          background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
          color: '#0a0b14', fontSize: 11, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: expanded ? `0 4px 10px -3px ${p.color}90` : 'none',
        }}>{p.initial}</span>
        <span style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: expanded ? 600 : 500, flex: 1 }}>{p.name}</span>
        {p.dirty > 0 && (
          <span style={{
            fontSize: 10, padding: '0 5px', borderRadius: 999,
            background: 'var(--warning-tint)', color: 'var(--warning)',
          }}>{p.dirty}</span>
        )}
        {/* running indicator if any session is live in this project */}
        {(p.id === 'agent-ide' || p.id === 'lumen-cli') && <span className="wb-dot live" />}
      </div>

      {expanded && (
        <div style={{ paddingLeft: 8, marginTop: 4 }}>
          {/* Running sessions in this project */}
          <div className="wb-label" style={{ fontSize: 9, padding: '4px 8px 2px', color: 'var(--ink-4)' }}>RUNNING</div>
          <CrossProjectRow projColor={p.color} projInitial={p.initial} current label="claude · main" sub="editing TerminalPane.tsx" status="live" active />
          <CrossProjectRow projColor={p.color} projInitial={p.initial} current label="claude · refactor" sub="awaiting permission" status="warn" />
          <CrossProjectRow projColor={p.color} projInitial={p.initial} current kind="shell" label="dev server" sub="vite · :5173" status="live" />
          <CrossProjectRow projColor={p.color} projInitial={p.initial} current kind="shell" label="test:watch" status="live" />

          <div className="wb-label" style={{ fontSize: 9, padding: '8px 8px 2px', color: 'var(--ink-4)' }}>FILES</div>
          {FILE_TREE.slice(0, 10).map((n, i) => <FileNode key={i} node={n} />)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTER: two terminals stacked
// ─────────────────────────────────────────────────────────────────────────────
function CenterPane({ termTreatment = 'tinted' }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: 10, gap: 10,
    }}>
      <TerminalShell
        kind="cc"
        tabs={TERM_TABS_UPPER}
        treatment={termTreatment}
        flex={1.55}
      >
        <ClaudeCodeTUI />
      </TerminalShell>

      <TerminalShell
        kind="shell"
        tabs={TERM_TABS_LOWER}
        treatment={termTreatment}
        flex={1}
      >
        <ShellTerminal />
      </TerminalShell>
    </div>
  );
}

// Terminal shell with tab bar + body. Treatment changes the look of the body.
function TerminalShell({ kind, tabs, treatment, flex, children }) {
  // Treatment styling
  const treatments = {
    tinted: {
      body: {
        background: 'var(--term-bg)',
        boxShadow: 'var(--term-inset)',
      },
      wrapper: 'wb-glass',
    },
    framed: {
      body: { background: 'rgba(2, 4, 10, 0.88)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(255,255,255,0.06)' },
      wrapper: 'wb-glass',
    },
    duotone: {
      body: { background: '#06070f', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' },
      wrapper: 'wb-glass',
    },
    hover: {
      body: { background: 'var(--term-bg)', boxShadow: 'var(--term-inset)' },
      wrapper: 'wb-glass',
    },
  };
  const t = treatments[treatment] || treatments.tinted;

  return (
    <div className={t.wrapper} style={{
      flex, display: 'flex', flexDirection: 'column',
      minHeight: 0, overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div className="wb-tabbar" style={{
        padding: '0 6px', background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--stroke-faint)',
      }}>
        {tabs.map((tab) => (
          <button key={tab.id} className={`wb-tab ${tab.active ? 'active' : ''}`}>
            <span className={`wb-dot ${tab.status === 'running' ? 'live' : 'idle'}`} />
            <span>{tab.label}</span>
            {tab.active && <span className="close"><Icon.X size={9} /></span>}
          </button>
        ))}
        <button className="wb-tab" style={{ color: 'var(--ink-4)', padding: '0 8px' }}><Icon.Plus size={12} /></button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 4 }}>
          <button className="wb-btn" style={{ padding: 4 }} title="Split"><Icon.Split size={12} /></button>
          <button className="wb-btn" style={{ padding: 4 }} title="Maximize"><Icon.Maximize size={12} /></button>
        </div>
      </div>

      {/* Body */}
      <div className="wb-term" style={{
        flex: 1, minHeight: 0, position: 'relative',
        display: 'flex', flexDirection: 'column',
        ...t.body,
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Claude Code TUI (mocked, sealed-box) ───────────────────────────────────
function ClaudeCodeTUI() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px 4px',
        minHeight: 0,
      }}>
        {CC_TUI_LINES.map((l, i) => <TermLine key={i} line={l} />)}
        {/* Active edit line */}
        <div className="wb-term-line" style={{ marginTop: 2 }}>
          <span className="dim">⏺ </span>
          <span className="pur">Edit</span>
          <span className="dim">(</span>
          <span className="ink2">src/renderer/components/Terminal/TerminalPane.tsx</span>
          <span className="dim">)</span>
        </div>
        <div className="wb-term-line">
          <span className="dim">  ⎿  </span>
          <span className="wb-shimmer-text">Applying edit…</span>
        </div>
        <div style={{ height: 8 }} />
      </div>

      {/* CC prompt box */}
      <div className="wb-cc-prompt">
        <span className="wb-cc-prompt-chevron">&gt;</span>
        <span style={{ color: 'var(--ink-3)' }}>Try “add a snapshot test for the hook subscription”</span>
        <span className="wb-cursor" style={{ marginLeft: 4 }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Enter send · Shift+Enter newline</span>
      </div>

      {/* CC status line — mimics real CC TUI */}
      <div className="wb-cc-status">
        <span style={{ color: 'var(--accent)' }}>✻</span>
        <span>sonnet-4.5</span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <span style={{ color: 'var(--success)' }}>⏵⏵ auto-accept on</span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <span style={{ color: 'var(--warning)' }}>77% context left</span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <span style={{ color: 'var(--ink-3)' }}>esc to interrupt</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--ink-4)' }}>⎇ wave/96-glass-pivot</span>
      </div>
    </div>
  );
}

function ShellTerminal() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 14px' }}>
      {SHELL_LINES.map((l, i) => <TermLine key={i} line={l} />)}
      <div className="wb-term-line" style={{ marginTop: 6 }}>
        <span className="ok">➜ </span>
        <span className="info">agent-ide </span>
        <span className="wb-cursor" style={{ verticalAlign: '-2px' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT ACTIVITY SIDEBAR (right, 340px)
// ─────────────────────────────────────────────────────────────────────────────
function AgentSidebar() {
  return (
    <div style={{
      width: 348, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(14, 16, 26, 0.32)',
      backdropFilter: 'var(--blur-soft)', WebkitBackdropFilter: 'var(--blur-soft)',
      borderLeft: '1px solid var(--stroke-faint)',
      minHeight: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--stroke-faint)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span className="wb-dot live" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>claude · main</div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>started 5m 12s ago · 12 tool calls</div>
        </div>
        <button className="wb-btn" style={{ padding: 4 }} title="Stop"><Icon.Stop size={13} style={{ color: 'var(--error)' }} /></button>
        <button className="wb-btn" style={{ padding: 4 }}><Icon.Maximize size={13} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 12 }}>
        <NowBlock />
        <ContextBlock />
        <FilesTouched />
        <RecentDiff />
        <HookTimeline />
      </div>
    </div>
  );
}

function NowBlock() {
  return (
    <div className="wb-glass-card" style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="wb-label" style={{ color: 'var(--accent-hi)' }}>NOW</span>
        <span style={{ flex: 1 }} />
        <span className="wb-pill accent">
          <span className="wb-dot live" style={{ background: 'var(--accent)', boxShadow: 'none' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>6s</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-tint)', border: '1px solid var(--accent-edge)',
        }}>
          <ToolGlyph tool="Edit" size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--ink)' }}>
            <span style={{ color: 'var(--accent-hi)', fontWeight: 600 }}>Edit</span>
            <span style={{ color: 'var(--ink-3)' }}>  →  </span>
            <span className="wb-mono" style={{ fontSize: 11 }}>TerminalPane.tsx</span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
            replace scrollback parser with hook subscription
          </div>
        </div>
      </div>
      {/* progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '64%',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-hi))',
          borderRadius: 999, boxShadow: 'var(--accent-glow)',
        }} />
      </div>
    </div>
  );
}

function ContextBlock() {
  const used = 23;
  const radius = 22;
  const c = 2 * Math.PI * radius;
  return (
    <div className="wb-glass-card" style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle cx="28" cy="28" r={radius} fill="none"
              stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - used / 100)}
              transform="rotate(-90 28 28)"
              style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{used}%</div>
            <div style={{ fontSize: 8, color: 'var(--ink-3)' }}>USED</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="wb-label" style={{ marginBottom: 4 }}>CONTEXT</div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
            <span className="wb-mono" style={{ color: 'var(--ink) ' }}>46.2k</span>
            <span style={{ color: 'var(--ink-3)' }}> / 200k tokens</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 10, color: 'var(--ink-3)' }}>
            <span><Icon.Clock size={9} style={{ verticalAlign: '-1px' }} /> 5m 12s</span>
            <span>·</span>
            <span><Icon.Dollar size={9} style={{ verticalAlign: '-1px' }} /> $0.18</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilesTouched() {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px 6px' }}>
        <span className="wb-label">FILES TOUCHED</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{FILES_TOUCHED.length}</span>
      </div>
      {FILES_TOUCHED.map((f, i) => {
        const isActive = f.status === 'editing';
        return (
          <div key={i} className="wb-glass-card" style={{
            padding: '8px 10px', marginBottom: 4, display: 'flex',
            alignItems: 'center', gap: 8,
            borderColor: isActive ? 'var(--accent-edge)' : 'var(--stroke-inner)',
          }}>
            <Icon.File size={12} style={{ color: 'var(--ink-3)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left',
              }}>{f.path}</div>
            </div>
            {f.adds > 0 && <span style={{ fontSize: 10, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>+{f.adds}</span>}
            {f.dels > 0 && <span style={{ fontSize: 10, color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>−{f.dels}</span>}
            {isActive && <span className="wb-dot live" />}
          </div>
        );
      })}
    </div>
  );
}

function RecentDiff() {
  return (
    <div className="wb-glass-card" style={{ padding: 0, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid var(--stroke-faint)',
      }}>
        <span className="wb-label">LATEST HUNK</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>TerminalPane.tsx · L84</span>
      </div>
      <div style={{ padding: '6px 0', background: 'rgba(0,0,0,0.18)' }}>
        {DIFF_HUNK.map((row, i) => (
          <div key={i} className={`wb-diff-row ${row.type === 'add' ? 'add' : row.type === 'del' ? 'del' : ''}`}>
            <span className="gutter">
              {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}
              <span style={{ marginLeft: 4 }}>{row.n}</span>
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
              paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{row.text}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--stroke-faint)' }}>
        <button className="wb-btn tint" style={{ flex: 1, justifyContent: 'center', padding: '4px 8px', fontSize: 11 }}>
          <Icon.Check size={11} /> Accept
        </button>
        <button className="wb-btn ghost-border" style={{ padding: '4px 8px', fontSize: 11 }}>
          <Icon.X size={11} /> Reject
        </button>
        <button className="wb-btn ghost-border" style={{ padding: '4px 8px', fontSize: 11 }}>
          <Icon.Eye size={11} /> Open
        </button>
      </div>
    </div>
  );
}

function HookTimeline() {
  // Show last 6 hook events
  const events = HOOK_EVENTS.slice(-7, -1).reverse();
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px 6px' }}>
        <span className="wb-label">HOOK TIMELINE</span>
        <span style={{ flex: 1 }} />
        <button className="wb-btn" style={{ padding: '0 4px', fontSize: 10 }}>view all <Icon.Chevron size={10} /></button>
      </div>
      <div style={{ position: 'relative', paddingLeft: 16 }}>
        {/* timeline rail */}
        <span style={{
          position: 'absolute', left: 8, top: 6, bottom: 6, width: 1,
          background: 'linear-gradient(180deg, var(--accent), var(--stroke-faint))',
        }} />
        {events.map((e, i) => <HookRow key={e.id} ev={e} />)}
      </div>
    </div>
  );
}

function HookRow({ ev }) {
  if (ev.kind === 'prompt') {
    return (
      <div style={{ position: 'relative', paddingLeft: 14, paddingBottom: 8 }}>
        <span style={{ position: 'absolute', left: -8, top: 5, width: 9, height: 9, borderRadius: 999, background: 'var(--accent)', border: '2px solid var(--wash-2)', boxShadow: 'var(--accent-glow)' }} />
        <div style={{ fontSize: 11, color: 'var(--ink-2)', fontStyle: 'italic' }}>"{ev.text}"</div>
      </div>
    );
  }
  if (ev.kind === 'think') {
    return (
      <div style={{ position: 'relative', paddingLeft: 14, paddingBottom: 8 }}>
        <span style={{ position: 'absolute', left: -8, top: 5, width: 9, height: 9, borderRadius: 999, background: 'var(--purple)', border: '2px solid var(--wash-2)' }} />
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon.Brain size={10} style={{ color: 'var(--purple)' }} />
          <span>Thinking · {Math.round(ev.dur / 1000)}s</span>
        </div>
      </div>
    );
  }
  const statusColor = ev.status === 'ok' ? 'var(--success)' :
                      ev.status === 'warn' ? 'var(--warning)' :
                      ev.status === 'running' ? 'var(--accent)' : 'var(--ink-3)';
  return (
    <div style={{ position: 'relative', paddingLeft: 14, paddingBottom: 8 }}>
      <span style={{
        position: 'absolute', left: -8, top: 6, width: 9, height: 9,
        borderRadius: 999, background: statusColor,
        border: '2px solid var(--wash-2)',
        boxShadow: ev.status === 'running' ? `0 0 8px ${statusColor}` : 'none',
        animation: ev.status === 'running' ? 'dotPulse 1.4s ease-in-out infinite' : 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ToolGlyph tool={ev.tool} size={11} />
        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>{ev.tool}</span>
        {ev.duration > 0 && (
          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            {ev.duration < 1000 ? `${ev.duration}ms` : `${(ev.duration/1000).toFixed(1)}s`}
          </span>
        )}
        {ev.status === 'running' && (
          <span style={{ fontSize: 10, color: 'var(--accent)' }}>running…</span>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)',
        marginTop: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left',
      }}>{ev.target}</div>
      {(ev.adds || ev.dels) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          {ev.adds > 0 && <span style={{ color: 'var(--success)' }}>+{ev.adds}</span>}
          {ev.dels > 0 && <span style={{ color: 'var(--error)' }}>−{ev.dels}</span>}
        </div>
      )}
      {ev.matches && (
        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
          {ev.matches} matches in {ev.files} files
        </div>
      )}
      {ev.note && (
        <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>{ev.note}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BAR
// ─────────────────────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div style={{
      height: 24, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 16, fontSize: 11, color: 'var(--ink-3)',
      background: 'rgba(0,0,0,0.25)', borderTop: '1px solid var(--stroke-faint)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon.Branch size={11} />
        <span style={{ color: 'var(--ink-2)' }}>wave/96-glass-pivot</span>
        <span style={{ color: 'var(--success)' }}>+126</span>
        <span style={{ color: 'var(--error)' }}>−42</span>
      </span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon.Sparkle size={11} style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--ink-2)' }}>sonnet-4.5</span>
      </span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--ink-2)' }}>46.2k</span>
        <span>/ 200k ctx</span>
      </span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span style={{ color: 'var(--success)' }}>● 24 tests passing</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: 'var(--ink-2)' }}>$0.18</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>14:35:22</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span className="wb-dot live" /> connected
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────────────────────────────────────
function WorkbenchHero({ theme = 'modern', termTreatment = 'tinted', railMode = 'dual', onSetRailMode }) {
  const [activeProjectId, setActiveProjectId] = useState('agent-ide');
  const activeProject = PROJECTS.find((p) => p.id === activeProjectId) || PROJECTS[0];
  const collapse = () => onSetRailMode?.('unified');
  const expand = () => onSetRailMode?.('dual');
  return (
    <div data-theme={theme} className="wb-stage" style={{ display: 'flex', flexDirection: 'column' }}>
      <TitleBar project={activeProject} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {railMode === 'dual' ? (
          <>
            <ProjectRail projects={PROJECTS} activeId={activeProjectId} onSelect={setActiveProjectId} onCollapse={collapse} />
            <InnerRail onCollapseRails={collapse} />
          </>
        ) : (
          <UnifiedRail projects={PROJECTS} activeId={activeProjectId} onSelect={setActiveProjectId} onExpandRails={expand} />
        )}
        <CenterPane termTreatment={termTreatment} />
        <AgentSidebar />
      </div>
      <StatusBar />
    </div>
  );
}

window.WorkbenchHero = WorkbenchHero;
