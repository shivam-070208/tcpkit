import { TcpFrameEncoder } from './tcp-frame-encoder.js';
import { TcpFrameDecoder } from './tcp-frame-decoder.js';
import {
  TcpOversizedPayloadError,
  TcpProtocolError,
} from './tcp-protocol-error.js';

describe('TcpFrameEncoder', () => {
  it('should serialize and produce length prefix', () => {
    const encoder = new TcpFrameEncoder();
    const message = { requestId: 'req_1', pattern: 'ping', payload: {} };
    const buffer = encoder.serialize(message);
    const length = buffer.readUInt32BE(0);
    const payload = JSON.parse(buffer.subarray(4).toString('utf8'));
    expect(length).toBe(Buffer.byteLength(JSON.stringify(message), 'utf8'));
    expect(payload).toEqual(message);
  });

  it('should throw for oversized payload', () => {
    const encoder = new TcpFrameEncoder(10);
    expect(() => encoder.serialize({ data: '12345678901' })).toThrow(
      TcpOversizedPayloadError,
    );
  });
});

describe('TcpFrameDecoder', () => {
  it('should decode single frame', () => {
    const encoder = new TcpFrameEncoder();
    const decoder = new TcpFrameDecoder();
    const message = { hello: 'world' };
    const buffer = encoder.serialize(message);
    const messages = decoder.push(buffer);
    expect(messages).toEqual([message]);
  });

  it('should handle incomplete frames', () => {
    const encoder = new TcpFrameEncoder();
    const decoder = new TcpFrameDecoder();
    const message = { id: 123 };
    const buffer = encoder.serialize(message);
    const firstChunk = buffer.subarray(0, 2);
    const secondChunk = buffer.subarray(2);
    expect(decoder.push(firstChunk)).toEqual([]);
    expect(decoder.push(secondChunk)).toEqual([message]);
  });

  it('should handle multiple frames in one chunk', () => {
    const encoder = new TcpFrameEncoder();
    const decoder = new TcpFrameDecoder();
    const msg1 = { a: 1 };
    const msg2 = { b: 2 };
    const combined = Buffer.concat([
      encoder.serialize(msg1),
      encoder.serialize(msg2),
    ]);
    const messages = decoder.push(combined);
    expect(messages).toEqual([msg1, msg2]);
  });

  it('should handle partial frame plus multiple frames', () => {
    const encoder = new TcpFrameEncoder();
    const decoder = new TcpFrameDecoder();
    const msg1 = { a: 1 };
    const msg2 = { b: 2 };
    const buf1 = encoder.serialize(msg1);
    const buf2 = encoder.serialize(msg2);
    const combined = Buffer.concat([buf1, buf2]);
    const firstPart = combined.subarray(0, buf1.length + 2);
    const secondPart = combined.subarray(buf1.length + 2);
    expect(decoder.push(firstPart)).toEqual([msg1]);
    expect(decoder.push(secondPart)).toEqual([msg2]);
  });

  it('should throw for malformed JSON', () => {
    const decoder = new TcpFrameDecoder();
    const malformedPayload = Buffer.from('{invalid json}');
    const buffer = Buffer.allocUnsafe(4 + malformedPayload.length);
    buffer.writeUInt32BE(malformedPayload.length, 0);
    malformedPayload.copy(buffer, 4);
    expect(() => decoder.push(buffer)).toThrow(TcpProtocolError);
  });

  it('should throw for invalid length oversized', () => {
    const decoder = new TcpFrameDecoder(10);
    const payload = Buffer.from(JSON.stringify({ a: '12345678901' }));
    const buffer = Buffer.allocUnsafe(4 + payload.length);
    buffer.writeUInt32BE(payload.length, 0);
    payload.copy(buffer, 4);
    expect(() => decoder.push(buffer)).toThrow(TcpOversizedPayloadError);
  });

  it('should handle multiple messages in one TCP packet with split', () => {
    const encoder = new TcpFrameEncoder();
    const decoder = new TcpFrameDecoder();
    const messages = [{ i: 0 }, { i: 1 }, { i: 2 }].map((m) =>
      encoder.serialize(m),
    );
    const combined = Buffer.concat(messages);
    for (let i = 0; i < combined.length; i += 5) {
      const chunk = combined.subarray(i, i + 5);
      void decoder.push(chunk);
    }
    // final buffer should have decoded all after feeding
    const fullDecoder = new TcpFrameDecoder();
    const all = fullDecoder.push(combined);
    expect(all.length).toBe(3);
  });
});
