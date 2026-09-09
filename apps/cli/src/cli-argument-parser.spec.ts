import { CliArgumentParser } from './cli-argument-parser.js';

describe('CliArgumentParser', () => {
  const parser = new CliArgumentParser();

  it('should parse valid endpoint localhost:4000', () => {
    const result = parser.parse(['localhost:4000']);
    expect(result.tcpKitConfiguration.tcpEndpoint).toEqual({ host: 'localhost', port: 4000 });
  });

  it('should parse IPv6 endpoint', () => {
    const result = parser.parse(['[::1]:4000']);
    expect(result.tcpKitConfiguration.tcpEndpoint).toEqual({ host: '::1', port: 4000 });
  });

  it('should throw for missing endpoint', () => {
    expect(() => parser.parse([])).toThrow('Missing TCP endpoint');
  });

  it('should throw for malformed endpoint', () => {
    expect(() => parser.parse(['localhost'])).toThrow();
  });

  it('should throw for invalid port', () => {
    expect(() => parser.parse(['localhost:abc'])).toThrow();
  });

  it('should parse with connection timeout', () => {
    const result = parser.parse(['localhost:4000', '--connection-timeout', '1000']);
    expect(result.tcpKitConfiguration.connectionTimeout).toBe(1000);
  });

  it('should parse with equals syntax', () => {
    const result = parser.parse(['localhost:4000', '--request-timeout=5000']);
    expect(result.tcpKitConfiguration.requestTimeout).toBe(5000);
  });
});
