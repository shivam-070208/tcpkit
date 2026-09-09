import type { Socket } from 'node:net';
import {
  TcpFrameEncoder,
  TcpFrameDecoder,
  TcpNestFrameEncoder,
  TcpNestFrameDecoder,
} from '@tcpkit/protocol';
import { TcpConnection } from './tcp-connection.js';
import { TcpRequestCoordinator } from './tcp-request-coordinator.js';
import { TcpConnectionError } from './tcp-client-error.js';
import type { TcpEndpoint } from './tcp-endpoint.js';
import type { TcpClientConfiguration } from './tcp-configuration.js';
import { defaultTcpClientConfiguration } from './tcp-configuration.js';
import { TcpDebugLogger } from './tcp-debug-logger.js';
import { randomUUID } from 'node:crypto';

export interface TcpRequest {
  requestId: string;
  pattern: string;
  payload: unknown;
}

export interface TcpResponse {
  requestId: string;
  success: boolean;
  payload?: unknown;
  error?: string;
}

export class TcpClient {
  private readonly tcpConnection: TcpConnection;
  private readonly tcpFrameEncoder: TcpFrameEncoder;
  private readonly tcpFrameDecoder: TcpFrameDecoder;
  private readonly tcpNestFrameEncoder: TcpNestFrameEncoder;
  private readonly tcpNestFrameDecoder: TcpNestFrameDecoder;
  private readonly tcpRequestCoordinator: TcpRequestCoordinator;
  private readonly tcpClientConfiguration: TcpClientConfiguration;
  private readonly tcpDebugLogger: TcpDebugLogger;

  constructor(
    private readonly tcpEndpoint: TcpEndpoint,
    configuration: Partial<TcpClientConfiguration> = {},
  ) {
    this.tcpClientConfiguration = {
      ...defaultTcpClientConfiguration,
      ...configuration,
    };
    this.tcpDebugLogger = new TcpDebugLogger(
      this.tcpClientConfiguration.debug,
      this.tcpClientConfiguration.logFile,
    );
    this.tcpDebugLogger.log(
      'info',
      `TcpClient init ${this.tcpEndpoint.host}:${this.tcpEndpoint.port} transport=${this.tcpClientConfiguration.transport} connTimeout=${this.tcpClientConfiguration.connectionTimeout} reqTimeout=${this.tcpClientConfiguration.requestTimeout}`,
    );
    this.tcpConnection = new TcpConnection(
      this.tcpEndpoint,
      this.tcpClientConfiguration.connectionTimeout,
    );
    this.tcpFrameEncoder = new TcpFrameEncoder(
      this.tcpClientConfiguration.maximumPayloadSize,
    );
    this.tcpFrameDecoder = new TcpFrameDecoder(
      this.tcpClientConfiguration.maximumPayloadSize,
    );
    this.tcpNestFrameEncoder = new TcpNestFrameEncoder();
    this.tcpNestFrameDecoder = new TcpNestFrameDecoder();
    this.tcpRequestCoordinator = new TcpRequestCoordinator();
  }

  getEndpoint(): TcpEndpoint {
    return this.tcpEndpoint;
  }

  getConnectionState(): string {
    return this.tcpConnection.getState();
  }

  isConnected(): boolean {
    return this.tcpConnection.isConnected();
  }

  hasPendingRequests(): boolean {
    return this.tcpRequestCoordinator.hasPendingRequests();
  }

  async connect(): Promise<void> {
    this.tcpDebugLogger.log(
      'debug',
      `Connecting to ${this.tcpEndpoint.host}:${this.tcpEndpoint.port}`,
    );
    const start = Date.now();
    const socket = await this.tcpConnection.connect();
    this.tcpDebugLogger.log('info', `Connected in ${Date.now() - start}ms`);
    this.attachSocketListeners(socket);
  }

  async send(
    pattern: string,
    payload: unknown,
    requestIdentifier?: string,
  ): Promise<TcpResponse> {
    const requestId = requestIdentifier ?? this.generateRequestIdentifier();
    this.tcpDebugLogger.log('info', `Send start`, {
      requestId,
      pattern,
      payload,
      transport: this.tcpClientConfiguration.transport,
    });

    if (!this.tcpConnection.isConnected()) {
      this.tcpDebugLogger.log(
        'debug',
        `Socket not connected, connecting first`,
      );
      await this.connect();
    }

    const socket = this.tcpConnection.getSocket();
    if (!socket) {
      throw new TcpConnectionError('Socket not available');
    }

    const responsePromise = this.tcpRequestCoordinator.register(
      requestId,
      this.tcpClientConfiguration.requestTimeout,
    );
    const serializedFrame = this.serializeRequest(pattern, payload, requestId);
    this.tcpDebugLogger.log(
      'debug',
      `Serialized frame ${serializedFrame.length} bytes`,
      serializedFrame.subarray(0, 500),
    );

    await this.writeFrameToSocket(socket, serializedFrame);
    this.tcpDebugLogger.log(
      'debug',
      `Frame written, awaiting response ${requestId} timeout ${this.tcpClientConfiguration.requestTimeout}ms`,
    );

    const rawResponse = await responsePromise;
    this.tcpDebugLogger.log('info', `Response received`, rawResponse);
    return rawResponse as TcpResponse;
  }

  async close(): Promise<void> {
    this.tcpRequestCoordinator.failAllDueToSocketClosure();
    this.tcpConnection.close();
    this.tcpFrameDecoder.clear();
    this.tcpNestFrameDecoder.clear();
  }

