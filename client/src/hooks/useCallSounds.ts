import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";

function play(el: HTMLAudioElement | null) {
  if (!el) return;
  el.currentTime = 0;
  void el.play().catch(() => {
    // Autoplay may be blocked until a user gesture.
  });
}

export function useCallSounds({
  connected,
  messages,
}: {
  connected: boolean;
  messages: ChatMessage[];
}) {
  const connectRef = useRef<HTMLAudioElement | null>(null);
  const messageRef = useRef<HTMLAudioElement | null>(null);
  const wasConnected = useRef(false);
  const primed = useRef(false);
  const lastRemoteId = useRef<string | null>(null);

  useEffect(() => {
    const connect = new Audio("/connected.mp3");
    connect.preload = "auto";
    connect.volume = 0.32;
    connectRef.current = connect;

    const message = new Audio("/message.wav");
    message.preload = "auto";
    message.volume = 0.4;
    messageRef.current = message;

    return () => {
      connect.pause();
      message.pause();
      connectRef.current = null;
      messageRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (connected && !wasConnected.current) play(connectRef.current);
    if (!connected && wasConnected.current) play(connectRef.current);
    wasConnected.current = connected;
  }, [connected]);

  useEffect(() => {
    const lastRemote = [...messages]
      .reverse()
      .find((m) => m.from === "remote");
    if (!primed.current) {
      primed.current = true;
      lastRemoteId.current = lastRemote?.id ?? null;
      return;
    }
    if (lastRemote && lastRemote.id !== lastRemoteId.current) {
      lastRemoteId.current = lastRemote.id;
      play(messageRef.current);
    }
  }, [messages]);
}
