export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2f5bff" />
      <circle cx="9" cy="10" r="3" fill="#fff" />
      <circle cx="23" cy="22" r="3" fill="#fff" />
      <path d="M9 13v3a3 3 0 0 0 3 3h8" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
