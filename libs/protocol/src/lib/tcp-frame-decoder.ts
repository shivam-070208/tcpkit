import {
  TcpInvalidFrameError,
  TcpOversizedPayloadError,
  TcpProtocolError,
} from './tcp-protocol-error.js';

export class TcpFrameDecoder {
  private responseBuffer: Buffer = Buffer.alloc(0);

  constructor(private readonly maximumPayloadSize: number = 1024 * 1024) {}

  push(tcpChunk: Buffer): unknown[] {
    this.responseBuffer = Buffer.concat([this.responseBuffer, tcpChunk]);
    const decodedMessages: unknown[] = [];

    while (this.responseBuffer.length >= 4) {
      const payloadSize = this.responseBuffer.readUInt32BE(0);

      if (payloadSize > this.maximumPayloadSize) {
        throw new TcpOversizedPayloadError(
          payloadSize,
          this.maximumPayloadSize,
        );
      }

      if (payloadSize === 0) {
        throw new TcpInvalidFrameError('Invalid frame length 0');
      }

      const totalFrameSize = 4 + payloadSize;

      if (this.responseBuffer.length < totalFrameSize) {
        break;
      }

      const payloadBytes = this.responseBuffer.subarray(4, totalFrameSize);
      this.responseBuffer = this.responseBuffer.subarray(totalFrameSize);

      const jsonString = payloadBytes.toString('utf8');
      let parsedMessage: unknown;
      try {
        parsedMessage = JSON.parse(jsonString);
      } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        throw new TcpProtocolError(`Malformed JSON payload: ${cause}`);
      }

      decodedMessages.push(parsedMessage);
    }

    return decodedMessages;
  }

  hasBufferedBytes(): boolean {
    return this.responseBuffer.length > 0;
  }

  clear(): void {
    this.responseBuffer = Buffer.alloc(0);
  }
}
