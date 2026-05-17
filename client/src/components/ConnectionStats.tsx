// src/components/ConnectionStats.tsx
import { useEffect, useRef } from "react";
import { Activity, X } from "lucide-react";
import { cn } from "../utils/classname";
import type { ConnectionStatus } from "../types";
import { formatBytes } from "../utils/helper";
import TopBarButton from "./TopBarButton";

interface ConnectionStatsProps {
  stats: ConnectionStatus;
  showStats: boolean;
  onToggle: (show: boolean) => void;
  callDuration: string;
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
  callDuration,
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
    if (stats.candidateType === "STUN") return "#458cff";
    if (stats.candidateType === "TURN") return "#f59e0b";
    return "#6b7280";
  };

  return (
    <>
      {!showStats ? (
        <TopBarButton
          onClick={() => onToggle(true)}
          Icon={Activity}
          iconColor={getConnectionColor()}
          text={`${stats.ping}ms`}
          textColor={getPingColor(stats.ping)}
        />
      ) : (
        <div ref={ref} className="absolute">
          <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-2 w-80 shadow-2xl animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3">
              <span className="text-white px-2 font-medium text-sm flex items-center gap-2">
                <Activity size={16} /> Connection Info
                <span className="mx-1">•</span>
                <span className="text-white/60 text-xs">{callDuration}</span>
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
                label="Latency"
                value={`${stats.ping}ms`}
                color={getPingColor(stats.ping)}
              />
              <StatItem label="Protocol" value={stats.protocol} />
              <StatItem label="Packet Loss" value={`${stats.packetLoss}%`} />
              <StatItem
                label="Send Bitrate"
                value={`${formatBytes(stats.bitrateSent)}/s`}
              />
              <StatItem
                label="Receive Bitrate"
                value={`${formatBytes(stats.bitrateReceived)}/s`}
              />
              <StatItem
                label="Sent"
                value={formatBytes(stats.totalBytesSent)}
              />
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
        </div>
      )}
    </>
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
