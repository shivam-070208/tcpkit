import { createServer, type Server, type Socket } from 'node:net';
import { TcpClient } from './tcp-client.js';
import { TcpFrameEncoder, TcpFrameDecoder } from '@tcpkit/protocol';

function createEchoServer(handler?: (request: unknown) => unknown): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const encoder = new TcpFrameEncoder();
    const server = createServer((socket: Socket) => {
      const socketDecoder = new TcpFrameDecoder();
      socket.on('data', (chunk) => {
        const messages = socketDecoder.push(chunk);
        for (const message of messages) {
          const request = message as { requestId: string; pattern: string; payload: unknown };
          const responsePayload = handler ? handler(request) : { requestId: request.requestId, success: true, payload: { echo: request.payload } };
          const response = handler ? handler(request) : responsePayload;
          socket.write(encoder.serialize(response));
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      resolve({ server, port: address.port });
    });
  });
}

describe('TcpClient integration', () => {
  it('should connect successfully', async () => {
    const { server, port } = await createEchoServer();
    const client = new TcpClient({ host: '127.0.0.1', port });
    await client.connect();
    expect(client.isConnected()).toBe(true);
    await client.close();
    server.close();
  });

  it('should fail to connect to unavailable port', async () => {
    const client = new TcpClient({ host: '127.0.0.1', port: 59999 }, { connectionTimeout: 500 });
    await expect(client.connect()).rejects.toThrow();
  });

  it('should handle successful request', async () => {
    const { server, port } = await createEchoServer();
    const client = new TcpClient({ host: '127.0.0.1', port });
    const response = await client.send('ping', { hello: 'world' });
    expect((response as { success: boolean }).success).toBe(true);
    await client.close();
    server.close();
  });

  it('should handle request timeout', async () => {
    const { server } = await createEchoServer(() => {
      return new Promise(() => {
        void 0;
      }) as unknown as unknown;
    });
    const serverNeverRespond = createServer((socket) => {
      socket.on('data', (_chunk: Buffer) => {
        void _chunk;
      });
    });
    const portNeverRespond = await new Promise<number>((resolve) => {
      serverNeverRespond.listen(0, '127.0.0.1', () => resolve((serverNeverRespond.address() as { port: number }).port));
    });
    const client = new TcpClient({ host: '127.0.0.1', port: portNeverRespond }, { requestTimeout: 200 });
    await expect(client.send('ping', {})).rejects.toThrow('timed out');
    await client.close();
    serverNeverRespond.close();
    server.close();
  });

  it('should support concurrent requests', async () => {
    const encoder = new TcpFrameEncoder();
    const server = createServer((socket) => {
      const socketDecoder = new TcpFrameDecoder();
      socket.on('data', (chunk) => {
        const messages = socketDecoder.push(chunk);
        for (const message of messages) {
          const request = message as { requestId: string };
          const response = { requestId: request.requestId, success: true, payload: { id: request.requestId } };
          socket.write(encoder.serialize(response));
        }
      });
    });
    const port = await new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port)));
    const client = new TcpClient({ host: '127.0.0.1', port });
    const results = await Promise.all([client.send('a', {}), client.send('b', {}), client.send('c', {})]);
    expect(results.length).toBe(3);
    expect(results[0]).toHaveProperty('requestId');
    await client.close();
    server.close();
  });

  it('should handle out-of-order responses', async () => {
    const encoder = new TcpFrameEncoder();
    const server = createServer((socket) => {
      const socketDecoder = new TcpFrameDecoder();
      const pending: { requestId: string; index: number }[] = [];
      socket.on('data', (chunk) => {
        const messages = socketDecoder.push(chunk);
        for (const message of messages) {
          const request = message as { requestId: string; payload: { index: number } };
          pending.push({ requestId: request.requestId, index: (request.payload as { index: number }).index });
          if (pending.length === 3) {
            const reversed = [...pending].reverse();
            for (const item of reversed) {
              const response = { requestId: item.requestId, success: true, payload: { index: item.index } };
              socket.write(encoder.serialize(response));
            }
          }
        }
      });
    });
    const port = await new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port)));
    const client = new TcpClient({ host: '127.0.0.1', port });
    const promise0 = client.send('test', { index: 0 });
    const promise1 = client.send('test', { index: 1 });
    const promise2 = client.send('test', { index: 2 });
    const [response0, response1, response2] = await Promise.all([promise0, promise1, promise2]);
    expect((response0 as { payload: { index: number } }).payload.index).toBe(0);
    expect((response1 as { payload: { index: number } }).payload.index).toBe(1);
    expect((response2 as { payload: { index: number } }).payload.index).toBe(2);
    await client.close();
    server.close();
  });

  it('should handle socket closure', async () => {
    const server = createServer((socket) => {
      socket.destroy();
    });
    const port = await new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port)));
    const client = new TcpClient({ host: '127.0.0.1', port }, { requestTimeout: 500 });
    await expect(client.send('ping', {})).rejects.toThrow();
    await client.close();
    server.close();
  });

  it('should handle multiple frames and fragmentation correctly', async () => {
    const encoder = new TcpFrameEncoder();
    const decoder = new TcpFrameDecoder();
    const message = { test: 'fragmentation' };
    const framed = encoder.serialize(message);
    const fragments = [framed.subarray(0, 1), framed.subarray(1, 3), framed.subarray(3)];
    let decoded: unknown[] = [];
    for (const fragment of fragments) {
      decoded = decoded.concat(decoder.push(fragment));
    }
    expect(decoded).toEqual([message]);
  });
});
