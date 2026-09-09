export class TcpProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TcpProtocolError';
  }
}

export class TcpOversizedPayloadError extends TcpProtocolError {
  constructor(payloadSize: number, maximumPayloadSize: number) {
    super(`Payload size ${payloadSize} exceeds maximum ${maximumPayloadSize}`);
    this.name = 'TcpOversizedPayloadError';
  }
}

export class TcpInvalidFrameError extends TcpProtocolError {
  constructor(message: string) {
    super(message);
    this.name = 'TcpInvalidFrameError';
  }
}
