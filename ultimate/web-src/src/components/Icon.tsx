import type { ReactNode } from 'react';

// One small line-icon set for the whole app (24px grid, round caps). The icons used on the main
// action buttons carry part classes (p1, p2, p3) so the stylesheet can loop them on hover.
const ICONS = {
  // navigation — the pipeline, in order
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  prompt: (
    <>
      <path d="M4 7h9M4 12h6M4 17h8" />
      <path d="M18 5v14M16 5h4M16 19h4" />
    </>
  ),
  sparkles: (
    <>
      <path className="p1" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path className="p2" d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
      <path className="p3" d="M5.5 15.8l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6.5" r="2.8" />
      <circle cx="6" cy="17.5" r="2.8" />
      <path d="M20 5L8.2 15.6M8.2 8.4L12 11.8M14.6 14.2L20 19" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 2.8v5.4c0 4.4-2.9 7.6-7 9.8-4.1-2.2-7-5.4-7-9.8V5.8z" />
      <path className="p1" d="M8.8 12l2.2 2.2 4.2-4.4" />
    </>
  ),
  send: (
    <g className="p1">
      <path d="M21 3L10.2 13.8" />
      <path d="M21 3l-6.6 18-4.2-7.2L3 9.6z" />
    </g>
  ),
  // review + set up
  folder: <path d="M3 7.5A1.5 1.5 0 014.5 6h4.3l2 2.5h8.7A1.5 1.5 0 0121 10v7.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path className="p1" d="M12 12V7" />
      <path className="p2" d="M12 12l3.2 2" />
    </>
  ),
  chart: <path d="M5 20v-8M12 20V4M19 20v-5" />,
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 14.5h3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <path d="M16 5.6a3.2 3.2 0 010 5.8M18 14.9c1.6.7 2.6 2.2 3 4.6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M18 7h2M4 17h3M12 17h8" />
      <circle cx="15.5" cy="7" r="2.3" />
      <circle cx="9.5" cy="17" r="2.3" />
    </>
  ),
  // actions
  chevron: <path d="M9 6l6 6-6 6" />,
  updown: <path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  upload: <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v2.5A1.5 1.5 0 006.5 19h11a1.5 1.5 0 001.5-1.5V15" />,
  link: (
    <>
      <path d="M10.5 13.5a4 4 0 005.7 0l2.6-2.6a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M13.5 10.5a4 4 0 00-5.7 0l-2.6 2.6a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17l4.5-4.5 3.5 3.5 2.5-2.5 5 5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="M16 10.5l5-3v9l-5-3z" />
    </>
  ),
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="5.5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18.5" cy="12" r="1.5" />
    </g>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 01-13.4 4.6M4.5 12a7.5 7.5 0 0113.4-4.6" />
      <path d="M18.5 3.5v4h-4M5.5 20.5v-4h4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  external: (
    <>
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M11 6H7.5A2.5 2.5 0 005 8.5v8A2.5 2.5 0 007.5 19h8a2.5 2.5 0 002.5-2.5V13" />
    </>
  ),
  // main-action icons with moving parts
  radar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path className="p1" d="M12 12l6-6" />
    </>
  ),
  wand: (
    <>
      <path d="M4.5 19.5L14 10M14 10l2-2" />
      <path className="p1" d="M18.5 3v3M17 4.5h3" />
      <path className="p2" d="M20 10.5v2M19 11.5h2" />
      <path className="p3" d="M10.5 3.5v2M9.5 4.5h2" />
    </>
  ),
  clapper: (
    <>
      <rect x="3.5" y="10.5" width="17" height="9.5" rx="2" />
      <g className="p1">
        <path d="M3.5 10.5V7.2L20 4.2l.5 3.3z" />
        <path d="M8.3 6.3l1.4 3M13.3 5.4l1.4 3" />
      </g>
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path className="p1" d="M8.8 14.5l2.2 2.2 4.2-4.4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`ic ic-${name}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
