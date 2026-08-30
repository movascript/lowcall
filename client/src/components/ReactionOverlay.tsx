import type { CallReaction } from "../types";

export function ReactionOverlay({ reactions }: { reactions: CallReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      {reactions.map((reaction, i) => (
        <span
          key={reaction.id}
          className="absolute text-4xl sm:text-5xl animate-in fade-in slide-in-from-bottom-10 duration-700"
          style={{
            left: `${20 + ((i * 13) % 60)}%`,
            bottom: `${18 + ((i * 11) % 40)}%`,
          }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}
