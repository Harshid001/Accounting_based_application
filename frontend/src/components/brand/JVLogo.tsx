export interface JVLogoProps {
  /** Size preset for the logo */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional custom pixel size */
  pixelSize?: number;
  /** Custom additional className */
  className?: string;
  /** Whether to render with an executive medallion badge background */
  badge?: boolean;
}

const sizeConfig = {
  sm: 36,
  md: 44,
  lg: 52,
  xl: 64,
};

export function JVLogoMark({
  size = 44,
  className = '',
  badge = false,
}: {
  size?: number;
  className?: string;
  badge?: boolean;
}) {
  // Unique gradient ID prefix to avoid DOM namespace collisions
  const id = 'jv-official-logo';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${className}`}
      aria-label="JV Tax Consultancy Logo"
      role="img"
    >
      <defs>
        {/* Burnt Orange Metallic Gradient for Letter V & Accents */}
        <linearGradient id={`${id}-gold`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#ffb15c" />
          <stop offset="30%" stopColor="#ff8a1f" />
          <stop offset="70%" stopColor="#ff6a00" />
          <stop offset="100%" stopColor="#c24f00" />
        </linearGradient>

        {/* Secondary Warm Tangerine Shimmer */}
        <linearGradient id={`${id}-gold-light`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd9ae" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff6a00" stopOpacity="0.75" />
        </linearGradient>

        {/* Deep Obsidian Gradient for Light Mode */}
        <linearGradient id={`${id}-navy`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#262626" />
          <stop offset="50%" stopColor="#171717" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>

        {/* Crisp Warm White Gradient for Dark Mode */}
        <linearGradient id={`${id}-platinum`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f5f2ed" />
          <stop offset="100%" stopColor="#d4cfc7" />
        </linearGradient>

        {/* Optional Executive Medallion Radial Fill */}
        <radialGradient id={`${id}-medallion`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#2b1600" />
          <stop offset="70%" stopColor="#150b00" />
          <stop offset="100%" stopColor="#0a0500" />
        </radialGradient>
      </defs>

      {/* Optional Refined Medallion Backdrop */}
      {badge && (
        <circle
          cx="32"
          cy="32"
          r="30.5"
          fill={`url(#${id}-medallion)`}
          stroke={`url(#${id}-gold)`}
          strokeWidth="1.2"
        />
      )}

      {/* Outer Fine Chartered Seal Ring (Subtle Architectural Framing) */}
      <circle
        cx="32"
        cy="32"
        r="29.5"
        stroke={`url(#${id}-gold)`}
        strokeWidth="1"
        strokeOpacity="0.4"
        fill="none"
      />

      {/* Inner Precision Verification Dotted Ring */}
      <circle
        cx="32"
        cy="32"
        r="27"
        className="stroke-[var(--fd-text-primary)]"
        strokeWidth="0.75"
        strokeOpacity="0.18"
        strokeDasharray="1.5 2.5"
        fill="none"
      />

      {/* Cardinal Precision Diamond Accents (12 o'clock, 6 o'clock, 9 o'clock, 3 o'clock) */}
      <path d="M 32 1.5 L 33 2.5 L 32 3.5 L 31 2.5 Z" fill={`url(#${id}-gold)`} />
      <path d="M 32 60.5 L 33 61.5 L 32 62.5 L 31 61.5 Z" fill={`url(#${id}-gold)`} />
      <path d="M 1.5 32 L 2.5 33 L 3.5 32 L 2.5 31 Z" fill={`url(#${id}-gold)`} />
      <path d="M 60.5 32 L 61.5 33 L 62.5 32 L 61.5 31 Z" fill={`url(#${id}-gold)`} />

      {/* Letter V: Dynamic Growth & Statutory Verification Chevron (Behind J on left, In front on right) */}
      <path
        d="M 28 22 L 39 53 L 56 13 H 49 L 39 42 L 32 22 Z"
        fill={`url(#${id}-gold)`}
      />

      {/* Masking Clearance Gap Around J (Negative space separator that weaves the J through the V) */}
      <path
        d="M 14 13 H 32 V 18 H 30.5 V 40 C 30.5 48.5 22.5 53 14 53 C 7.5 53 6.5 46.5 6.5 39 H 13 C 13 43.5 15.5 47 19.5 47 C 23.5 47 24 43.5 24 40 V 18 H 14 Z"
        className="stroke-[var(--fd-bg)]"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Letter J: Pillar of Governance & Statutory Trust (Theme-adaptive Obsidian in Light / Warm White in Dark) */}
      <path
        d="M 14 13 H 32 V 18 H 30.5 V 40 C 30.5 48.5 22.5 53 14 53 C 7.5 53 6.5 46.5 6.5 39 H 13 C 13 43.5 15.5 47 19.5 47 C 23.5 47 24 43.5 24 40 V 18 H 14 Z"
        className="fill-[#171717] dark:fill-[#f5f2ed]"
      />

      {/* Architectural Bevel Highlight on J Top Pediment */}
      <rect
        x="15"
        y="14"
        width="16"
        height="1.5"
        fill={`url(#${id}-gold-light)`}
        fillOpacity="0.8"
      />

      {/* Sovereign Apex Diamond at Top-Right of Ascending V */}
      <path
        d="M 52.5 10.5 L 54.5 13 L 52.5 15.5 L 50.5 13 Z"
        fill={`url(#${id}-gold)`}
      />
    </svg>
  );
}

/**
 * Standard brand logo component for JV Tax Consultancy.
 * Displays only the pure, professional official emblem.
 */
export function JVLogo({
  size = 'md',
  pixelSize,
  className = '',
  badge = false,
}: JVLogoProps) {
  const finalSize = pixelSize ?? sizeConfig[size];
  return <JVLogoMark size={finalSize} className={className} badge={badge} />;
}
