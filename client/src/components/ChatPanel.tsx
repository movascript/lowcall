import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Send,
  X,
  Download,
  MessageCircle,
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
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  if (!open) return null;

  const submit = () => {
    onSend(draft);
    setDraft("");
  };

  return (
    <aside
      className="absolute inset-y-0 right-0 z-40 w-full sm:w-96 flex flex-col bg-black/85 backdrop-blur-xl border-l border-white/10 animate-in slide-in-from-right-10"
      aria-label="Chat"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <MessageCircle size={18} />
          <h2 className="font-semibold">Chat</h2>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          onClick={onClose}
          className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-white/50 mt-8">
            Messages stay on this call. Nothing is stored on the server.
          </p>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            reacting={reactingTo === msg.id}
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
        className="p-3 border-t border-white/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onSendFile(file);
        }}
      >
        {!ready && (
          <p className="text-xs text-amber-300 mb-2">
            Chat unavailable — video is still connected
          </p>
        )}
        <div className="flex items-end gap-2">
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
            className="shrink-0 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center disabled:opacity-40"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            value={draft}
            disabled={!ready}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={ready ? "Send a message" : "Chat unavailable"}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="flex-1 resize-none rounded-2xl bg-white/10 text-white px-3 py-2 text-sm outline-none placeholder:text-white/40 max-h-28"
          />
          <button
            type="button"
            aria-label="Send message"
            disabled={!ready || !draft.trim()}
            onClick={submit}
            className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ChatBubble({
  message,
  reacting,
  onToggleReact,
  onReact,
}: {
  message: ChatMessage;
  reacting: boolean;
  onToggleReact: () => void;
  onReact: (emoji: string) => void;
}) {
  const mine = message.from === "local";
  const time = new Date(message.sentAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex flex-col max-w-[85%]", mine ? "ml-auto items-end" : "mr-auto items-start")}>
      <button
        type="button"
        onClick={onToggleReact}
        className={cn(
          "text-left rounded-2xl px-3 py-2 text-sm text-white",
          mine ? "bg-primary/90 text-primary-foreground" : "bg-white/15",
        )}
      >
        {message.kind === "text" ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          <div className="min-w-40">
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
                className="mt-1 inline-flex items-center gap-1 text-xs underline"
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
                "text-xs px-1.5 py-0.5 rounded-full bg-white/10",
                r.local && "ring-1 ring-primary",
              )}
            >
              {r.emoji}
              {(Number(r.local) + Number(r.remote)) > 1 ? " 2" : ""}
            </button>
          ))}
        </div>
      )}
      {reacting && (
        <div className="flex gap-1 mt-1 px-1 py-1 rounded-full bg-black/80 border border-white/10">
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
