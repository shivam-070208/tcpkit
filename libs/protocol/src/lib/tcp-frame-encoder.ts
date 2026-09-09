import { TcpOversizedPayloadError } from './tcp-protocol-error.js';

export class TcpFrameEncoder {
  constructor(private readonly maximumPayloadSize: number = 1024 * 1024) {}

  serialize(message: unknown): Buffer {
    const jsonString = JSON.stringify(message);
    const payloadBuffer = Buffer.from(jsonString, 'utf8');
    const payloadSize = payloadBuffer.byteLength;

    if (payloadSize > this.maximumPayloadSize) {
      throw new TcpOversizedPayloadError(payloadSize, this.maximumPayloadSize);
    }

    const framedBuffer = Buffer.allocUnsafe(4 + payloadSize);
    framedBuffer.writeUInt32BE(payloadSize, 0);
    payloadBuffer.copy(framedBuffer, 4);
    return framedBuffer;
  }
}
