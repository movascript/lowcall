import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type {
  CallReaction,
  ChatFileMessage,
  ChatMessage,
  ChatTextMessage,
  MessageReaction,
} from "../types";
import {
  CHAT_MAX_LENGTH,
  FILE_CHUNK_SIZE,
  FILE_MAX_BYTES,
} from "../utils/constants";
import { log } from "../utils/helper";

type ChatPayload =
  | { type: "chat"; id: string; text: string; sentAt: number }
  | { type: "call-reaction"; emoji: string }
  | { type: "message-reaction"; messageId: string; emoji: string }
  | { type: "file-meta"; id: string; name: string; size: number; mime: string }
  | { type: "file-end"; id: string };

const HIGH_WATER = 2 * 1024 * 1024;
const LOW_WATER = 256 * 1024;

function toggleReaction(
  reactions: MessageReaction[],
  emoji: string,
  who: "local" | "remote",
): MessageReaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) {
    return [
      ...reactions,
      {
        emoji,
        local: who === "local",
        remote: who === "remote",
      },
    ];
  }
  const next = {
    ...existing,
    [who]: !existing[who],
  };
  if (!next.local && !next.remote) {
    return reactions.filter((r) => r.emoji !== emoji);
  }
  return reactions.map((r) => (r.emoji === emoji ? next : r));
}

