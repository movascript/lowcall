// src/components/ConnectionStats.tsx
import { Activity, X } from "lucide-react";
import { cn } from "../utils/classname";

interface ConnectionStatsProps {
  stats: {
    candidateType: string;
    protocol: string;
    ping: number;
    bitrate: number;
    packetLoss: number;
  };
  showStats: boolean;
  onToggle: (show: boolean) => void;
}

export function ConnectionStats({
  stats,
  showStats,
  onToggle,
}: ConnectionStatsProps) {
  const getConnectionColor = () => {
    if (stats.candidateType === "P2P") return "#10b981";
    if (stats.candidateType === "STUN") return "#3b82f6";
    if (stats.candidateType === "TURN") return "#f59e0b";
    return "#6b7280";
  };

  return (
    <div className="absolute top-5 left-5 z-30">
      {!showStats ? (
        <button
          onClick={() => onToggle(true)}
          className="p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-white/10"
          title="Show connection details"
        >
          <Activity size={20} />
        </button>
      ) : (
        <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-4 w-80 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3">
            <span className="text-white font-medium text-sm flex items-center gap-2">
              <Activity size={16} /> Connection Info
            </span>
            <button
              onClick={() => onToggle(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatItem
              label="Status"
              value={stats.candidateType}
              color={getConnectionColor()}
            />
            <StatItem label="Protocol" value={stats.protocol} />
            <StatItem label="Latency" value={`${stats.ping}ms`} />
            <StatItem label="Bitrate" value={`${stats.bitrate} kbps`} />
            <StatItem
              label="Packet Loss"
              value={`${stats.packetLoss}%`}
              className="col-span-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
  className,
}: {
  label: string;
  value: string;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-white/5 rounded-lg px-3 py-2", className)}>
      <div className="text-[10px] text-white/50 uppercase tracking-wider font-medium">
        {label}
      </div>
      <div
        className="text-sm font-semibold"
        style={{ color: color || "white" }}
      >
        {value}
      </div>
    </div>
  );
}
