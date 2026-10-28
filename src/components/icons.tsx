/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (props: P): P => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const LogoIcon = (props: P) => (
  <svg viewBox="0 0 32 32" width={28} height={28} {...props}>
    <rect x="5" y="2" width="22" height="28" rx="3" fill="#e11d2e" />
    <path
      d="M10 23h6.5a3.5 3.5 0 0 0 0-7H13v-4h6"
      stroke="#fff"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="13.6" cy="16" r="1.7" fill="#fff" />
    <path d="M17.5 7.5l4 4m0-4l-4 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const CursorIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M5 3l7 17 2.5-6.5L21 11z" />
  </svg>
);

export const TextIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M5 6V4h14v2" />
    <path d="M12 4v16" />
    <path d="M9 20h6" />
  </svg>
);

export const ImageIcon = (props: P) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4 17l5-4 4 3 3-2 4 3" />
  </svg>
);

export const RectIcon = (props: P) => (
  <svg {...base(props)}>
    <rect x="4" y="5" width="16" height="14" rx="1.5" />
  </svg>
);

export const HighlightIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 20h16" />
    <path d="M6 15l8-9 4 3.5-7.5 8.5H6z" />
    <path d="M13 7l3.5 3" />
  </svg>
);

export const EraserIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M8 20h11" />
    <path d="M14.5 4.5l5 5a2 2 0 0 1 0 2.8l-6 6a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8l6-6a2 2 0 0 1 2.8 0z" />
    <path d="M9 9l6 6" />
  </svg>
);

export const UndoIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M9 8H5V4" />
    <path d="M5 8a8 8 0 1 1 1.5 9" />
  </svg>
);

export const RedoIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M15 8h4V4" />
    <path d="M19 8a8 8 0 1 0-1.5 9" />
  </svg>
);

export const DownloadIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 4v11" />
    <path d="M7.5 11.5L12 16l4.5-4.5" />
    <path d="M4 20h16" />
  </svg>
);

export const OpenIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 19V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" />
    <path d="M3 19l2.5-8h16L19 19z" />
  </svg>
);

export const TrashIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13h10l1-13" />
  </svg>
);

export const ChevronLeftIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </svg>
);

export const ChevronRightIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M9.5 5.5L16 12l-6.5 6.5" />
  </svg>
);

export const ZoomOutIcon = (props: P) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M8.5 11h5M20 20l-4.5-4.5" />
  </svg>
);

export const ZoomInIcon = (props: P) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M8.5 11h5M11 8.5v5M20 20l-4.5-4.5" />
  </svg>
);

export const FitIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </svg>
);

export const DocIcon = (props: P) => (
  <svg {...base(props)}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
  </svg>
);

export const MergeIcon = (props: P) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="7" height="16" rx="1.5" />
    <rect x="14" y="4" width="7" height="16" rx="1.5" />
    <path d="M10 12h4" />
    <path d="M12.5 10l1.5 2-1.5 2" />
  </svg>
);

export const SplitIcon = (props: P) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="7" height="16" rx="1.5" />
    <rect x="14" y="4" width="7" height="16" rx="1.5" />
    <path d="M12 12H8.5" />
    <path d="M10.5 10l-2 2 2 2" />
    <path d="M12 12h3.5" />
    <path d="M13.5 10l2 2-2 2" />
  </svg>
);

export const GlobeIcon = (props: P) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 3.6 9 14 14 0 0 1-3.6 9 14 14 0 0 1-3.6-9A14 14 0 0 1 12 3z" />
  </svg>
);

export const HelpIcon = (props: P) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.3a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4" />
    <path d="M12 17.2h.01" />
  </svg>
);
