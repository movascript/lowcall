const PEER_ID_KEY = "lowcall.peerId";

export function getPeerId(): string {
  try {
    let id = sessionStorage.getItem(PEER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(PEER_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function randomRoomId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function normalizeRoomId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${parseFloat(value.toFixed(dm))} ${sizes[i]}`;
}

export function formatBitrate(bps: number): string {
  if (!bps || bps < 0) return "0 kbps";
  if (bps < 1000) return `${Math.round(bps)} bps`;
  if (bps < 1_000_000) return `${Math.round(bps / 1000)} kbps`;
  return `${(bps / 1_000_000).toFixed(1)} Mbps`;
}

export function roomUrl(roomId: string): string {
  const origin = window.location.origin;
  return `${origin}/${roomId}`;
}

export function log(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
