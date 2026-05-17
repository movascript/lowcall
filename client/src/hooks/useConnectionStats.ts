// src/hooks/useConnectionStats.ts
import { useEffect, useRef, useState } from "react";
import type {
  ConnectionStatus,
  VideoStats,
  AudioStats,
  CodecStats,
  QualityStats,
  BandwidthStats,
  EnhancedConnectionStats,
} from "../types";

const initialConnectionStats: ConnectionStatus = {
  ping: 0,
  bitrateReceived: 0,
  bitrateSent: 0,
  packetLoss: 0,
  protocol: "N/A",
  candidateType: "N/A",
  networkType: "N/A",
  localAddress: "N/A",
  remoteAddress: "N/A",
  totalBytesReceived: 0,
  totalBytesSent: 0,
};

const initialVideoStats: VideoStats = {
  local: {
    framesPerSecond: 0,
    frameWidth: 0,
    frameHeight: 0,
    framesDropped: 0,
  },
  remote: {
    framesPerSecond: 0,
    frameWidth: 0,
    frameHeight: 0,
    framesDropped: 0,
    freezeCount: 0,
    totalFreezesDuration: 0,
    pauseCount: 0,
    totalPausesDuration: 0,
  },
};

const initialAudioStats: AudioStats = {
  local: { audioLevel: 0 },
  remote: { audioLevel: 0 },
};

const initialCodecStats: CodecStats = {
  videoCodec: "N/A",
  audioCodec: "N/A",
};

const initialQualityStats: QualityStats = {
  jitter: 0,
  packetsRetransmitted: 0,
  retransmissionRate: 0,
  nackCount: 0,
  pliCount: 0,
  firCount: 0,
  qualityLimitationReason: "none",
  qualityLimitationDurations: {},
};

const initialBandwidthStats: BandwidthStats = {
  availableOutgoingBitrate: 0,
  availableIncomingBitrate: 0,
};

