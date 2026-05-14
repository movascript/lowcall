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
