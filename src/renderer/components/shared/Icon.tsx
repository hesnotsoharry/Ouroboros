/**
 * Icon — canon icon primitive (Wave 1).
 *
 * Inline SVG set named to match the canon §17 icon vocabulary.
 * All icons are 14×14 by default (canon baseline), stroke-based, 1.7px stroke.
 * Pass `size` to override. Pass `className` for color tokens via Tailwind.
 *
 * lucide-react is not a project dependency; this minimal set covers
 * what the Workbench shell (Wave 1–6) needs. Later phases add more names.
 */

import React from 'react';

export type IconName =
  | 'Terminal'
  | 'Folder'
  | 'File'
  | 'Chevron'
  | 'ChevronDown'
  | 'Plus'
  | 'X'
  | 'Search'
  | 'Settings'
  | 'Edit'
  | 'Bash'
  | 'Grep'
  | 'Glob'
  | 'Write'
  | 'Read'
  | 'Sparkle'
  | 'Bell'
  | 'Stop'
  | 'Clock'
  | 'Branch'
  | 'Dollar'
  | 'Check'
  | 'Eye'
  | 'Bolt'
  | 'Split'
  | 'Layers';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

type SvgChild = React.ReactElement;

function svg(child: SvgChild, size: number, sw = 1.7): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {child}
    </svg>
  );
}

const PATHS: Record<IconName, (size: number) => React.ReactElement> = {
  Terminal: (s) =>
    svg(
      <>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </>,
      s,
    ),
  Folder: (s) =>
    svg(
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
      s,
    ),
  File: (s) =>
    svg(
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="14 3 14 9 20 9" />
      </>,
      s,
    ),
  Chevron: (s) => svg(<polyline points="9 6 15 12 9 18" />, s),
  ChevronDown: (s) => svg(<polyline points="6 9 12 15 18 9" />, s),
  Plus: (s) =>
    svg(
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>,
      s,
    ),
  X: (s) =>
    svg(
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>,
      s,
    ),
  Search: (s) =>
    svg(
      <>
        <circle cx="11" cy="11" r="7" />
        <line x1="20" y1="20" x2="16.65" y2="16.65" />
      </>,
      s,
    ),
  Settings: (s) =>
    svg(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>,
      s,
    ),
  Edit: (s) =>
    svg(
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>,
      s,
    ),
  Bash: (s) =>
    svg(
      <>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </>,
      s,
    ),
  Grep: (s) =>
    svg(
      <>
        <circle cx="11" cy="11" r="7" />
        <line x1="20" y1="20" x2="16.65" y2="16.65" />
      </>,
      s,
    ),
  Glob: (s) =>
    svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>,
      s,
    ),
  Write: (s) =>
    svg(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </>,
      s,
    ),
  Read: (s) =>
    svg(
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>,
      s,
    ),
  Sparkle: (s) =>
    svg(
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />,
      s,
    ),
  Bell: (s) =>
    svg(
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>,
      s,
    ),
  Stop: (s) => svg(<rect x="5" y="5" width="14" height="14" rx="2" />, s),
  Clock: (s) =>
    svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </>,
      s,
    ),
  Branch: (s) =>
    svg(
      <>
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </>,
      s,
    ),
  Dollar: (s) =>
    svg(
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>,
      s,
    ),
  Check: (s) => svg(<polyline points="20 6 9 17 4 12" />, s),
  Eye: (s) =>
    svg(
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>,
      s,
    ),
  Bolt: (s) => svg(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />, s),
  Split: (s) =>
    svg(
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </>,
      s,
    ),
  Layers: (s) =>
    svg(
      <>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </>,
      s,
    ),
};

export function Icon({ name, size = 14, className, style }: IconProps): React.ReactElement {
  const render = PATHS[name];
  const el = render(size);
  if (!className && !style) return el;
  return (
    <span className={className} style={{ display: 'inline-flex', ...style }}>
      {el}
    </span>
  );
}
