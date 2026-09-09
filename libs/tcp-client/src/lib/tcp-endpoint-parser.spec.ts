import { TcpEndpointParser } from './tcp-endpoint-parser.js';
import { InvalidTcpEndpointError, InvalidTcpPortError } from './tcp-client-error.js';

describe('TcpEndpointParser', () => {
  const parser = new TcpEndpointParser();

  it('should parse localhost:4000', () => {
    expect(parser.parse('localhost:4000')).toEqual({ host: 'localhost', port: 4000 });
  });

  it('should parse 127.0.0.1:4000', () => {
    expect(parser.parse('127.0.0.1:4000')).toEqual({ host: '127.0.0.1', port: 4000 });
  });

  it('should parse 192.168.1.20:8080', () => {
    expect(parser.parse('192.168.1.20:8080')).toEqual({ host: '192.168.1.20', port: 8080 });
  });

  it('should parse my-service.local:5000', () => {
    expect(parser.parse('my-service.local:5000')).toEqual({ host: 'my-service.local', port: 5000 });
  });

  it('should parse [::1]:4000', () => {
    expect(parser.parse('[::1]:4000')).toEqual({ host: '::1', port: 4000 });
  });

  it('should parse [2001:db8::1]:4000', () => {
    expect(parser.parse('[2001:db8::1]:4000')).toEqual({ host: '2001:db8::1', port: 4000 });
  });

  it('should reject missing port localhost', () => {
    expect(() => parser.parse('localhost')).toThrow(InvalidTcpEndpointError);
  });

  it('should reject :4000', () => {
    expect(() => parser.parse(':4000')).toThrow(InvalidTcpEndpointError);
  });

  it('should reject localhost:', () => {
    expect(() => parser.parse('localhost:')).toThrow(InvalidTcpEndpointError);
  });

  it('should reject localhost:abc', () => {
    expect(() => parser.parse('localhost:abc')).toThrow(InvalidTcpPortError);
  });

  it('should reject localhost:0', () => {
    expect(() => parser.parse('localhost:0')).toThrow(InvalidTcpPortError);
  });

  it('should reject localhost:65536', () => {
    expect(() => parser.parse('localhost:65536')).toThrow(InvalidTcpPortError);
  });

  it('should reject [::1 without bracket', () => {
    expect(() => parser.parse('[::1')).toThrow(InvalidTcpEndpointError);
  });

  it('should reject ::1]:4000', () => {
    expect(() => parser.parse('::1]:4000')).toThrow(InvalidTcpEndpointError);
  });

  it('should reject missing bracket for IPv6', () => {
    expect(() => parser.parse('::1:4000')).toThrow(InvalidTcpEndpointError);
  });

  it('should reject invalid hostname', () => {
    expect(() => parser.parse('invalid_host:4000')).toThrow(InvalidTcpEndpointError);
  });
});
