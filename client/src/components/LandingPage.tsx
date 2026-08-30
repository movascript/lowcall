import { ArrowRight, Plus, Link2 } from "lucide-react";
import { cn } from "../utils/classname";

interface LandingPageProps {
  roomId: string;
  setRoomId: (id: string) => void;
  onJoin: () => void;
  onCreate: () => void;
}

const LandingPage = ({
  roomId,
  setRoomId,
  onJoin,
  onCreate,
}: LandingPageProps) => {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="bg-card animate-in fade-in-50 slide-in-from-bottom-5 rounded-4xl p-6 shadow-2xl max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="flex items-center gap-4 justify-center p-1 my-2">
            <img
              className="w-10 h-10 text-white"
              src="/favicon.svg"
              alt=""
              fetchPriority="high"
            />
            <h1 className="text-3xl font-bold text-primary">Lowcall</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Simple, fast, secure video calls
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Enter room code"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onJoin()}
            className="w-full px-4 py-3.5 text-base border-2 border-border rounded-xl outline-none transition-all focus:border-primary"
            autoFocus
            aria-label="Room code"
          />
          <button
            type="button"
            onClick={onJoin}
            disabled={!roomId.trim()}
            className={cn(
              "flex justify-center items-center gap-1 w-full py-3.5 text-base font-semibold text-primary-foreground bg-linear-to-r from-primary to-accent border-none rounded-xl cursor-pointer transition-all",
              roomId.trim()
                ? "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                : "opacity-50 cursor-not-allowed",
            )}
          >
            Join Room
            <ArrowRight className="size-5" />
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="flex justify-center items-center gap-2 w-full py-3 text-sm font-medium text-foreground bg-secondary rounded-xl hover:bg-muted transition-colors"
          >
            <Plus className="size-4" />
            Create a room
          </button>
          <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
            <Link2 className="size-3" />
            Share the link after you join
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
