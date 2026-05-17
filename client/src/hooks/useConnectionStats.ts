// src/hooks/useConnectionStats.ts
import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus } from "../types";

const initialStats: ConnectionStatus = {
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

export const useConnectionStats = (
  peerConnection: RTCPeerConnection | null,
  isConnected: boolean,
) => {
  const [stats, setStats] = useState<ConnectionStatus>(initialStats);
  const statsIntervalRef = useRef<number | null>(null);
  const prevBytesReceivedRef = useRef(0);
  const prevBytesSentRef = useRef(0);
  const prevTimeRef = useRef(Date.now());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function startStatsMonitoring() {
    stopStatsMonitoring();
    prevBytesReceivedRef.current = 0;
    prevBytesSentRef.current = 0;
    prevTimeRef.current = Date.now();

    statsIntervalRef.current = setInterval(async () => {
      if (!peerConnection) return;

      try {
        const statsReport = await peerConnection.getStats();
        let bytesReceived = 0,
          bytesSent = 0,
          packetLoss = 0,
          rtt = 0,
          protocol = "N/A",
          candidateType = "N/A",
          networkType = "N/A",
          localAddress = "N/A",
          remoteAddress = "N/A",
          localCandidateId = "",
          remoteCandidateId = "";

        statsReport.forEach((report) => {
          if (report.type === "inbound-rtp") {
            if (report.bytesReceived) bytesReceived += report.bytesReceived;
            if (report.packetsLost && report.packetsReceived) {
              packetLoss = Math.round(
                (report.packetsLost /
                  (report.packetsLost + report.packetsReceived)) *
                  100,
              );
            }
          }
          if (report.type === "outbound-rtp") {
            if (report.bytesSent) bytesSent += report.bytesSent;
          }
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            rtt = report.currentRoundTripTime
              ? Math.round(report.currentRoundTripTime * 1000)
              : 0;
            localCandidateId = report.localCandidateId;
            remoteCandidateId = report.remoteCandidateId;
          }
        });

        statsReport.forEach((report) => {
          if (
            report.type === "local-candidate" &&
            report.id === localCandidateId
          ) {
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

        if (mountedRef.current) {
          setStats({
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
  }

  useEffect(() => {
    if (isConnected && peerConnection) {
      startStatsMonitoring();
    } else {
      stopStatsMonitoring();
      if (mountedRef.current) {
        setStats(initialStats);
      }
    }

    return () => {
      stopStatsMonitoring();
    };
  }, [isConnected, peerConnection]);

  const resetStats = () => {
    if (mountedRef.current) {
      setStats(initialStats);
    }
  };

  return { stats, resetStats };
};
