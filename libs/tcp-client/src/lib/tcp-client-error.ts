export class InvalidTcpEndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTcpEndpointError';
  }
}

export class InvalidTcpPortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTcpPortError';
  }
}

export class TcpConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TcpConnectionError';
  }
}

export class TcpConnectionTimeoutError extends TcpConnectionError {
  constructor(host: string, port: number, timeoutMs: number) {
    super(`Connection to ${host}:${port} timed out after ${timeoutMs}ms`);
    this.name = 'TcpConnectionTimeoutError';
  }
}

export class TcpRequestTimeoutError extends Error {
  constructor(requestIdentifier: string, timeoutMs: number) {
    super(`Request ${requestIdentifier} timed out after ${timeoutMs}ms`);
    this.name = 'TcpRequestTimeoutError';
  }
}

export class TcpSocketClosedError extends Error {
  constructor(message = 'TCP socket closed unexpectedly') {
    super(message);
    this.name = 'TcpSocketClosedError';
  }
}
