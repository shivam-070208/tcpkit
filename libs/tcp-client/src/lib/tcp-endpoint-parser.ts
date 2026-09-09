import {
  InvalidTcpEndpointError,
  InvalidTcpPortError,
} from './tcp-client-error.js';
import type { TcpEndpoint } from './tcp-endpoint.js';
import { isIP } from 'node:net';

export class TcpEndpointParser {
  parse(rawEndpoint: string): TcpEndpoint {
    if (
      !rawEndpoint ||
      typeof rawEndpoint !== 'string' ||
      rawEndpoint.trim() === ''
    ) {
      throw new InvalidTcpEndpointError(
        'Invalid TCP endpoint: missing endpoint\n\nExpected format host:port e.g. localhost:4000 or [::1]:4000',
      );
    }

    const trimmedEndpoint = rawEndpoint.trim();

    let host: string;
    let portString: string;

    if (trimmedEndpoint.startsWith('[')) {
      const closingBracketIndex = trimmedEndpoint.indexOf(']');
      if (closingBracketIndex === -1) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nMissing closing bracket for IPv6 address. Expected format [::1]:4000`,
        );
      }
      host = trimmedEndpoint.slice(1, closingBracketIndex);
      const remainder = trimmedEndpoint.slice(closingBracketIndex + 1);
      if (!remainder.startsWith(':')) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nMissing port after IPv6 address. Expected format [::1]:4000`,
        );
      }
      portString = remainder.slice(1);
      if (!host) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nHost is required`,
        );
      }
      if (isIP(host) !== 6) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nInvalid IPv6 address: ${host}`,
        );
      }
    } else {
      const lastColonIndex = trimmedEndpoint.lastIndexOf(':');
      if (lastColonIndex === -1) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nMissing port. Expected format host:port e.g. localhost:4000`,
        );
      }
      host = trimmedEndpoint.slice(0, lastColonIndex);
      portString = trimmedEndpoint.slice(lastColonIndex + 1);

      if (!host) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nHost is required`,
        );
      }
      if (host.includes(':')) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nIPv6 address must be wrapped in brackets. Expected format [::1]:4000`,
        );
      }
      if (host.startsWith('[') || host.endsWith(']')) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nInvalid host brackets`,
        );
      }

      if (isIP(host) === 0 && !this.isValidHostname(host)) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nInvalid hostname: ${host}`,
        );
      }

      if (isIP(host) === 6) {
        throw new InvalidTcpEndpointError(
          `Invalid TCP endpoint: ${trimmedEndpoint}\n\nIPv6 address must be wrapped in brackets. Expected format [::1]:4000`,
        );
      }
    }

    if (!portString) {
      throw new InvalidTcpEndpointError(
        `Invalid TCP endpoint: ${trimmedEndpoint}\n\nPort is required`,
      );
    }

    const port = Number(portString);

    if (
      !Number.isFinite(port) ||
      !Number.isInteger(port) ||
      String(port) !== portString
    ) {
      throw new InvalidTcpPortError(
        `Invalid TCP endpoint: ${trimmedEndpoint}\n\nPort must be a number between 1 and 65535.`,
      );
    }

    if (port < 1 || port > 65535) {
      throw new InvalidTcpPortError(
        `Invalid TCP endpoint: ${trimmedEndpoint}\n\nPort must be a number between 1 and 65535.`,
      );
    }

    return { host, port };
  }

  private isValidHostname(hostname: string): boolean {
    if (hostname.length > 253) return false;
    if (hostname === 'localhost') return true;
    const labels = hostname.split('.');
    const hostnameLabelPattern =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    for (const label of labels) {
      if (!label || label.length > 63) return false;
      if (!hostnameLabelPattern.test(label)) return false;
    }
    return true;
  }
}
