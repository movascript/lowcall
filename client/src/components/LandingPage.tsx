import { cn } from "../utils/classname";

interface LandingPageProps {
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  handleJoinRoom: () => void;
}

const LandingPage = ({
  roomId,
  setRoomId,
  handleJoinRoom,
}: LandingPageProps) => {
  return (
    <div className="flex items-center justify-center h-full p-5">
      <div className="bg-card animate-in fade-in-50 slide-in-from-bottom-5 rounded-3xl p-10 shadow-2xl max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 border rounded-2xl mb-4">
            <img className="w-10 h-10 text-white" src="favicon.svg" />
          </div>
          <h1 className="text-3xl font-bold text-card-foreground mb-2">
            lowcall
          </h1>
          <p className="text-sm text-muted-foreground">
            Simple, fast video calls
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Enter room code"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            className="w-full px-4 py-3.5 text-base border-2 border-border rounded-xl outline-none transition-all focus:border-primary focus:shadow-[0_0_0_4px_rgba(102,126,234,0.1)]"
            autoFocus
          />
          <button
            onClick={handleJoinRoom}
            disabled={!roomId.trim()}
            className={cn(
              "w-full py-3.5 text-base font-semibold text-primary-foreground bg-linear-to-r from-primary to-accent border-none rounded-xl cursor-pointer transition-all",
              roomId.trim()
                ? "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                : "opacity-50 cursor-not-allowed",
            )}
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