export function usePeerData(
  peerConnectionRef: RefObject<RTCPeerConnection | null>,
  roleReady: boolean,
  polite: boolean,
  pcEpoch: number,
  kickNegotiate: () => void,
) {
  const [chatReady, setChatReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [callReactions, setCallReactions] = useState<CallReaction[]>([]);
  const [collabError, setCollabError] = useState<string | null>(null);

  const chatRef = useRef<RTCDataChannel | null>(null);
  const filesRef = useRef<RTCDataChannel | null>(null);
  const outgoingQueue = useRef<ChatPayload[]>([]);
  const inboundFile = useRef<{
    id: string;
    name: string;
    size: number;
    mime: string;
    chunks: ArrayBuffer[];
    received: number;
  } | null>(null);
  const panelOpenRef = useRef(false);
  panelOpenRef.current = panelOpen;
  const kickNegotiateRef = useRef(kickNegotiate);
  kickNegotiateRef.current = kickNegotiate;

  const resetCollab = useCallback(() => {
    try {
      chatRef.current?.close();
    } catch {
      /* isolated */
    }
    try {
      filesRef.current?.close();
    } catch {
      /* isolated */
    }
    chatRef.current = null;
    filesRef.current = null;
    outgoingQueue.current = [];
    inboundFile.current = null;
    setChatReady(false);
    setMessages([]);
    setUnread(0);
    setCallReactions([]);
    setCollabError(null);
  }, []);

  const flushQueue = useCallback(() => {
    const channel = chatRef.current;
    if (!channel || channel.readyState !== "open") return;
    const queued = outgoingQueue.current;
    outgoingQueue.current = [];
    for (const payload of queued) {
      try {
        channel.send(JSON.stringify(payload));
        if (payload.type === "chat") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.id ? { ...m, status: "sent" } : m,
            ),
          );
        }
      } catch {
        outgoingQueue.current.push(payload);
        setCollabError("Chat send failed");
        break;
      }
    }
  }, []);

  const attachChatChannel = useCallback(
    (channel: RTCDataChannel) => {
      chatRef.current = channel;
      channel.onopen = () => {
        setChatReady(true);
        setCollabError(null);
        flushQueue();
      };
      channel.onclose = () => {
        if (chatRef.current === channel) setChatReady(false);
      };
      channel.onerror = () => {
        setCollabError("Chat unavailable — video is still connected");
        setChatReady(false);
      };
      channel.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const payload = JSON.parse(event.data) as ChatPayload;
          handleIncoming(payload);
        } catch {
          setCollabError("Ignored a malformed chat message");
        }
      };
    },
    // Incoming parser is recreated each render; channels only need the latest via the closure on message events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flushQueue],
  );

  const handleIncoming = (payload: ChatPayload) => {
    if (payload.type === "chat") {
      const msg: ChatTextMessage = {
        kind: "text",
        id: payload.id,
        text: payload.text,
        sentAt: payload.sentAt,
        from: "remote",
        status: "sent",
        reactions: [],
      };
      setMessages((prev) => [...prev, msg]);
      if (!panelOpenRef.current) setUnread((n) => n + 1);
      return;
    }
    if (payload.type === "call-reaction") {
      pushCallReaction(payload.emoji, "remote");
      return;
    }
    if (payload.type === "message-reaction") {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? {
                ...m,
                reactions: toggleReaction(m.reactions, payload.emoji, "remote"),
              }
            : m,
        ),
      );
      return;
    }
    if (payload.type === "file-meta") {
      inboundFile.current = {
        id: payload.id,
        name: payload.name,
        size: payload.size,
        mime: payload.mime,
        chunks: [],
        received: 0,
      };
      const fileMsg: ChatFileMessage = {
        kind: "file",
        id: payload.id,
        name: payload.name,
        size: payload.size,
        mime: payload.mime,
        sentAt: Date.now(),
        from: "remote",
        status: "sent",
        progress: 0,
        reactions: [],
      };
      setMessages((prev) => [...prev, fileMsg]);
      if (!panelOpenRef.current) setUnread((n) => n + 1);
      return;
    }
    if (payload.type === "file-end") {
      const inbound = inboundFile.current;
      if (!inbound || inbound.id !== payload.id) return;
      const blob = new Blob(inbound.chunks, {
        type: inbound.mime || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "file" && m.id === payload.id
            ? { ...m, url, progress: 1 }
            : m,
        ),
      );
      inboundFile.current = null;
    }
  };

  const attachFilesChannel = useCallback((channel: RTCDataChannel) => {
    filesRef.current = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = LOW_WATER;
    channel.onerror = () => {
      setCollabError("File transfer hit an error — video is still connected");
    };
    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          handleIncoming(JSON.parse(event.data) as ChatPayload);
        } catch {
          setCollabError("Ignored a malformed file message");
        }
        return;
      }
      const inbound = inboundFile.current;
      if (!inbound || !(event.data instanceof ArrayBuffer)) return;
      inbound.chunks.push(event.data);
      inbound.received += event.data.byteLength;
      const progress = Math.min(1, inbound.received / inbound.size);
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "file" && m.id === inbound.id ? { ...m, progress } : m,
        ),
      );
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onmessage uses handleIncoming from this render
  }, []);

  function pushCallReaction(emoji: string, from: "local" | "remote") {
    const id = crypto.randomUUID();
    const x = 10 + Math.random() * 72;
    setCallReactions((prev) => {
      const next = [...prev, { id, emoji, from, x }];
      return next.length > 10 ? next.slice(next.length - 10) : next;
    });
    window.setTimeout(() => {
      setCallReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  }

  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc || !roleReady) {
      return;
    }

    const onDataChannel = (event: RTCDataChannelEvent) => {
      try {
        if (event.channel.label === "chat") attachChatChannel(event.channel);
        if (event.channel.label === "files") attachFilesChannel(event.channel);
      } catch {
        setCollabError("Chat failed to start — video is still connected");
      }
    };
    pc.addEventListener("datachannel", onDataChannel);

    if (!polite) {
      try {
        if (!chatRef.current || chatRef.current.readyState === "closed") {
          attachChatChannel(
            pc.createDataChannel("chat", { ordered: true }),
          );
        }
        if (!filesRef.current || filesRef.current.readyState === "closed") {
          attachFilesChannel(
            pc.createDataChannel("files", { ordered: true }),
          );
        }
      } catch {
        queueMicrotask(() =>
          setCollabError("Chat failed to start — video is still connected"),
        );
      }
    }

    kickNegotiateRef.current();

    return () => {
      pc.removeEventListener("datachannel", onDataChannel);
    };
  }, [
    peerConnectionRef,
    roleReady,
    polite,
    pcEpoch,
    attachChatChannel,
    attachFilesChannel,
  ]);

  const sendPayload = (payload: ChatPayload, queueIfDown: boolean) => {
    const channel = chatRef.current;
    try {
      if (channel && channel.readyState === "open") {
        channel.send(JSON.stringify(payload));
        return true;
      }
      if (queueIfDown) {
        outgoingQueue.current.push(payload);
        return false;
      }
      return false;
    } catch {
      setCollabError("Chat send failed — video is still connected");
      if (queueIfDown) outgoingQueue.current.push(payload);
      return false;
    }
  };

  const sendChat = (raw: string) => {
    const text = raw.trim().slice(0, CHAT_MAX_LENGTH);
    if (!text) return;
    const payload: ChatPayload = {
      type: "chat",
      id: crypto.randomUUID(),
      text,
      sentAt: Date.now(),
    };
    const sent = sendPayload(payload, true);
    const msg: ChatTextMessage = {
      kind: "text",
      id: payload.id,
      text,
      sentAt: payload.sentAt,
      from: "local",
      status: sent ? "sent" : "queued",
      reactions: [],
    };
    setMessages((prev) => [...prev, msg]);
  };

  const sendCallReaction = (emoji: string) => {
    sendPayload({ type: "call-reaction", emoji }, false);
    pushCallReaction(emoji, "local");
  };

  const toggleMessageReaction = (messageId: string, emoji: string) => {
    sendPayload({ type: "message-reaction", messageId, emoji }, false);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactions: toggleReaction(m.reactions, emoji, "local") }
          : m,
      ),
    );
  };

  const waitForBuffer = (channel: RTCDataChannel) =>
    new Promise<void>((resolve) => {
      if (channel.bufferedAmount <= LOW_WATER) {
        resolve();
        return;
      }
      const onLow = () => {
        channel.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", onLow);
    });

  const sendFile = async (file: File) => {
    if (file.size > FILE_MAX_BYTES) {
      setCollabError(`Files must be under ${FILE_MAX_BYTES / 1024 / 1024} MB`);
      return;
    }
    const channel = filesRef.current;
    if (!channel || channel.readyState !== "open") {
      setCollabError("File transfer unavailable — video is still connected");
      return;
    }

    const id = crypto.randomUUID();
    const meta: ChatPayload = {
      type: "file-meta",
      id,
      name: file.name,
      size: file.size,
      mime: file.type,
    };

    const localMsg: ChatFileMessage = {
      kind: "file",
      id,
      name: file.name,
      size: file.size,
      mime: file.type,
      sentAt: Date.now(),
      from: "local",
      status: "sent",
      progress: 0,
      url: URL.createObjectURL(file),
      reactions: [],
    };
    setMessages((prev) => [...prev, localMsg]);

    try {
      channel.send(JSON.stringify(meta));
      let offset = 0;
      while (offset < file.size) {
        if (channel.readyState !== "open") {
          throw new Error("channel closed");
        }
        if (channel.bufferedAmount > HIGH_WATER) {
          await waitForBuffer(channel);
        }
        const slice = file.slice(offset, offset + FILE_CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        channel.send(buffer);
        offset += buffer.byteLength;
        const progress = Math.min(1, offset / file.size);
        setMessages((prev) =>
          prev.map((m) => (m.id === id && m.kind === "file" ? { ...m, progress } : m)),
        );
      }
      channel.send(JSON.stringify({ type: "file-end", id } satisfies ChatPayload));
    } catch (error) {
      log("File send failed", error);
      setCollabError("File transfer failed — video is still connected");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id && m.kind === "file" ? { ...m, status: "failed" } : m,
        ),
      );
    }
  };

  const openPanel = () => {
    setPanelOpen(true);
    setUnread(0);
  };

  const closePanel = () => setPanelOpen(false);

  return {
    chatReady,
    messages,
    unread,
    panelOpen,
    callReactions,
    collabError,
    sendChat,
    sendCallReaction,
    toggleMessageReaction,
    sendFile,
    openPanel,
    closePanel,
    clearCollabError: () => setCollabError(null),
    resetCollab,
  };
}
