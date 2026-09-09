import { createConnection, type Socket } from 'node:net';
import { TcpConnectionState } from './tcp-connection-state.js';
import { TcpConnectionError, TcpConnectionTimeoutError } from './tcp-client-error.js';
import type { TcpEndpoint } from './tcp-endpoint.js';

export class TcpConnection {
  private tcpSocket: Socket | null = null;
  private connectionState: TcpConnectionState = TcpConnectionState.DISCONNECTED;
  private connectionError: Error | null = null;
  private pendingConnectionPromise: Promise<Socket> | null = null;

  constructor(
    private readonly tcpEndpoint: TcpEndpoint,
    private readonly connectionTimeout: number,
  ) {}

  getState(): TcpConnectionState {
    return this.connectionState;
  }

  getEndpoint(): TcpEndpoint {
    return this.tcpEndpoint;
  }

  isConnected(): boolean {
    return this.connectionState === TcpConnectionState.CONNECTED && this.tcpSocket !== null && !this.tcpSocket.destroyed;
  }

  getSocket(): Socket | null {
    return this.tcpSocket;
  }

  async connect(): Promise<Socket> {
    if (this.connectionState === TcpConnectionState.CONNECTED && this.tcpSocket) {
      return this.tcpSocket;
    }

    if (this.connectionState === TcpConnectionState.CONNECTING && this.pendingConnectionPromise) {
      return this.pendingConnectionPromise;
    }

    this.connectionState = TcpConnectionState.CONNECTING;
    this.connectionError = null;

    this.pendingConnectionPromise = new Promise((resolve, reject) => {
      const socketTimeoutId = setTimeout(() => {
        this.connectionState = TcpConnectionState.ERROR;
        this.connectionError = new TcpConnectionTimeoutError(this.tcpEndpoint.host, this.tcpEndpoint.port, this.connectionTimeout);
        this.pendingConnectionPromise = null;
        if (pendingSocket) {
          pendingSocket.destroy();
        }
        reject(this.connectionError);
      }, this.connectionTimeout);

      const pendingSocket: Socket = createConnection({
        host: this.tcpEndpoint.host,
        port: this.tcpEndpoint.port,
      });

      const cleanup = () => {
        pendingSocket.removeListener('connect', onConnect);
        pendingSocket.removeListener('error', onError);
        clearTimeout(socketTimeoutId);
      };

      const onConnect = () => {
        cleanup();
        this.tcpSocket = pendingSocket;
        this.connectionState = TcpConnectionState.CONNECTED;
        this.pendingConnectionPromise = null;
        resolve(pendingSocket);
      };

      const onError = (socketError: Error) => {
        cleanup();
        this.connectionState = TcpConnectionState.ERROR;
        this.connectionError = new TcpConnectionError(`Failed to connect to ${this.tcpEndpoint.host}:${this.tcpEndpoint.port} - ${socketError.message}`);
        this.pendingConnectionPromise = null;
        reject(this.connectionError);
      };

      pendingSocket.once('connect', onConnect);
      pendingSocket.once('error', onError);
    });

    return this.pendingConnectionPromise;
  }

  close(): void {
    if (this.connectionState === TcpConnectionState.CLOSING || this.connectionState === TcpConnectionState.DISCONNECTED) {
      return;
    }
    this.connectionState = TcpConnectionState.CLOSING;
    if (this.tcpSocket) {
      this.tcpSocket.destroy();
      this.tcpSocket = null;
    }
    this.connectionState = TcpConnectionState.DISCONNECTED;
  }

  setErrorState(error: Error): void {
    this.connectionState = TcpConnectionState.ERROR;
    this.connectionError = error;
  }

  setDisconnected(): void {
    this.connectionState = TcpConnectionState.DISCONNECTED;
    this.tcpSocket = null;
  }
}
