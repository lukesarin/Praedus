/** Small inline line icons (Lucide-style) so we don't pull in an icon library yet. */
type P = { size?: number }
const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
export const CalendarIcon = ({ size = 16 }: P) =>
  svg(size, <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>)
export const ListIcon = ({ size = 16 }: P) =>
  svg(size, <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></>)
export const RefreshIcon = ({ size = 14 }: P) =>
  svg(size, <><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></>)
export const XIcon = ({ size = 14 }: P) => svg(size, <path d="M18 6 6 18M6 6l12 12" />)
export const PlusIcon = ({ size = 16 }: P) => svg(size, <path d="M12 5v14M5 12h14" />)
export const SunIcon = ({ size = 16 }: P) =>
  svg(size, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>)
export const MoonIcon = ({ size = 16 }: P) => svg(size, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />)
export const MenuIcon = ({ size = 18 }: P) => svg(size, <path d="M4 6h16M4 12h16M4 18h16" />)
export const ExternalIcon = ({ size = 14 }: P) =>
  svg(size, <><path d="M15 3h6v6M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>)
/** The Praedus "Cadence" mark: one wave that lands on a beat. Drawn on a 48-unit grid. */
export const LogoIcon = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path d="M6.5 24C6.5 13 19.5 13 19.5 24S32.5 35 32.5 24" fill="none" stroke="currentColor"
      strokeWidth="5.5" strokeLinecap="round" />
    <circle cx="40.5" cy="24" r="3.9" fill="currentColor" />
  </svg>
)
export const AlertIcon = ({ size = 16 }: P) =>
  svg(size, <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>)
export const PinIcon = ({ size = 11 }: P) =>
  svg(size, <><path d="M12 17v5" /><path d="M9 10.8V4h6v6.8l3 3.2H6z" /></>)
export const SparkIcon = ({ size = 16 }: P) =>
  svg(size, <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>)
export const GraphIcon = ({ size = 16 }: P) =>
  svg(size, <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="17" r="3" /><path d="M8.2 7.3 10.6 14.4M16.4 8.4 13.5 14.6M8.4 6.2l7.6.6" /></>)
