/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, WorkbenchHero, TerminalTreatments, CommandBlockTreatments, SidebarVariants, ThemeShowcase, RailVariants, SidebarStates, PermissionPromptArtboard, StateMachineArtboard, ResponsiveArtboard */
/* workbench-app.jsx — design canvas mount + tweaks wiring */

const { useState: useStateApp, useEffect: useEffectApp } = React;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN MEMO — read-me at the top of the canvas
// ─────────────────────────────────────────────────────────────────────────────
function DesignMemo() {
  return (
    <div className="wb-stage" style={{ width: '100%', height: '100%', padding: '36px 44px', overflow: 'auto' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', color: 'var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#0a0b14', fontWeight: 800, fontSize: 18,
            boxShadow: 'var(--accent-glow)',
          }}>A</span>
          <span className="wb-label" style={{ fontSize: 11 }}>Agent IDE  ·  workbench overhaul</span>
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.025em', margin: '8px 0 14px', lineHeight: 1.1 }}>
          A terminal-first workbench<br />
          that wears glass without breaking it.
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--ink-2)', maxWidth: 820, margin: '0 0 28px' }}>
          The Claude Code TUI is a sealed-box viewport inside an xterm canvas. We can't reliably parse its scrollback,
          and its bg is opaque — so the glass shell wraps <em>around</em> the terminal instead of through it. Every
          rich-UI signal (current tool, files touched, diffs, context) comes from{' '}
          <span className="wb-mono" style={{ color: 'var(--ink)', background: 'var(--glass-panel-hi)', padding: '1px 6px', borderRadius: 4 }}>
            PreToolUse / PostToolUse / Stop
          </span>{' '}hooks, not TUI parsing.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 30 }}>
          <PrincipleCard
            n="01"
            title="The TUI is sacred"
            body="Don't fight the CC TUI — frame it. The terminal pane shows raw Claude Code. Everything we add lives in the shell around it."
            tint="var(--accent)"
          />
          <PrincipleCard
            n="02"
            title="Hooks > parsing"
            body="PreToolUse, PostToolUse, Stop, UserPromptSubmit all emit JSON. That's the data model — not regex against scrollback."
            tint="var(--success)"
          />
          <PrincipleCard
            n="03"
            title="Glass with a deeper well"
            body="Terminal bg drops to rgba(6,8,16,0.62) with --terminal-canvas-opacity: 0.86. Reads as a well in the glass, not a hole."
            tint="var(--purple)"
          />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.01em' }}>What's in the workbench</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 30 }}>
          <SurfaceRow icon="rail" name="Project rail (outer)" desc="56px · projects as colored chips · unstaged-count badge · ~3 active." />
          <SurfaceRow icon="rail" name="Inner rail" desc="256px · sessions (CC + shells) on top, filetree below, git footer at the bottom." />
          <SurfaceRow icon="term" name="Dual terminals" desc="Upper: Claude Code primary. Lower: dev server / test:watch / bash. Each with tabs + split + maximise." />
          <SurfaceRow icon="agent" name="Agent activity rail" desc="348px · NOW block, context donut, files touched, latest hunk, hook timeline." />
          <SurfaceRow icon="bar" name="Title bar" desc="Frosted · breadcrumb · branch · Ctrl K palette · bell · settings · Windows controls." />
          <SurfaceRow icon="bar" name="Status bar" desc="Branch · model · context · tests · cost · clock · connection status." />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.01em' }}>What you'll see below</h2>
        <ol style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)', paddingLeft: 20, marginBottom: 30 }}>
          <li><b style={{ color: 'var(--ink)' }}>Hero workbench</b> — the full layout at 1760×1020. New: centered Agent Globe in the title bar showing live tool/duration. Tweaks panel switches theme, rail mode, and terminal treatment.</li>
          <li><b style={{ color: 'var(--ink)' }}>Terminal treatments</b> — four ways to handle the black-canvas-vs-glass clash.</li>
          <li><b style={{ color: 'var(--ink)' }}>Hook event treatments</b> — pills, adaptive cards, or threaded timeline. Same data, different reads.</li>
          <li><b style={{ color: 'var(--ink)' }}>Agent surface placement</b> — right rail vs floating HUD vs bottom dock.</li>
          <li><b style={{ color: 'var(--ink)' }}>Rail compression</b> — dual rail vs unified rail for laptop screens.</li>
          <li><b style={{ color: 'var(--ink)' }}>Theme showcase</b> — Modern (default), Warp, and Retro (the special-case CRT).</li>
          <li><b style={{ color: 'var(--ink)' }}>Sidebar states</b> — empty / idle / permission / errored / disconnected.</li>
          <li><b style={{ color: 'var(--ink)' }}>Permission prompt</b> — inline terminal overlay + sidebar takeover at full fidelity.</li>
          <li><b style={{ color: 'var(--ink)' }}>Session state machine</b> — 7 states, 11 transitions, driven entirely by hooks.</li>
          <li><b style={{ color: 'var(--ink)' }}>Responsive collapse</b> — full → compact → unified → HUD breakpoints with rules.</li>
        </ol>

        <div className="wb-glass-card" style={{ padding: 16, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, borderColor: 'var(--accent-edge)', background: 'var(--accent-tint)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-hi)', marginBottom: 6 }}>RESOLVED · v2</div>
          <div style={{ marginBottom: 6 }}>
            <b style={{ color: 'var(--ink)' }}>Inner rail's “Sessions” → “Running”.</b>{' '}
            The tab bars in the centre already show the current project's sessions, so the rail was duplicative. Repurposed: it now shows what's running
            <i> across all projects</i> — each row prefixed with a project chip. Cross-project glanceability without leaving the page.
          </div>
          <div>
            <b style={{ color: 'var(--ink)' }}>Dual ↔ unified is now one keystroke.</b>{' '}
            Click the chevron at the top of the outer project rail (or in the inner rail header) to collapse both into a single unified rail with projects as accordion groups. Use the Tweaks panel to toggle live.
          </div>
        </div>
      </div>
    </div>
  );
}

