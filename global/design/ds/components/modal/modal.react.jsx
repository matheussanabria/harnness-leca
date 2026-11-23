export function Modal({ open, title, onClose, children, actions }) {
  if (!open) return null;
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="modal__head"><h2>{title}</h2></header>
        <div className="modal__body">{children}</div>
        <footer className="modal__foot">{actions}</footer>
      </div>
    </div>, document.body);
}