// Timed, transient status text for the mind-map toolbar (copy confirmations).
import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_TIMEOUT_MS = 2500;

/**
 * Returns the current status message and a setter. The message clears itself
 * after about 2.5 seconds; a new message restarts the timer.
 */
export function useCopyStatus(timeoutMs: number = STATUS_TIMEOUT_MS) {
  const [status, setStatus] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setStatus(null);
  }, []);

  const show = useCallback(
    (message: string) => {
      if (timer.current !== null) clearTimeout(timer.current);
      setStatus(message);
      timer.current = setTimeout(() => {
        timer.current = null;
        setStatus(null);
      }, timeoutMs);
    },
    [timeoutMs],
  );

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return { status, show, clear };
}
