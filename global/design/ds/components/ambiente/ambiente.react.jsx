// EnvBanner.jsx  (React 18 + Vite)
import './env.css';

const KINDS = { development: 'dev', staging: 'hml' };

export function EnvBanner() {
  const mode = import.meta.env.MODE;              // 'development' | 'staging' | 'production'
  if (mode === 'production') return null;         // nunca exibir em produção
  const label = import.meta.env.VITE_ENV_LABEL ?? mode.toUpperCase();
  return <div className={'env env--' + (KINDS[mode] ?? 'dev')} role="note">{label}</div>;
}