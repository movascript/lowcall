// src/components/ConnectionStats.tsx
import { useEffect, useRef, useState } from "react";
import { Activity, X, Bug } from "lucide-react";
import { cn } from "../utils/classname";
import type { EnhancedConnectionStats } from "../types";
import { formatBytes } from "../utils/helper";
import TopBarButton from "./TopBarButton";

interface ConnectionStatsProps {
  stats: EnhancedConnectionStats;
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
  const [debugMode, setDebugMode] = useState(false);

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
    if (stats.connection.candidateType === "P2P") return "#10b981";
    if (stats.connection.candidateType === "STUN") return "#458cff";
    if (stats.connection.candidateType === "TURN") return "#f59e0b";
    return "#6b7280";
  };

  const getQualityLimitationColor = (reason: string) => {
    if (reason === "none") return "#10b981";
    if (reason === "cpu") return "#f59e0b";
    if (reason === "bandwidth") return "#ef4444";
    return "#6b7280";
  };

  return (
    <>
      {!showStats ? (
        <TopBarButton
          onClick={() => onToggle(true)}
          Icon={Activity}
          iconColor={getConnectionColor()}
          text={`${stats.connection.ping}ms`}
          textColor={getPingColor(stats.connection.ping)}
        />
      ) : (
        <div
          ref={ref}
          className="absolute z-30 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-2 w-full sm:w-80 shadow-2xl animate-in fade-in slide-in-from-top-4"
        >
          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3">
            <span className="text-white px-2 font-medium text-sm flex items-center gap-2">
              <Activity size={16} /> Connection Info
              <span className="mx-1">•</span>
              <span className="text-white/60 text-xs">
                {stats.callDuration}
              </span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={cn(
                  "p-2 transition-colors",
                  debugMode
                    ? "text-blue-400 hover:text-blue-300"
                    : "text-white/60 hover:text-white",
                )}
                title="Toggle debug view"
              >
                <Bug size={18} />
              </button>
              <button
                onClick={() => onToggle(false)}
                className="text-white/60 p-2 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!debugMode ? (
            <div className="grid grid-cols-2 p-2 pt-0 gap-2">
              <StatItem
                label="Status"
                value={stats.connection.candidateType}
                color={getConnectionColor()}
              />
              <StatItem
                label="Latency"
                value={`${stats.connection.ping}ms`}
                color={getPingColor(stats.connection.ping)}
              />
              <StatItem label="Protocol" value={stats.connection.protocol} />
              <StatItem
                label="Packet Loss"
                value={`${stats.connection.packetLoss}%`}
              />
              <StatItem
                label="Send Bitrate"
                value={`${formatBytes(stats.connection.bitrateSent)}/s`}
              />
              <StatItem
                label="Receive Bitrate"
                value={`${formatBytes(stats.connection.bitrateReceived)}/s`}
              />
              <StatItem
                label="Sent"
                value={formatBytes(stats.connection.totalBytesSent)}
              />
              <StatItem
                label="Received"
                value={formatBytes(stats.connection.totalBytesReceived)}
              />
              <StatItem
                label="Local"
                value={stats.connection.localAddress}
                valueClassName="text-xs py-0.5"
              />
              <StatItem
                label="Remote"
                value={stats.connection.remoteAddress}
                valueClassName="text-xs py-0.5"
              />
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 p-2 pt-0 gap-2">
                <StatItem
                  label="Status"
                  value={stats.connection.candidateType}
                  color={getConnectionColor()}
                />
                <StatItem
                  label="Latency"
                  value={`${stats.connection.ping}ms`}
                  color={getPingColor(stats.connection.ping)}
                />
                <StatItem label="Protocol" value={stats.connection.protocol} />
                <StatItem
                  label="Packet Loss"
                  value={`${stats.connection.packetLoss}%`}
                />
                <StatItem
                  label="Send Bitrate"
                  value={`${formatBytes(stats.connection.bitrateSent)}/s`}
                />
                <StatItem
                  label="Receive Bitrate"
                  value={`${formatBytes(stats.connection.bitrateReceived)}/s`}
                />
                <StatItem
                  label="Sent"
                  value={formatBytes(stats.connection.totalBytesSent)}
                />
                <StatItem
                  label="Received"
                  value={formatBytes(stats.connection.totalBytesReceived)}
                />
                <StatItem
                  label="Local"
                  value={stats.connection.localAddress}
                  valueClassName="text-xs py-0.5"
                />
                <StatItem
                  label="Remote"
                  value={stats.connection.remoteAddress}
                  valueClassName="text-xs py-0.5"
                />

                <div className="col-span-2 mt-2 mb-1">
                  <div className="text-xs text-white/70 font-semibold uppercase tracking-wider px-1">
                    Video (Local)
                  </div>
                </div>
                <StatItem
                  label="FPS"
                  value={`${Math.round(stats.video.local.framesPerSecond)}`}
                />
                <StatItem
                  label="Resolution"
                  value={`${stats.video.local.frameWidth}×${stats.video.local.frameHeight}`}
                  valueClassName="text-xs"
                />
                <StatItem
                  label="Dropped Frames"
                  value={`${stats.video.local.framesDropped}`}
                />
                <StatItem
                  label="Audio Level"
                  value={`${Math.round(stats.audio.local.audioLevel * 100)}%`}
                />

                <div className="col-span-2 mt-2 mb-1">
                  <div className="text-xs text-white/70 font-semibold uppercase tracking-wider px-1">
                    Video (Remote)
                  </div>
                </div>
                <StatItem
                  label="FPS"
                  value={`${Math.round(stats.video.remote.framesPerSecond)}`}
                />
                <StatItem
                  label="Resolution"
                  value={`${stats.video.remote.frameWidth}×${stats.video.remote.frameHeight}`}
                  valueClassName="text-xs"
                />
                <StatItem
                  label="Dropped Frames"
                  value={`${stats.video.remote.framesDropped}`}
                />
                <StatItem
                  label="Audio Level"
                  value={`${Math.round(stats.audio.remote.audioLevel * 100)}%`}
                />

                <div className="col-span-2 mt-2 mb-1">
                  <div className="text-xs text-white/70 font-semibold uppercase tracking-wider px-1">
                    Codecs
                  </div>
                </div>
                <StatItem label="Video Codec" value={stats.codecs.videoCodec} />
                <StatItem label="Audio Codec" value={stats.codecs.audioCodec} />

                <div className="col-span-2 mt-2 mb-1">
                  <div className="text-xs text-white/70 font-semibold uppercase tracking-wider px-1">
                    Quality Metrics
                  </div>
                </div>
                <StatItem label="Jitter" value={`${stats.quality.jitter}ms`} />
                <StatItem
                  label="Quality Limit"
                  value={stats.quality.qualityLimitationReason}
                  color={getQualityLimitationColor(
                    stats.quality.qualityLimitationReason,
                  )}
                  valueClassName="text-xs capitalize"
                />
                <StatItem
                  label="Retransmitted"
                  value={`${stats.quality.packetsRetransmitted}`}
                />
                <StatItem
                  label="Retrans. Rate"
                  value={`${stats.quality.retransmissionRate}%`}
                />
                <StatItem
                  label="NACK Count"
                  value={`${stats.quality.nackCount}`}
                />
                <StatItem
                  label="PLI Count"
                  value={`${stats.quality.pliCount}`}
                />
                <StatItem
                  label="FIR Count"
                  value={`${stats.quality.firCount}`}
                />

                <div className="col-span-2 mt-2 mb-1">
                  <div className="text-xs text-white/70 font-semibold uppercase tracking-wider px-1">
                    Bandwidth
                  </div>
                </div>
                <StatItem
                  label="Available Out"
                  value={`${formatBytes(stats.bandwidth.availableOutgoingBitrate)}/s`}
                  valueClassName="text-xs"
                />
                <StatItem
                  label="Available In"
                  value={`${formatBytes(stats.bandwidth.availableIncomingBitrate)}/s`}
                  valueClassName="text-xs"
                />

                <div className="col-span-2 mt-2 mb-1">
                  <div className="text-xs text-white/70 font-semibold uppercase tracking-wider px-1">
                    Stream Health
                  </div>
                </div>
                <StatItem
                  label="Freeze Count"
                  value={`${stats.video.remote.freezeCount}`}
                />
                <StatItem
                  label="Freeze Duration"
                  value={`${stats.video.remote.totalFreezesDuration.toFixed(2)}s`}
                  valueClassName="text-xs"
                />
                <StatItem
                  label="Pause Count"
                  value={`${stats.video.remote.pauseCount}`}
                />
                <StatItem
                  label="Pause Duration"
                  value={`${stats.video.remote.totalPausesDuration.toFixed(2)}s`}
                  valueClassName="text-xs"
                />
              </div>
            </div>
          )}
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
        className={cn("text-sm font-semibold break-all", valueClassName)}
        style={{ color: color || "white" }}
      >
        {value}
      </div>
    </div>
  );
}