function PrincipleCard({ n, title, body, tint }) {
  return (
    <div className="wb-glass-card" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 28, fontWeight: 800, color: tint, opacity: 0.18, letterSpacing: '-0.04em' }}>{n}</div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tint, marginBottom: 4 }}>{n}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

function SurfaceRow({ name, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', marginTop: 7, boxShadow: 'var(--accent-glow)', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO WRAPPER + TWEAKS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "modern",
  "termTreatment": "tinted",
  "railMode": "dual",
  "scanlines": true,
  "accentBoost": "default"
}/*EDITMODE-END*/;

function HeroWithTweaks() {
  const [t, setTweak] = useTweaks(DEFAULTS);

  // Make scanlines effect respect the toggle (retro only)
  useEffectApp(() => {
    document.documentElement.dataset.scanlines = t.scanlines ? 'on' : 'off';
  }, [t.scanlines]);

  return (
    <>
      <WorkbenchHero
        theme={t.theme}
        termTreatment={t.termTreatment}
        railMode={t.railMode}
        onSetRailMode={(v) => setTweak('railMode', v)}
      />
      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Theme" value={t.theme}
          options={[
            { value: 'modern', label: 'Modern' },
            { value: 'warp', label: 'Warp' },
            { value: 'retro', label: 'Retro' },
          ]}
          onChange={(v) => setTweak('theme', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Rail mode" value={t.railMode}
          options={[
            { value: 'dual', label: 'Dual' },
            { value: 'unified', label: 'Unified' },
          ]}
          onChange={(v) => setTweak('railMode', v)} />
        <TweakSelect label="Terminal" value={t.termTreatment}
          options={[
            { value: 'tinted', label: 'A · Tinted well (recommended)' },
            { value: 'framed', label: 'B · Framed slab' },
            { value: 'duotone', label: 'C · Duotone matte' },
            { value: 'hover', label: 'D · Cards-only (no terminal)' },
          ]}
          onChange={(v) => setTweak('termTreatment', v)} />
      </TweaksPanel>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS ROOT
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  return (
    <DesignCanvas>
      <DCSection id="memo" title="Design memo · start here">
        <DCArtboard id="memo-1" label="Read me first" width={1500} height={920}>
          <DesignMemo />
        </DCArtboard>
      </DCSection>

      <DCSection id="hero" title="Hero · the full workbench">
        <DCArtboard id="hero-1" label="Workbench · 1760×1020 · live tweaks" width={1760} height={1020}>
          <HeroWithTweaks />
        </DCArtboard>
      </DCSection>

      <DCSection id="terminal" title="Terminal treatments · solving the black-canvas problem">
        <DCArtboard id="term-1" label="Four approaches" width={1560} height={950}>
          <TerminalTreatments />
        </DCArtboard>
      </DCSection>

      <DCSection id="hooks" title="Hook event treatments · pills vs cards vs threaded">
        <DCArtboard id="hooks-1" label="Three densities" width={1560} height={1020}>
          <CommandBlockTreatments />
        </DCArtboard>
      </DCSection>

      <DCSection id="sidebar" title="Agent surface · placement explorations">
        <DCArtboard id="sb-1" label="Rail / HUD / Dock" width={1560} height={1060}>
          <SidebarVariants />
        </DCArtboard>
      </DCSection>

      <DCSection id="rails" title="Project + session rail · default and compressed">
        <DCArtboard id="rail-1" label="Dual vs unified" width={1460} height={920}>
          <RailVariants />
        </DCArtboard>
      </DCSection>

      <DCSection id="themes" title="Theme showcase · Modern · Warp · Retro">
        <DCArtboard id="theme-1" label="Same content, three skins" width={1560} height={1020}>
          <ThemeShowcase />
        </DCArtboard>
      </DCSection>

      <DCSection id="states" title="Agent sidebar · every state">
        <DCArtboard id="states-1" label="Empty · idle · permission · errored · disconnected" width={1560} height={920}>
          <SidebarStates />
        </DCArtboard>
      </DCSection>

      <DCSection id="permission" title="Permission prompt · inline + sidebar">
        <DCArtboard id="perm-1" label="Terminal overlay + sidebar takeover" width={1560} height={1020}>
          <PermissionPromptArtboard />
        </DCArtboard>
      </DCSection>

      <DCSection id="statemachine" title="Session state machine · driven by hooks">
        <DCArtboard id="sm-1" label="7 states · 11 transitions" width={1560} height={1020}>
          <StateMachineArtboard />
        </DCArtboard>
      </DCSection>

      <DCSection id="responsive" title="Responsive collapse · breakpoints">
        <DCArtboard id="rsp-1" label="Full → compact → unified → HUD" width={1560} height={760}>
          <ResponsiveArtboard />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
