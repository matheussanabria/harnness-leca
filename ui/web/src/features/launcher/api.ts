// Typed client of the launcher (EP-25.05). Fetch is injectable for tests.
import { type Feature, scopeHeaderValue } from "./model.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FeaturesAnswer {
  projeto: string | null;
  funcionalidades: Feature[];
}

export class LauncherApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LauncherApiError";
    this.status = status;
  }
}

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/** The manifest with availability for a scope. 404 means the remembered project no longer exists. */
export async function fetchFeatures(
  project: string | null,
  fetchImpl: FetchLike = defaultFetch,
  signal?: AbortSignal,
): Promise<FeaturesAnswer> {
  const response = await fetchImpl("/api/features", {
    headers: { "X-Harness-Project": scopeHeaderValue(project) },
    signal,
  });
  if (!response.ok) throw new LauncherApiError(`GET /api/features answered ${response.status}`, response.status);
  return (await response.json()) as FeaturesAnswer;
}

/** The project slugs and the last used one (GET /api/state). */
export async function fetchProjects(
  fetchImpl: FetchLike = defaultFetch,
  signal?: AbortSignal,
): Promise<{ projects: string[]; active: string }> {
  const response = await fetchImpl("/api/state", { signal });
  if (!response.ok) throw new LauncherApiError(`GET /api/state answered ${response.status}`, response.status);
  const body = (await response.json()) as { projects?: string[]; active?: string };
  return { projects: body.projects ?? [], active: body.active ?? "" };
}

/** Keeps the legacy pages, which still read projects/.active, on the same project the launcher opened. */
export async function syncActiveProject(slug: string, fetchImpl: FetchLike = defaultFetch): Promise<boolean> {
  try {
    const response = await fetchImpl("/api/project/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
