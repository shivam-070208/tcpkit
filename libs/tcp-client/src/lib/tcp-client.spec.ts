import { TcpEndpointParser } from './tcp-endpoint-parser.js';
describe('tcp-client', () => {
  it('should parse endpoint', () => {
    const p = new TcpEndpointParser();
    expect(p.parse('localhost:4000')).toEqual({
      host: 'localhost',
      port: 4000,
    });
  });
});
