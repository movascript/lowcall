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

export type IceUiState =
  | "new"
  | "checking"
  | "connected"
  | "completed"
  | "disconnected"
  | "failed"
  | "closed";

export type CallPhase =
  | "lobby"
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "peer-left";

export type ChatMessageStatus = "sent" | "queued" | "failed";

export interface MessageReaction {
  emoji: string;
  local: boolean;
  remote: boolean;
}

export interface ChatTextMessage {
  kind: "text";
  id: string;
  text: string;
  sentAt: number;
  from: "local" | "remote";
  status: ChatMessageStatus;
  reactions: MessageReaction[];
}

export interface ChatFileMessage {
  kind: "file";
  id: string;
  name: string;
  size: number;
  mime: string;
  sentAt: number;
  from: "local" | "remote";
  status: ChatMessageStatus;
  progress: number;
  url?: string;
  reactions: MessageReaction[];
}

export type ChatMessage = ChatTextMessage | ChatFileMessage;

export interface CallReaction {
  id: string;
  emoji: string;
  from: "local" | "remote";
}

export interface MediaDeviceLists {
  cameras: MediaDeviceInfo[];
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}
