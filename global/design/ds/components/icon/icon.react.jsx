// Icon.jsx  (React 18)
export function Icon({ path, size = 24, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={path} />
    </svg>
  );
}
export const ICONS = { plus: 'M12 5v14M5 12h14', search: 'M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z' };
// <Icon path={ICONS.plus} />