// src/types/stats.ts
export interface ConnectionStatus {
  ping: number;
  bitrateReceived: number;
  bitrateSent: number;
  packetLoss: number;
  protocol: string;
  candidateType: string;
  networkType: string;
  localAddress: string;
  remoteAddress: string;
  totalBytesReceived: number;
  totalBytesSent: number;
}

export interface VideoStats {
  local: {
    framesPerSecond: number;
    frameWidth: number;
    frameHeight: number;
    framesDropped: number;
  };
  remote: {
    framesPerSecond: number;
    frameWidth: number;
    frameHeight: number;
    framesDropped: number;
    freezeCount: number;
    totalFreezesDuration: number;
    pauseCount: number;
    totalPausesDuration: number;
  };
}

export interface AudioStats {
  local: {
    audioLevel: number;
  };
  remote: {
    audioLevel: number;
  };
}

export interface CodecStats {
  videoCodec: string;
  audioCodec: string;
}

export interface QualityStats {
  jitter: number;
  packetsRetransmitted: number;
  retransmissionRate: number;
  nackCount: number;
  pliCount: number;
  firCount: number;
  qualityLimitationReason: "none" | "cpu" | "bandwidth" | "other";
  qualityLimitationDurations: Record<string, number>;
}

export interface BandwidthStats {
  availableOutgoingBitrate: number;
  availableIncomingBitrate: number;
}

export interface EnhancedConnectionStats {
  connection: ConnectionStatus;
  video: VideoStats;
  audio: AudioStats;
  codecs: CodecStats;
  quality: QualityStats;
  bandwidth: BandwidthStats;
  callDuration: string;
}
