import { useEffect, useRef } from "react";

// disabled for now to be fixed in future hopefully
// useDialingSound(joined, connected);

export const useDialingSound = (joined: boolean, connected: boolean) => {
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevConnectedRef = useRef(false);
  const mountedRef = useRef(true);

  const isDialing = joined && !connected;

  // Initialize audio once
  useEffect(() => {
    mountedRef.current = true;

    ringAudioRef.current = new Audio("/ring.mp3");
    ringAudioRef.current.loop = true;
    ringAudioRef.current.volume = 0.03;
    ringAudioRef.current.preload = "auto";

    connectAudioRef.current = new Audio("/connected.mp3");
    connectAudioRef.current.volume = 0.3;
    connectAudioRef.current.preload = "auto";

    return () => {
      mountedRef.current = false;
      if (ringAudioRef.current) {
        ringAudioRef.current.pause();
        ringAudioRef.current = null;
      }
      if (connectAudioRef.current) {
        connectAudioRef.current.pause();
        connectAudioRef.current = null;
      }
    };
  }, []);

  // Handle ring sound
  useEffect(() => {
    if (isDialing && ringAudioRef.current) {
      ringAudioRef.current.play().catch((err) => {
        console.error("Ring playback error:", err);
      });
    } else if (ringAudioRef.current) {
      ringAudioRef.current.pause();
      ringAudioRef.current.currentTime = 0;
    }
  }, [isDialing]);

  // Handle connection sound (play once when connected)
  useEffect(() => {
    if (connected && !prevConnectedRef.current && connectAudioRef.current) {
      connectAudioRef.current.currentTime = 0;
      connectAudioRef.current.play().catch((err) => {
        console.error("Connected playback error:", err);
      });
    }
    prevConnectedRef.current = connected;
  }, [connected]);
};
