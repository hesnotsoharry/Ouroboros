/**
 * ProjectContextMenu — thin right-click context menu for project-switcher surfaces.
 *
 * Wraps ContextMenuPanel (FileTree's position-fixed panel renderer) with the
 * dismiss logic specific to project menus. Dismisses on Esc or outside-click.
 *
 * Usage:
 *   const [ctxMenu, setCtxMenu] = useState<ProjectCtxMenuState | null>(null);
 *   <div onContextMenu={e => { e.preventDefault(); setCtxMenu({x:e.clientX, y:e.clientY, projectPath:p.path}); }}>
 *   {ctxMenu && (
 *     <ProjectContextMenu
 *       x={ctxMenu.x}
 *       y={ctxMenu.y}
 *       projectPath={ctxMenu.projectPath}
 *       onRemove={removeProject}
 *       onDismiss={() => setCtxMenu(null)}
 *     />
 *   )}
 */

import React, { useEffect, useRef } from 'react';

import { ContextMenuPanel } from '../../FileTree/ContextMenuPanel';
import type { MenuItem } from '../../FileTree/useContextMenuController';

export interface ProjectCtxMenuState {
  projectPath: string;
  x: number;
  y: number;
}

interface ProjectContextMenuProps {
  onDismiss: () => void;
  onRemove: (path: string) => void;
  projectPath: string;
  x: number;
  y: number;
}

export function ProjectContextMenu({
  onDismiss,
  onRemove,
  projectPath,
  x,
  y,
}: ProjectContextMenuProps): React.ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss();
    };
    const onMouse = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [onDismiss]);

  const items: MenuItem[] = [
    {
      action: () => {
        onRemove(projectPath);
        onDismiss();
      },
      label: 'Remove from workbench',
    },
  ];

  return (
    <div data-testid="project-context-menu" data-context-menu="true">
      <ContextMenuPanel items={items} menuRef={menuRef} visible x={x} y={y} />
    </div>
  );
}
