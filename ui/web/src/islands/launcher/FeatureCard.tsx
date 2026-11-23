// One feature card. A feature that cannot open stays focusable (aria-disabled, not disabled) so the reason is read.
import type { Feature } from "../../features/launcher/model.ts";

interface Props {
  feature: Feature;
  onActivate: (feature: Feature) => void;
  onPickProject?: () => void;
}

export function FeatureCard({ feature, onActivate, onPickProject }: Props) {
  const blocked = !feature.disponivel;
  const reasonId = `why-${feature.id}`;
  const needsProject = blocked && feature.escopo === "project" && feature.estado === "ativa";
  return (
    <div className="launcher-card-wrap">
      <button
        type="button"
        className="launcher-card"
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? reasonId : undefined}
        onClick={() => onActivate(feature)}
      >
        <span className="launcher-card__ico">
          <i className={feature.icone} aria-hidden="true" />
        </span>
        <h3>{feature.titulo}</h3>
        <p>{feature.descricao}</p>
      </button>
      {blocked && (
        <p className="launcher-why" id={reasonId}>
          <i
            className={`fa-solid ${feature.estado === "planejada" ? "fa-hourglass-half" : "fa-lock"}`}
            aria-hidden="true"
          />
          <span>{feature.motivo}</span>
          {needsProject && onPickProject && (
            <button type="button" className="launcher-link" onClick={onPickProject}>
              Escolher projeto
            </button>
          )}
        </p>
      )}
    </div>
  );
}
