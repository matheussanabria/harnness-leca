// State of the launcher: projects, the chosen scope and the manifest for that scope (EP-25.05).
import { useCallback, useEffect, useState } from "react";
import { fetchFeatures, fetchProjects, LauncherApiError } from "../../features/launcher/api.ts";
import type { Feature } from "../../features/launcher/model.ts";
import { validStoredProject } from "../../features/launcher/model.ts";
import { loadScope, saveScope } from "../../features/launcher/storage.ts";

export type LauncherStatus = "loading" | "ready" | "error";

export interface LauncherState {
  status: LauncherStatus;
  features: Feature[];
  projects: string[];
  project: string | null;
  projectsLoaded: boolean;
  choose: (project: string | null) => void;
  retry: () => void;
}

export function useLauncher(): LauncherState {
  const [projects, setProjects] = useState<string[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [project, setProject] = useState<string | null>(() => loadScope());
  const [features, setFeatures] = useState<Feature[]>([]);
  const [status, setStatus] = useState<LauncherStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  // Projects load once. A remembered project that no longer exists is dropped (back to "Sem projeto").
  useEffect(() => {
    const controller = new AbortController();
    fetchProjects(undefined, controller.signal)
      .then((answer) => {
        setProjects(answer.projects);
        setProject((current) => validStoredProject(current, answer.projects));
      })
      .catch(() => {
        /* the picker still offers "Sem projeto"; the features request reports real failures */
      })
      .finally(() => {
        if (!controller.signal.aborted) setProjectsLoaded(true);
      });
    return () => controller.abort();
  }, []);

  // The manifest reloads whenever the scope changes or the user retries.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchFeatures(project, undefined, controller.signal)
      .then((answer) => {
        setFeatures(answer.funcionalidades);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof LauncherApiError && error.status === 404 && project) setProject(null);
        else setStatus("error");
      });
    return () => controller.abort();
  }, [project, attempt]);

  const choose = useCallback((next: string | null) => {
    saveScope(next);
    setProject(next);
  }, []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, features, projects, project, projectsLoaded, choose, retry };
}
