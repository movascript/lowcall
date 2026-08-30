import type { CallReaction } from "../types";

export function ReactionOverlay({ reactions }: { reactions: CallReaction[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-reaction overflow-hidden">
      {reactions.map((reaction, i) => (
        <span
          key={reaction.id}
          className="absolute text-4xl sm:text-5xl reaction-rise drop-shadow-lg"
          style={{
            left: `${18 + ((i * 17) % 64)}%`,
            bottom: "5.5rem",
          }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}
