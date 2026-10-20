// Lucide icons (ISC), inlined as SVG — same paths as the design prototype.
import type { ReactNode } from 'react';

const Svg = ({ children, sw = 1.75 }: { children: ReactNode; sw?: number }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
export const IconPlus = () => <Svg><path d="M5 12h14M12 5v14" /></Svg>;
export const IconSliders = () => <Svg><path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" /></Svg>;
export const IconSun = () => <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Svg>;
export const IconMoon = () => <Svg><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Svg>;
export const IconSettings = () => <Svg><path d="M20 7h-9M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></Svg>;
export const IconRotate = () => <Svg sw={2}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" /></Svg>;
export const IconX = () => <Svg><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const IconSearch = () => <Svg><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Svg>;
export const IconCheck = () => <Svg sw={2}><path d="M20 6 9 17l-5-5" /></Svg>;
