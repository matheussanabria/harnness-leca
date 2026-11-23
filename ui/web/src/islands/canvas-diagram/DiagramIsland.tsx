// Canvas diagram island (story 21.04). Embedded in the Design workspace: the side catalog picks the diagram (params[0]).
import { useMemo } from "react";
import { createDiagramApi } from "../../features/diagram/api.ts";
import { EmptyPane } from "../../shared/EmptyPane";
import type { IslandProps } from "../../shared/island";
import { DiagramEditor } from "./DiagramEditor";
import "./diagram.css";

export function DiagramIsland({ slug, params }: IslandProps) {
  const api = useMemo(() => createDiagramApi(slug), [slug]);
  const id = params[0];
  return (
    <div className="diagram-island">
      {id ? (
        <DiagramEditor api={api} id={id} />
      ) : (
        <EmptyPane
          icon="fa-diagram-project"
          title="Nenhum diagrama aberto"
          hint="Escolha um diagrama no catálogo ou crie um novo."
        />
      )}
    </div>
  );
}
