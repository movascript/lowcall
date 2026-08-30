import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Send,
  X,
  Download,
  MessageCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { ChatMessage } from "../types";
import { REACTION_EMOJIS, CHAT_MAX_LENGTH } from "../utils/constants";
import { cn } from "../utils/classname";
import { formatBytes } from "../utils/helper";

interface ChatPanelProps {
  open: boolean;
  ready: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onSend: (text: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onSendFile: (file: File) => void;
}

export function ChatPanel({
  open,
  ready,
  messages,
  onClose,
  onSend,
  onReact,
  onSendFile,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, expanded]);

  if (!open) return null;

  const submit = () => {
    onSend(draft);
    setDraft("");
  };

  const visible = expanded ? messages : messages.slice(-8);
  const hud = !expanded;

  return (
    <aside
      className={cn(
        "z-modal flex flex-col pointer-events-auto min-w-0 overflow-x-hidden",
        expanded
          ? "absolute inset-0 bg-black/75 backdrop-blur-xl"
          : "absolute inset-x-0 bottom-0 h-[33%] bg-black/55 backdrop-blur-xl border-t border-white/10 sm:inset-auto sm:right-4 sm:bottom-4 sm:h-auto sm:w-80 sm:max-h-[46%] sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:pointer-events-none",
      )}
      aria-label="Chat"
    >
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 sm:pointer-events-auto",
          hud &&
            "sm:px-0 sm:pb-2 sm:bg-transparent",
        )}
      >
        <div className="flex items-center gap-2 text-white">
          <MessageCircle size={16} />
          <h2 className="font-semibold text-sm">Chat</h2>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={expanded ? "Minimize chat" : "Expand chat"}
            onClick={() => setExpanded((v) => !v)}
            className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => {
              setExpanded(false);
              onClose();
            }}
            className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-2 min-w-0 sm:pointer-events-auto",
          hud && "sm:px-0 sm:flex sm:flex-col sm:justify-end",
        )}
      >
        {messages.length === 0 && (
          <p className="text-center text-xs text-white/50 py-4">
            Messages stay on this call.
          </p>
        )}
        {visible.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            reacting={reactingTo === msg.id}
            glass={hud}
            onToggleReact={() =>
              setReactingTo((id) => (id === msg.id ? null : msg.id))
            }
            onReact={(emoji) => {
              onReact(msg.id, emoji);
              setReactingTo(null);
            }}
          />
        ))}
      </div>

      <div
        className={cn(
          "p-3 pt-2 sm:pointer-events-auto",
          hud && "sm:p-0 sm:pt-2",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onSendFile(file);
        }}
      >
        {!ready && (
          <p className="text-[11px] text-amber-300 mb-1.5">
            Chat unavailable — video is still connected
          </p>
        )}
        <div
          className={cn(
            "flex items-end gap-1.5",
            hud &&
              "sm:bg-black/50 sm:backdrop-blur-md sm:rounded-2xl sm:p-1.5 sm:border sm:border-white/10",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSendFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label="Attach file"
            disabled={!ready}
            onClick={() => fileRef.current?.click()}
            className="shrink-0 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center disabled:opacity-40"
          >
            <Paperclip size={16} />
          </button>
          <textarea
            value={draft}
            disabled={!ready}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={ready ? "Message" : "Chat unavailable"}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="flex-1 min-w-0 resize-none rounded-2xl bg-white/10 sm:bg-transparent text-white px-3 py-2 text-sm outline-none placeholder:text-white/40 max-h-24"
          />
          <button
            type="button"
            aria-label="Send message"
            disabled={!ready || !draft.trim()}
            onClick={submit}
            className="shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ChatBubble({
  message,
  reacting,
  glass,
  onToggleReact,
  onReact,
}: {
  message: ChatMessage;
  reacting: boolean;
  glass: boolean;
  onToggleReact: () => void;
  onReact: (emoji: string) => void;
}) {
  const mine = message.from === "local";
  const time = new Date(message.sentAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex flex-col min-w-0 max-w-[90%]",
        message.kind === "file" && "w-[90%]",
        mine ? "ml-auto items-end" : "mr-auto items-start",
      )}
    >
      <button
        type="button"
        onClick={onToggleReact}
        className={cn(
          "text-left rounded-2xl px-3 py-2 text-sm text-white min-w-0 overflow-hidden",
          message.kind === "file" ? "w-full" : "w-max max-w-full",
          glass
            ? mine
              ? "bg-primary/70 backdrop-blur-md border border-white/10 text-primary-foreground"
              : "bg-white/15 backdrop-blur-md border border-white/10"
            : mine
              ? "bg-primary/90 text-primary-foreground"
              : "bg-white/15",
        )}
      >
        {message.kind === "text" ? (
            <p className="whitespace-pre-wrap wrap-anywhere">{message.text}</p>
        ) : (
          <div className="min-w-0 w-full max-w-full overflow-hidden">
            <p className="font-medium truncate">{message.name}</p>
            <p className="text-xs opacity-80">
              {formatBytes(message.size)}
              {message.progress < 1
                ? ` · ${Math.round(message.progress * 100)}%`
                : ""}
            </p>
            {message.progress < 1 && (
              <div className="mt-1 h-1 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-white/80"
                  style={{ width: `${message.progress * 100}%` }}
                />
              </div>
            )}
            {message.url && message.progress >= 1 && (
              <a
                href={message.url}
                download={message.name}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 inline-flex items-center gap-1 text-xs underline max-w-full min-w-0"
              >
                <Download size={12} /> Save
              </a>
            )}
          </div>
        )}
        <span className="block text-[10px] opacity-70 mt-1">
          {time}
          {message.status === "queued" ? " · sending" : ""}
          {message.status === "failed" ? " · failed" : ""}
        </span>
      </button>
      {message.reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onReact(r.emoji)}
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md",
                r.local && "ring-1 ring-primary",
              )}
            >
              {r.emoji}
              {Number(r.local) + Number(r.remote) > 1 ? " 2" : ""}
            </button>
          ))}
        </div>
      )}
      {reacting && (
        <div className="z-tooltip flex gap-1 mt-1 px-1 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/10">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              onClick={() => onReact(emoji)}
              className="text-base hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