  private generateRequestIdentifier(): string {
    return `req_${randomUUID()}`;
  }

  private serializeRequest(
    pattern: string,
    payload: unknown,
    requestId: string,
  ): Buffer {
    if (this.tcpClientConfiguration.transport === 'nest') {
      const nestPacket = { id: requestId, pattern, data: payload };
      return this.tcpNestFrameEncoder.serialize(nestPacket);
    }
    const tcpRequest: TcpRequest = { requestId, pattern, payload };
    return this.tcpFrameEncoder.serialize(tcpRequest);
  }

  private async writeFrameToSocket(
    socket: Socket,
    serializedFrame: Buffer,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.write(serializedFrame, (writeError) => {
        if (writeError) {
          this.tcpDebugLogger.log('error', `Write failed`, writeError.message);
          reject(
            new TcpConnectionError(
              `Failed to send data: ${writeError.message}`,
            ),
          );
        } else {
          this.tcpDebugLogger.log(
            'debug',
            `Write success ${serializedFrame.length} bytes`,
          );
          resolve();
        }
      });
    });
  }

  private attachSocketListeners(socket: Socket): void {
    this.tcpDebugLogger.log('debug', `Socket listeners attached`);
    socket.on('data', (tcpChunk: Buffer) => {
      this.tcpDebugLogger.log(
        'debug',
        `Data received ${tcpChunk.length} bytes`,
        tcpChunk,
      );
      if (this.tcpClientConfiguration.transport === 'nest') {
        this.handleNestData(tcpChunk);
        return;
      }
      let decodedMessages: unknown[];
      try {
        decodedMessages = this.tcpFrameDecoder.push(tcpChunk);
        this.tcpDebugLogger.log(
          'debug',
          `Decoded ${decodedMessages.length} messages`,
          decodedMessages,
        );
      } catch (error) {
        const protocolError =
          error instanceof Error ? error : new Error(String(error));
        this.tcpDebugLogger.log('error', `Decode error`, protocolError.message);
        this.tcpConnection.setErrorState(protocolError);
        this.tcpRequestCoordinator.rejectAll(protocolError);
        return;
      }

      for (const decodedMessage of decodedMessages) {
        const response = decodedMessage as TcpResponse & {
          id?: string;
          response?: unknown;
          err?: unknown;
        };
        const requestId = response?.requestId ?? response?.id;
        this.tcpDebugLogger.log(
          'debug',
          `Decoded message for ${requestId}`,
          response,
        );
        if (typeof requestId === 'string') {
          const normalizedResponse = this.normalizeResponse(response);
          this.tcpRequestCoordinator.resolve(requestId, normalizedResponse);
        }
      }
    });

    socket.on('error', (socketError: Error) => {
      this.tcpDebugLogger.log('error', `Socket error`, socketError.message);
      const connectionError = new TcpConnectionError(socketError.message);
      this.tcpConnection.setErrorState(connectionError);
      this.tcpRequestCoordinator.rejectAll(connectionError);
    });

    socket.on('close', () => {
      this.tcpDebugLogger.log('info', `Socket closed`);
      this.tcpConnection.setDisconnected();
      if (this.tcpRequestCoordinator.hasPendingRequests()) {
        this.tcpRequestCoordinator.failAllDueToSocketClosure();
      }
    });
  }

  private handleNestData(tcpChunk: Buffer): void {
    this.tcpDebugLogger.log(
      'debug',
      `Nest raw chunk ${tcpChunk.length}`,
      tcpChunk.subarray(0, 500).toString('utf8'),
    );
    let decodedMessages: unknown[];
    try {
      decodedMessages = this.tcpNestFrameDecoder.push(tcpChunk);
      this.tcpDebugLogger.log(
        'debug',
        `Nest decoded ${decodedMessages.length}`,
        decodedMessages,
      );
    } catch (error) {
      const protocolError =
        error instanceof Error ? error : new Error(String(error));
      this.tcpDebugLogger.log(
        'error',
        `Nest decode error`,
        protocolError.message,
      );
      this.tcpConnection.setErrorState(protocolError);
      this.tcpRequestCoordinator.rejectAll(protocolError);
      return;
    }

    for (const decodedMessage of decodedMessages) {
      const nestResponse = decodedMessage as {
        id: string;
        response?: unknown;
        err?: string;
        isDisposed?: boolean;
      };
      const requestId = nestResponse?.id;
      this.tcpDebugLogger.log(
        'debug',
        `Nest message id=${requestId}`,
        nestResponse,
      );
      if (typeof requestId === 'string') {
        const normalizedResponse: TcpResponse = {
          requestId,
          success: !nestResponse.err,
          payload: nestResponse.response,
          error: nestResponse.err ? String(nestResponse.err) : undefined,
        };
        this.tcpRequestCoordinator.resolve(requestId, normalizedResponse);
      }
    }
  }

  private normalizeResponse(
    rawResponse: TcpResponse & {
      id?: string;
      response?: unknown;
      err?: unknown;
    },
  ): TcpResponse {
    if (rawResponse.requestId) return rawResponse;
    return {
      requestId: rawResponse.id as string,
      success: !rawResponse.err,
      payload:
        (rawResponse as unknown as { response?: unknown }).response ??
        rawResponse.payload,
      error: rawResponse.err ? String(rawResponse.err) : undefined,
    };
  }
}
