// index.html  (Vite) — declare no <head>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

// Favicon dinâmico por ambiente (opcional)
import { useEffect } from 'react';
export function useFavicon(url) {
  useEffect(() => {
    const el = document.querySelector('link[rel="icon"]');
    if (el) el.setAttribute('href', url);
  }, [url]);
}