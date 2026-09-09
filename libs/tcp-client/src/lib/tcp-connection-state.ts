export const TcpConnectionState = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR',
  CLOSING: 'CLOSING',
} as const;

export type TcpConnectionState = (typeof TcpConnectionState)[keyof typeof TcpConnectionState];
