// src/components/ConnectionStats.tsx
import { useEffect, useRef } from "react";
import { Activity, X } from "lucide-react";
import { cn } from "../utils/classname";
import type { ConnectionStatus } from "../types";
import { formatBytes } from "../utils/helper";

interface ConnectionStatsProps {
  stats: ConnectionStatus;
  showStats: boolean;
  onToggle: (show: boolean) => void;
}

const getPingColor = (ping: number) => {
  if (ping < 80) return "#10b981";
  if (ping < 140) return "#84cc16";
  if (ping < 200) return "#f59e0b";
  return "#ef4444";
};

export function ConnectionStats({
  stats,
  showStats,
  onToggle,
}: ConnectionStatsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showStats) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStats, onToggle]);

  const getConnectionColor = () => {
    if (stats.candidateType === "P2P") return "#10b981";
    if (stats.candidateType === "STUN") return "#3b82f6";
    if (stats.candidateType === "TURN") return "#f59e0b";
    return "#6b7280";
  };

  const getProtocolColor = () => {
    if (stats.protocol === "UDP") return "#6f9eff";
    if (stats.protocol === "TCP") return "#a1ae5f";
    return "#6b7280";
  };

  return (
    <div ref={ref} className="absolute top-5 left-5 z-30">
      {!showStats ? (
        <button
          onClick={() => onToggle(true)}
          className="animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2 px-3 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-white/10"
          title="Show connection details"
        >
          <span style={{ color: getConnectionColor() }}>
            <Activity size={20} />
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: getPingColor(stats.ping) }}
          >
            {stats.ping}ms
          </span>
        </button>
      ) : (
        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-2 w-80 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3">
            <span className="text-white px-2 font-medium text-sm flex items-center gap-2">
              <Activity size={16} /> Connection Info
            </span>
            <button
              onClick={() => onToggle(false)}
              className="text-white/60 p-2 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 p-2 pt-0 gap-2">
            <StatItem
              label="Status"
              value={stats.candidateType}
              color={getConnectionColor()}
            />
            <StatItem
              label="Protocol"
              value={stats.protocol}
              color={getProtocolColor()}
            />
            <StatItem
              label="Latency"
              value={`${stats.ping}ms`}
              color={getPingColor(stats.ping)}
            />
            <StatItem label="Packet Loss" value={`${stats.packetLoss}%`} />
            <StatItem
              label="Send Bitrate"
              value={`${formatBytes(stats.bitrateSent)}/s`}
            />
            <StatItem
              label="Receive Bitrate"
              value={`${formatBytes(stats.bitrateReceived)}/s`}
            />
            <StatItem label="Sent" value={formatBytes(stats.totalBytesSent)} />
            <StatItem
              label="Received"
              value={formatBytes(stats.totalBytesReceived)}
            />
            <StatItem
              label="Local"
              value={stats.localAddress}
              valueClassName="text-xs py-0.5"
            />
            <StatItem
              label="Remote"
              value={stats.remoteAddress}
              valueClassName="text-xs py-0.5"
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
  valueClassName,
}: {
  label: string;
  value: string;
  color?: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("bg-white/5 rounded-lg px-3 py-2", className)}>
      <div className="text-[10px] text-white/50 uppercase tracking-wider font-medium">
        {label}
      </div>
      <div
        className={cn("text-sm font-semibold", valueClassName)}
        style={{ color: color || "white" }}
      >
        {value}
      </div>
    </div>
  );
}
