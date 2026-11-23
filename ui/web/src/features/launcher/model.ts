// Pure model of the launcher (EP-25.05, ADR-019): grouping by scope, project options and keyboard highlight.
// No DOM and no network, so it is unit-tested by importing this file directly.

export type FeatureScope = "project" | "optional" | "global";

/** One entry of GET /api/features (ui/server/features/manifest.js plus availability). */
export interface Feature {
  id: string;
  titulo: string;
  descricao: string;
  escopo: FeatureScope;
  icone: string;
  rota: string;
  janela: string;
  estado: "ativa" | "planejada";
  /** The route needs ?p=<scope> so the SPA opens in the chosen project or in the personal workspace. */
  escopoNaUrl?: boolean;
  disponivel: boolean;
  motivo: string;
}

export interface FeatureGroup {
  escopo: FeatureScope;
  titulo: string;
  hint: string;
  features: Feature[];
}

const GROUP_ORDER: ReadonlyArray<Omit<FeatureGroup, "features">> = [
  {
    escopo: "optional",
    titulo: "Criar e conversar",
    hint: "Funcionam sem projeto e ficam melhores com um. O que você cria sem projeto vai para o espaço pessoal e pode ser movido para um projeto depois.",
  },
  { escopo: "project", titulo: "Do projeto", hint: "Precisam de um projeto escolhido." },
  { escopo: "global", titulo: "Geral", hint: "Sempre disponíveis." },
];

/** Groups the manifest by scope, in a fixed order, dropping empty groups. */
export function groupFeatures(features: readonly Feature[]): FeatureGroup[] {
  return GROUP_ORDER.map((group) => ({ ...group, features: features.filter((f) => f.escopo === group.escopo) })).filter(
    (group) => group.features.length > 0,
  );
}

/** Value of the X-Harness-Project header: "none" selects the personal workspace (ui/server/scope/resolve-scope.js). */
export function scopeHeaderValue(project: string | null): string {
  return project ?? "none";
}

export interface ProjectOption {
  /** null is the "Sem projeto" option. */
  slug: string | null;
  name: string;
  meta: string;
}

const NO_PROJECT_LABEL = "Sem projeto";

/** "Sem projeto" first when it matches the query, then the projects whose slug contains it. */
export function buildOptions(projects: readonly string[], query: string): ProjectOption[] {
  const q = query.trim().toLowerCase();
  const options: ProjectOption[] = [];
  if (!q || `${NO_PROJECT_LABEL} pessoal`.toLowerCase().includes(q)) {
    options.push({ slug: null, name: NO_PROJECT_LABEL, meta: "Espaço pessoal" });
  }
  for (const slug of projects) {
    if (!q || slug.toLowerCase().includes(q)) options.push({ slug, name: slug, meta: "Projeto" });
  }
  return options;
}

/** Moves the highlight by delta and wraps around; stays 0 for an empty list. */
export function moveHighlight(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

/** Keeps a remembered project only while it still exists. */
export function validStoredProject(stored: string | null, projects: readonly string[]): string | null {
  return stored && projects.includes(stored) ? stored : null;
}

/** Where a card leads: the route, with the scope in the URL when the page needs it. */
export function openUrl(feature: Feature, project: string | null): string {
  if (!feature.escopoNaUrl) return feature.rota;
  return `${feature.rota}?p=${encodeURIComponent(project ?? "_pessoal")}`;
}

/** What a click on a card should do: open it, or explain why it cannot be opened. */
export function cardAction(feature: Feature): { kind: "open"; rota: string } | { kind: "explain"; message: string } {
  if (feature.disponivel) return { kind: "open", rota: feature.rota };
  return { kind: "explain", message: feature.motivo || "Esta funcionalidade não está disponível agora." };
}
