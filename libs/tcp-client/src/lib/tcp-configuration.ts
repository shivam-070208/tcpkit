export type TcpTransport = 'tcpkit' | 'nest';

export interface TcpClientConfiguration {
  connectionTimeout: number;
  requestTimeout: number;
  maximumPayloadSize: number;
  transport: TcpTransport;
  debug: boolean;
  logFile: string | null;
}

export const defaultTcpClientConfiguration: TcpClientConfiguration = {
  connectionTimeout: 5000,
  requestTimeout: 30000,
  maximumPayloadSize: 1024 * 1024,
  transport: 'tcpkit',
  debug: false,
  logFile: null,
};
