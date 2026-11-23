// Button.jsx  (React 18)
import './button.css';

export function Button({ variant = 'primary', circle = false, loading = false, disabled, children, ...rest }) {
  const cls = ['btn', 'btn--' + variant, circle && 'btn--circle'].filter(Boolean).join(' ');
  return (
    <button className={cls} type="button" disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
}
// <Button>Confirmar</Button>  <Button variant="danger">Excluir</Button>  <Button circle aria-label="Pesquisar"><SearchIcon /></Button>