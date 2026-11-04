// Placeholder of an island embedded in a workspace when nothing is selected in the side catalog.
import "./empty-pane.css";

export function EmptyPane({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="island-empty" role="status">
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  );
}
