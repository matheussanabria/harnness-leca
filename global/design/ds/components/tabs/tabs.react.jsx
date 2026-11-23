// Tabs.jsx  (React 18)
import { useState } from 'react';
import './tabs.css';

export function Tabs({ tabs, initial = tabs[0].id }) {
  const [active, setActive] = useState(initial);
  const move = (e) => {
    const i = tabs.findIndex((t) => t.id === active);
    const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : i;
    if (n !== i) { setActive(tabs[n].id); document.getElementById('tab-' + tabs[n].id)?.focus(); }
  };
  return (
    <>
      <div role="tablist" className="tabs" onKeyDown={move}>
        {tabs.map((t) => (
          <button key={t.id} id={'tab-' + t.id} role="tab" aria-selected={active === t.id} aria-controls={'pn-' + t.id}
            tabIndex={active === t.id ? 0 : -1} onClick={() => setActive(t.id)}>{t.label}</button>
        ))}
      </div>
      {tabs.map((t) => <div key={t.id} id={'pn-' + t.id} role="tabpanel" aria-labelledby={'tab-' + t.id} hidden={active !== t.id}>{t.content}</div>)}
    </>
  );
}