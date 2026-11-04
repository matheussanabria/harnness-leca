// The shell follows prefers-color-scheme (css/base.css: dark by default, light under the media query).
import { useEffect, useState } from "react";

export type ShellTheme = "light" | "dark";

export function useShellTheme(): ShellTheme {
  const query = "(prefers-color-scheme: light)";
  const [theme, setTheme] = useState<ShellTheme>(() => (window.matchMedia(query).matches ? "light" : "dark"));
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setTheme(media.matches ? "light" : "dark");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return theme;
}
