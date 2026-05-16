// src/hooks/useCallTimer.ts
import { useEffect, useState } from "react";

export function useCallTimer(connected: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!connected) {
      return;
    }

    (() => setSeconds(0))();

    const interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);

    return () => clearInterval(interval);
  }, [connected]);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
