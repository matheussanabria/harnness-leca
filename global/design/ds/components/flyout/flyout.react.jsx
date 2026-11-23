// UserMenu.jsx
const GROUPS = {
  vendas: { title: 'Vendas', icon: DollarIcon, items: [
    { label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Veículos', to: '/admin/veiculos' },
    { label: 'Leads', to: '/admin/leads' }, { label: 'Cadastrar veículo', to: '/admin/veiculos/novo' } ] },
  gerenciamento: { title: 'Gerenciamento', icon: SlidersIcon, items: [ /* Marcas, Modelos, Versões, Itens, Motores, Cores */ ] },
  financeiro: { title: 'Financeiro', icon: WalletIcon, items: [ /* Fluxo de Caixa, Receitas, Despesas, Contas… */ ] },
  conta: { title: 'Minha conta', icon: UserIcon, items: [{ label: 'Configurações', to: '/conta' }] },
};
const BY_ROLE = {
  cliente: ['conta'], vendedor: ['vendas', 'conta'],
  financeiro: ['financeiro', 'conta'], admin: ['vendas', 'gerenciamento', 'financeiro', 'conta'],
};

export function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const isMobile = useMediaQuery('(max-width: 991px)');
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') active ? setActive(null) : setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [active]);

  return (
    <div ref={ref} className="user-menu-anchor__inner">
      <button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><Avatar /> {user.firstName}</button>
      {open && (
        <div className="user-menu" role="menu" onMouseLeave={() => !isMobile && setActive(null)}>
          <div className="user-menu__who"><b>{user.name}</b><small>{user.roleLabel}</small></div>
          {BY_ROLE[user.role].map(key => {
            const g = GROUPS[key]; const isOpen = active === key;
            return (
              <div key={key} className={`um-group ${isOpen ? 'is-open' : ''}`} onMouseEnter={() => !isMobile && setActive(key)}>
                <button className="um-group__head" role="menuitem" aria-haspopup="menu" aria-expanded={isOpen}
                        onClick={() => setActive(isMobile && isOpen ? null : key)} onFocus={() => !isMobile && setActive(key)}>
                  <g.icon /> {g.title}
                </button>
                <div className="um-flyout" role="menu"><div className="um-flyout__panel">
                  {g.items.map(i => <Link key={i.to} role="menuitem" to={i.to} onClick={() => setOpen(false)}>{i.label}</Link>)}
                </div></div>
              </div>
            );
          })}
          <button className="um-logout" role="menuitem" onClick={onLogout}>Sair</button>
        </div>
      )}
    </div>
  );
}