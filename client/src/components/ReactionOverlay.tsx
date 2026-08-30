import { memo } from "react";
import type { CallReaction } from "../types";

export const ReactionOverlay = memo(function ReactionOverlay({
  reactions,
}: {
  reactions: CallReaction[];
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-reaction overflow-hidden">
      {reactions.map((reaction) => (
        <span
          key={reaction.id}
          className="absolute text-4xl sm:text-5xl reaction-rise"
          style={{
            left: `${reaction.x}%`,
            bottom: "5.5rem",
          }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
});
