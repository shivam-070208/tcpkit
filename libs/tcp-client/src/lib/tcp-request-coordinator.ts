import {
  TcpRequestTimeoutError,
  TcpSocketClosedError,
} from './tcp-client-error.js';

interface PendingTcpRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class TcpRequestCoordinator {
  private readonly pendingRequestsByIdentifier = new Map<
    string,
    PendingTcpRequest
  >();

  register(requestIdentifier: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequestsByIdentifier.delete(requestIdentifier);
        reject(new TcpRequestTimeoutError(requestIdentifier, timeoutMs));
      }, timeoutMs);

      this.pendingRequestsByIdentifier.set(requestIdentifier, {
        resolve: (value: unknown) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject: (reason: Error) => {
          clearTimeout(timeoutId);
          reject(reason);
        },
        timeoutId,
      });
    });
  }

  resolve(requestIdentifier: string, responsePayload: unknown): boolean {
    const pendingRequest =
      this.pendingRequestsByIdentifier.get(requestIdentifier);
    if (!pendingRequest) return false;
    this.pendingRequestsByIdentifier.delete(requestIdentifier);
    pendingRequest.resolve(responsePayload);
    return true;
  }

  rejectAll(activeError: Error): void {
    for (const [
      requestIdentifier,
      pendingRequest,
    ] of this.pendingRequestsByIdentifier.entries()) {
      pendingRequest.reject(activeError);
      this.pendingRequestsByIdentifier.delete(requestIdentifier);
    }
  }

  reject(requestIdentifier: string, activeError: Error): boolean {
    const pendingRequest =
      this.pendingRequestsByIdentifier.get(requestIdentifier);
    if (!pendingRequest) return false;
    this.pendingRequestsByIdentifier.delete(requestIdentifier);
    clearTimeout(pendingRequest.timeoutId);
    pendingRequest.reject(activeError);
    return true;
  }

  hasPendingRequests(): boolean {
    return this.pendingRequestsByIdentifier.size > 0;
  }

  pendingCount(): number {
    return this.pendingRequestsByIdentifier.size;
  }

  clear(): void {
    for (const pendingRequest of this.pendingRequestsByIdentifier.values()) {
      clearTimeout(pendingRequest.timeoutId);
    }
    this.pendingRequestsByIdentifier.clear();
  }

  failAllDueToSocketClosure(): void {
    this.rejectAll(new TcpSocketClosedError());
  }
}
