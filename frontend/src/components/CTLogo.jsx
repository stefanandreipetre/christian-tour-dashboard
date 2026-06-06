/**
 * Christian Tour brand logo — SVG recreation.
 * Orange rounded square with white profile silhouette + road lines.
 */
export default function CTLogo({ size = 40, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Orange background */}
      <rect width="100" height="100" rx="18" fill="#E8440A" />

      {/* White face profile silhouette — simplified but recognisable */}
      <g fill="white">
        {/* Head shape */}
        <ellipse cx="48" cy="32" rx="16" ry="18" />
        {/* Neck */}
        <rect x="40" y="48" width="14" height="10" rx="3" />
        {/* Chin / jaw extension */}
        <path d="M34 46 Q28 56 32 62 L52 62 Q60 58 58 48 Z" />
        {/* Nose bump */}
        <path d="M32 36 Q26 38 28 42 Q30 44 34 43" />
        {/* Forehead highlight to make it look more like a profile */}
        <path d="M48 14 Q66 18 65 32 Q64 44 58 48 L54 48 Q62 42 61 30 Q60 18 48 14Z" fill="#E8440A" />
      </g>

      {/* White road/horizon lines — travel motif */}
      <g stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9">
        <line x1="14" y1="72" x2="86" y2="72" />
        <line x1="22" y1="82" x2="78" y2="82" />
        <line x1="32" y1="91" x2="68" y2="91" />
      </g>
    </svg>
  )
}
