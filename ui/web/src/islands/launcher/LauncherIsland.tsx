// The Harness start screen (EP-25.05, ADR-019): every feature grouped by scope, with a project picker that
// includes "Sem projeto". Opening a feature follows its route; for a project it also keeps the legacy pages on
// the same project (they still read projects/.active).
import { useEffect, useState } from "react";
import { syncActiveProject } from "../../features/launcher/api.ts";
import { cardAction, type Feature, groupFeatures, openUrl } from "../../features/launcher/model.ts";
import type { IslandProps } from "../../shared/island";
import { FeatureCard } from "./FeatureCard.tsx";
import "./launcher.css";
import { ScopePicker } from "./ScopePicker.tsx";
import { useLauncher } from "./useLauncher.ts";

export function LauncherIsland(_props: IslandProps) {
  const { status, features, projects, project, projectsLoaded, choose, retry } = useLauncher();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activate = async (feature: Feature) => {
    const action = cardAction(feature);
    if (action.kind === "explain") {
      setNotice(action.message);
      return;
    }
    if (project) await syncActiveProject(project);
    window.location.assign(openUrl(feature, project));
  };

  const groups = groupFeatures(features);
  return (
    <div className="launcher">
      <header className="launcher__top">
        <div>
          <h1>O que você quer fazer?</h1>
          <p className="launcher__scope">
            {project ? (
              <>
                Trabalhando no projeto <span className="launcher-tag">{project}</span>
              </>
            ) : (
              <>
                Trabalhando{" "}
                <span className="launcher-tag">
                  <i className="fa-solid fa-user" aria-hidden="true" /> Sem projeto
                </span>{" "}
                — o que você criar fica no espaço pessoal.
              </>
            )}
          </p>
        </div>
        <ScopePicker
          projects={projects}
          project={project}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onChoose={choose}
        />
      </header>

      {status === "loading" && (
        <div className="launcher-grid" role="status" aria-busy="true" aria-label="Carregando funcionalidades">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="launcher-skel" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="launcher-state is-error" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <p>Não foi possível carregar as funcionalidades.</p>
          <button type="button" className="launcher-btn is-primary" onClick={retry}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      )}

      {status === "ready" &&
        groups.map((group) => (
          <section key={group.escopo} className="launcher-group" aria-labelledby={`launcher-g-${group.escopo}`}>
            <h2 id={`launcher-g-${group.escopo}`}>{group.titulo}</h2>
            <p className="launcher-group__hint">{group.hint}</p>
            <div className="launcher-grid">
              {group.features.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  onActivate={activate}
                  onPickProject={() => setPickerOpen(true)}
                />
              ))}
            </div>
          </section>
        ))}

      {status === "ready" && projectsLoaded && projects.length === 0 && (
        <p className="launcher-group__hint">
          Nenhum projeto criado ainda: as funcionalidades de projeto ficam disponíveis depois de criar o primeiro.
        </p>
      )}

      <div className="launcher-toast" role="status" aria-live="polite" hidden={!notice}>
        {notice}
      </div>
    </div>
  );
}