export const useConnectionStats = (
  peerConnection: RTCPeerConnection | null,
  isConnected: boolean,
) => {
  const [stats, setStats] = useState<EnhancedConnectionStats>({
    connection: initialConnectionStats,
    video: initialVideoStats,
    audio: initialAudioStats,
    codecs: initialCodecStats,
    quality: initialQualityStats,
    bandwidth: initialBandwidthStats,
    callDuration: "0:00",
  });

  const callStartTimeRef = useRef<number | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const prevBytesReceivedRef = useRef(0);
  const prevBytesSentRef = useRef(0);
  const prevTimeRef = useRef(Date.now());
  const prevPacketsSentRef = useRef(0);
  const prevRetransmittedRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const formatCallDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const extractConnectionStats = (
    statsReport: RTCStatsReport,
  ): {
    connection: ConnectionStatus;
    localCandidateId: string;
    remoteCandidateId: string;
  } => {
    let bytesReceived = 0,
      bytesSent = 0,
      totalPacketsLost = 0,
      totalPacketsReceived = 0,
      rtt = 0,
      protocol = "N/A",
      candidateType = "N/A",
      networkType = "N/A",
      localAddress = "N/A",
      remoteAddress = "N/A",
      localCandidateId = "",
      remoteCandidateId = "";

    // Aggregate all inbound/outbound streams
    statsReport.forEach((report) => {
      if (report.type === "inbound-rtp") {
        if (report.bytesReceived) bytesReceived += report.bytesReceived;
        if (report.packetsLost) totalPacketsLost += report.packetsLost;
        if (report.packetsReceived)
          totalPacketsReceived += report.packetsReceived;
      }
      if (report.type === "outbound-rtp") {
        if (report.bytesSent) bytesSent += report.bytesSent;
      }
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        rtt = report.currentRoundTripTime
          ? Math.round(report.currentRoundTripTime * 1000)
          : 0;
        localCandidateId = report.localCandidateId;
        remoteCandidateId = report.remoteCandidateId;
      }
    });

    // Calculate overall packet loss percentage
    const packetLoss =
      totalPacketsReceived > 0
        ? Math.round(
            (totalPacketsLost / (totalPacketsLost + totalPacketsReceived)) *
              100,
          )
        : 0;

    statsReport.forEach((report) => {
      if (report.type === "local-candidate" && report.id === localCandidateId) {
        protocol = report.protocol?.toUpperCase() || "N/A";
        candidateType = report.candidateType || "N/A";
        networkType = report.networkType || "N/A";
        localAddress = report.address
          ? `${report.address}:${report.port}`
          : "N/A";
      }
      if (
        report.type === "remote-candidate" &&
        report.id === remoteCandidateId
      ) {
        remoteAddress = report.address
          ? `${report.address}:${report.port}`
          : "N/A";
      }
    });

    const now = Date.now();
    const dt = (now - prevTimeRef.current) / 1000;

    // Calculate bytes per second (not bits per second)
    const bitrateReceived =
      dt > 0
        ? Math.round((bytesReceived - prevBytesReceivedRef.current) / dt)
        : 0;

    const bitrateSent =
      dt > 0 ? Math.round((bytesSent - prevBytesSentRef.current) / dt) : 0;

    prevBytesReceivedRef.current = bytesReceived;
    prevBytesSentRef.current = bytesSent;
    prevTimeRef.current = now;

    const connectionMethod =
      candidateType === "relay"
        ? "TURN"
        : candidateType === "srflx"
          ? "STUN"
          : candidateType === "host"
            ? "P2P"
            : candidateType.toUpperCase();

    return {
      connection: {
        ping: rtt,
        bitrateReceived,
        bitrateSent,
        packetLoss,
        protocol,
        candidateType: connectionMethod,
        networkType,
        localAddress,
        remoteAddress,
        totalBytesReceived: bytesReceived,
        totalBytesSent: bytesSent,
      },
      localCandidateId,
      remoteCandidateId,
    };
  };

  const extractVideoStats = (statsReport: RTCStatsReport): VideoStats => {
    const video: VideoStats = {
      local: {
        framesPerSecond: 0,
        frameWidth: 0,
        frameHeight: 0,
        framesDropped: 0,
      },
      remote: {
        framesPerSecond: 0,
        frameWidth: 0,
        frameHeight: 0,
        framesDropped: 0,
        freezeCount: 0,
        totalFreezesDuration: 0,
        pauseCount: 0,
        totalPausesDuration: 0,
      },
    };

    statsReport.forEach((report) => {
      if (report.type === "outbound-rtp" && report.kind === "video") {
        video.local.framesPerSecond = report.framesPerSecond || 0;
        video.local.frameWidth = report.frameWidth || 0;
        video.local.frameHeight = report.frameHeight || 0;
      }
      // Get local frames dropped from media-source
      if (report.type === "media-source" && report.kind === "video") {
        video.local.framesDropped = report.framesDropped || 0;
      }
      if (report.type === "inbound-rtp" && report.kind === "video") {
        video.remote.framesPerSecond = report.framesPerSecond || 0;
        video.remote.frameWidth = report.frameWidth || 0;
        video.remote.frameHeight = report.frameHeight || 0;
        video.remote.framesDropped = report.framesDropped || 0;
        video.remote.freezeCount = report.freezeCount || 0;
        video.remote.totalFreezesDuration = report.totalFreezesDuration || 0;
        video.remote.pauseCount = report.pauseCount || 0;
        video.remote.totalPausesDuration = report.totalPausesDuration || 0;
      }
    });

    return video;
  };

  const extractAudioStats = (statsReport: RTCStatsReport): AudioStats => {
    const audio: AudioStats = {
      local: { audioLevel: 0 },
      remote: { audioLevel: 0 },
    };

    statsReport.forEach((report) => {
      // Local audio level from media-source
      if (report.type === "media-source" && report.kind === "audio") {
        audio.local.audioLevel = report.audioLevel || 0;
      }
      // Remote audio level from track (receiver side)
      if (
        report.type === "track" &&
        report.kind === "audio" &&
        report.remoteSource === true
      ) {
        audio.remote.audioLevel = report.audioLevel || 0;
      }
    });

    return audio;
  };

  const extractCodecStats = (statsReport: RTCStatsReport): CodecStats => {
    const codecs: CodecStats = {
      videoCodec: "N/A",
      audioCodec: "N/A",
    };

    const codecMap = new Map<string, string>();

    // Build codec map
    statsReport.forEach((report) => {
      if (report.type === "codec") {
        codecMap.set(report.id, report.mimeType || "N/A");
      }
    });

    // Check both inbound and outbound RTP for codecs
    // Inbound = what we're receiving, Outbound = what we're sending
    // They can be different if negotiated differently
    statsReport.forEach((report) => {
      if (
        report.type === "inbound-rtp" &&
        report.codecId &&
        codecMap.has(report.codecId)
      ) {
        const mimeType = codecMap.get(report.codecId)!;
        if (report.kind === "video" && codecs.videoCodec === "N/A") {
          codecs.videoCodec = mimeType.replace("video/", "");
        } else if (report.kind === "audio" && codecs.audioCodec === "N/A") {
          codecs.audioCodec = mimeType.replace("audio/", "");
        }
      }
      // Fallback to outbound if inbound not found
      if (
        report.type === "outbound-rtp" &&
        report.codecId &&
        codecMap.has(report.codecId)
      ) {
        const mimeType = codecMap.get(report.codecId)!;
        if (report.kind === "video" && codecs.videoCodec === "N/A") {
          codecs.videoCodec = mimeType.replace("video/", "");
        } else if (report.kind === "audio" && codecs.audioCodec === "N/A") {
          codecs.audioCodec = mimeType.replace("audio/", "");
        }
      }
    });

    return codecs;
  };

  const extractQualityStats = (statsReport: RTCStatsReport): QualityStats => {
    const quality: QualityStats = {
      jitter: 0,
      packetsRetransmitted: 0,
      retransmissionRate: 0,
      nackCount: 0,
      pliCount: 0,
      firCount: 0,
      qualityLimitationReason: "none",
      qualityLimitationDurations: {},
    };

    let currentPacketsSent = 0;
    let currentRetransmitted = 0;
    let totalJitter = 0;
    let jitterCount = 0;

    statsReport.forEach((report) => {
      if (report.type === "inbound-rtp") {
        // Aggregate jitter from all inbound streams
        if (report.jitter) {
          totalJitter += report.jitter;
          jitterCount++;
        }
        quality.nackCount += report.nackCount || 0;
        quality.pliCount += report.pliCount || 0;
        quality.firCount += report.firCount || 0;
      }
      if (report.type === "outbound-rtp") {
        currentPacketsSent += report.packetsSent || 0;
        currentRetransmitted += report.retransmittedPacketsSent || 0;

        // Quality limitation is typically per-stream, take the worst case
        if (
          report.qualityLimitationReason &&
          report.qualityLimitationReason !== "none"
        ) {
          quality.qualityLimitationReason = report.qualityLimitationReason;
        }
        if (report.qualityLimitationDurations) {
          // Merge durations from all outbound streams
          Object.entries(report.qualityLimitationDurations).forEach(
            ([key, value]) => {
              quality.qualityLimitationDurations[key] =
                (quality.qualityLimitationDurations[key] || 0) +
                (value as number);
            },
          );
        }
      }
    });

    // Average jitter across all streams
    quality.jitter =
      jitterCount > 0 ? Math.round((totalJitter / jitterCount) * 1000) : 0;
    quality.packetsRetransmitted = currentRetransmitted;

    const packetsSentDelta = currentPacketsSent - prevPacketsSentRef.current;
    const retransmittedDelta =
      currentRetransmitted - prevRetransmittedRef.current;

    if (packetsSentDelta > 0) {
      quality.retransmissionRate = Math.round(
        (retransmittedDelta / packetsSentDelta) * 100,
      );
    }

    prevPacketsSentRef.current = currentPacketsSent;
    prevRetransmittedRef.current = currentRetransmitted;

    return quality;
  };

  const extractBandwidthStats = (
    statsReport: RTCStatsReport,
  ): BandwidthStats => {
    const bandwidth: BandwidthStats = {
      availableOutgoingBitrate: 0,
      availableIncomingBitrate: 0,
    };

    statsReport.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        // Convert from bits per second to bytes per second
        bandwidth.availableOutgoingBitrate = report.availableOutgoingBitrate
          ? Math.round(report.availableOutgoingBitrate / 8)
          : 0;
        bandwidth.availableIncomingBitrate = report.availableIncomingBitrate
          ? Math.round(report.availableIncomingBitrate / 8)
          : 0;
      }
    });

    return bandwidth;
  };

  function startStatsMonitoring() {
    stopStatsMonitoring();
    prevBytesReceivedRef.current = 0;
    prevBytesSentRef.current = 0;
    prevPacketsSentRef.current = 0;
    prevRetransmittedRef.current = 0;
    prevTimeRef.current = Date.now();
    callStartTimeRef.current = Date.now();

    statsIntervalRef.current = setInterval(async () => {
      if (!peerConnection || !callStartTimeRef.current) return;

      try {
        const statsReport = await peerConnection.getStats();

        const { connection } = extractConnectionStats(statsReport);
        const video = extractVideoStats(statsReport);
        const audio = extractAudioStats(statsReport);
        const codecs = extractCodecStats(statsReport);
        const quality = extractQualityStats(statsReport);
        const bandwidth = extractBandwidthStats(statsReport);

        const callSeconds = Math.floor(
          (Date.now() - callStartTimeRef.current) / 1000,
        );

        if (mountedRef.current) {
          setStats({
            connection,
            video,
            audio,
            codecs,
            quality,
            bandwidth,
            callDuration: formatCallDuration(callSeconds),
          });
        }
      } catch (err) {
        console.error("Stats error:", err);
      }
    }, 1000) as unknown as number;
  }

  function stopStatsMonitoring() {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
  }

  useEffect(() => {
    if (isConnected && peerConnection) {
      startStatsMonitoring();
    } else {
      stopStatsMonitoring();
      if (mountedRef.current) {
        setStats({
          connection: initialConnectionStats,
          video: initialVideoStats,
          audio: initialAudioStats,
          codecs: initialCodecStats,
          quality: initialQualityStats,
          bandwidth: initialBandwidthStats,
          callDuration: "0:00",
        });
      }
    }

    return () => {
      stopStatsMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, peerConnection]);

  const resetStats = () => {
    if (mountedRef.current) {
      setStats({
        connection: initialConnectionStats,
        video: initialVideoStats,
        audio: initialAudioStats,
        codecs: initialCodecStats,
        quality: initialQualityStats,
        bandwidth: initialBandwidthStats,
        callDuration: "0:00",
      });
    }
    callStartTimeRef.current = null;
  };

  return { stats, resetStats };
};
