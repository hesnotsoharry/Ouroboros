/**
 * useActiveWorkbenchFrame — tracks which of the two workbench terminal frames
 * (upper "cc" or lower "shell") the user last interacted with.
 *
 * Wave 10 Phase 3: exposes { activeFrame, setActiveFrame } via a small React
 * context. Mounted inside Workbench.tsx below ProjectProvider. Both TerminalShell
 * instances consume setActiveFrame on container onMouseDown.
 *
 * Wave 13 consumer comes here: AgentSidebar will bind to activeFrame to scope
 * the right panel to the active terminal's claude session.
 *
 * @module useActiveWorkbenchFrame
 */

import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';

export type ActiveWorkbenchFrame = 'upper' | 'lower';

export interface ActiveWorkbenchFrameValue {
  activeFrame: ActiveWorkbenchFrame;
  setActiveFrame: (frame: ActiveWorkbenchFrame) => void;
}

const ActiveFrameContext = createContext<ActiveWorkbenchFrameValue | null>(null);

interface ActiveFrameProviderProps {
  children: ReactNode;
}

export function ActiveFrameProvider({ children }: ActiveFrameProviderProps): ReactElement {
  const [activeFrame, setActiveFrame] = useState<ActiveWorkbenchFrame>('upper');
  const value = useMemo<ActiveWorkbenchFrameValue>(
    () => ({ activeFrame, setActiveFrame }),
    [activeFrame],
  );
  return <ActiveFrameContext.Provider value={value}>{children}</ActiveFrameContext.Provider>;
}

/**
 * Returns the active workbench frame state + setter.
 *
 * Safe default when consumed outside the provider: returns { activeFrame: 'upper',
 * setActiveFrame: noop }. This preserves test isolation — unit tests that render a
 * single TerminalShell without a provider wrapper don't need to add one.
 */
export function useActiveWorkbenchFrame(): ActiveWorkbenchFrameValue {
  const ctx = useContext(ActiveFrameContext);
  if (!ctx) {
    // Safe default outside provider — avoids forcing every test to wrap in the provider.
    // Wave 13: when the provider is always mounted inside Workbench.tsx, this branch
    // will only fire in isolated unit tests.
    return { activeFrame: 'upper', setActiveFrame: () => {} };
  }
  return ctx;
}
