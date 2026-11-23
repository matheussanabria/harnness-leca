const [idx, setIdx] = useState(0);
const off = (i, n) => { let o = (((i - idx) % n) + n) % n; return o > n / 2 ? o - n : o; };

{items.map((t, i) => {
  const o = off(i, items.length);
  return <div key={t} className="cf-item" style={{ '--o': o }} onClick={() => setIdx(i)}>{t}</div>;
})}