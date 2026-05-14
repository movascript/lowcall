export interface ConnectionStatus {
  ping: number;
  bitrate: number;
  packetLoss: number;
  protocol: string;
  candidateType: string;
  networkType: string;
  localAddress: string;
  remoteAddress: string;
  totalBytesReceived: number;
  totalBytesSent: number;
}
