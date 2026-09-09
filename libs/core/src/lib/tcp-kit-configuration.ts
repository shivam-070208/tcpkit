import type { TcpEndpoint, TcpTransport } from '@tcpkit/tcp-client';

export interface TcpKitConfiguration {
  tcpEndpoint: TcpEndpoint;
  connectionTimeout: number;
  requestTimeout: number;
  maximumPayloadSize: number;
  transport: TcpTransport;
  debug: boolean;
  logFile: string | null;
}

export const defaultTcpKitConfiguration: Omit<
  TcpKitConfiguration,
  'tcpEndpoint'
> = {
  connectionTimeout: 5000,
  requestTimeout: 30000,
  maximumPayloadSize: 1024 * 1024,
  transport: 'tcpkit',
  debug: false,
  logFile: null,
};

export function createTcpKitConfiguration(
  tcpEndpoint: TcpEndpoint,
  overrides: Partial<Omit<TcpKitConfiguration, 'tcpEndpoint'>> = {},
): TcpKitConfiguration {
  return {
    tcpEndpoint,
    connectionTimeout:
      overrides.connectionTimeout ??
      defaultTcpKitConfiguration.connectionTimeout,
    requestTimeout:
      overrides.requestTimeout ?? defaultTcpKitConfiguration.requestTimeout,
    maximumPayloadSize:
      overrides.maximumPayloadSize ??
      defaultTcpKitConfiguration.maximumPayloadSize,
    transport: overrides.transport ?? defaultTcpKitConfiguration.transport,
    debug: overrides.debug ?? defaultTcpKitConfiguration.debug,
    logFile: overrides.logFile ?? defaultTcpKitConfiguration.logFile,
  };
}
