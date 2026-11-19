import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` — for live clocks, rings and "in 5 days" texts. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
