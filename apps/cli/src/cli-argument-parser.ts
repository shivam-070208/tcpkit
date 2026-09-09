import { TcpEndpointParser } from '@tcpkit/tcp-client';
import type { TcpEndpoint } from '@tcpkit/tcp-client';
import { createTcpKitConfiguration } from '@tcpkit/core';
import type { TcpKitConfiguration } from '@tcpkit/core';

export interface ParsedCliArguments {
  tcpKitConfiguration: TcpKitConfiguration;
}

export class CliArgumentParser {
  private readonly tcpEndpointParser = new TcpEndpointParser();

  parse(rawArguments: string[]): ParsedCliArguments {
    const filteredPositional = this.extractPositional(rawArguments);

    if (filteredPositional.length === 0) {
      throw new Error(
        `Missing TCP endpoint\n\nUsage: tcpkit <host>:<port>\n\nExamples:\n  tcpkit localhost:4000\n  tcpkit 127.0.0.1:4000\n  tcpkit [::1]:4000`,
      );
    }

    if (filteredPositional.length > 1) {
      throw new Error(
        `Invalid arguments: expected single endpoint but got "${filteredPositional.join(' ')}"`,
      );
    }

    const rawEndpoint = filteredPositional[0] as string;
    const tcpEndpoint: TcpEndpoint = this.tcpEndpointParser.parse(rawEndpoint);

    const connectionTimeout = this.extractNumericOption(
      rawArguments,
      '--connection-timeout',
    );
    const requestTimeout = this.extractNumericOption(
      rawArguments,
      '--request-timeout',
    );
    const transport = this.extractStringOption(rawArguments, '--transport');
    const logFile = this.extractStringOption(rawArguments, '--log-file');
    const debug =
      rawArguments.includes('--debug') || rawArguments.includes('--verbose');

    if (
      connectionTimeout !== undefined &&
      (!Number.isInteger(connectionTimeout) || connectionTimeout <= 0)
    ) {
      throw new Error(
        'Invalid --connection-timeout: must be a positive integer',
      );
    }

    if (
      requestTimeout !== undefined &&
      (!Number.isInteger(requestTimeout) || requestTimeout <= 0)
    ) {
      throw new Error('Invalid --request-timeout: must be a positive integer');
    }

    if (
      transport !== undefined &&
      transport !== 'tcpkit' &&
      transport !== 'nest'
    ) {
      throw new Error('Invalid --transport: must be tcpkit or nest');
    }

    const tcpKitConfiguration = createTcpKitConfiguration(tcpEndpoint, {
      ...(connectionTimeout !== undefined ? { connectionTimeout } : {}),
      ...(requestTimeout !== undefined ? { requestTimeout } : {}),
      ...(transport !== undefined
        ? { transport: transport as 'tcpkit' | 'nest' }
        : {}),
      ...(debug ? { debug: true } : {}),
      ...(logFile !== undefined ? { logFile } : {}),
    });

    return { tcpKitConfiguration };
  }

  private extractPositional(rawArguments: string[]): string[] {
    const positional: string[] = [];
    for (let index = 0; index < rawArguments.length; index++) {
      const argument = rawArguments[index] as string;
      if (argument.startsWith('--')) {
        if (argument.includes('=')) continue;
        const next = rawArguments[index + 1];
        if (next && !next.startsWith('-')) {
          index++;
        }
        continue;
      }
      if (argument.startsWith('-')) continue;
      positional.push(argument);
    }
    return positional;
  }

  private extractNumericOption(
    rawArguments: string[],
    optionName: string,
  ): number | undefined {
    for (let index = 0; index < rawArguments.length; index++) {
      const argument = rawArguments[index] as string;
      if (argument === optionName) {
        const nextArgument = rawArguments[index + 1] as string;
        if (!nextArgument || nextArgument.startsWith('-')) {
          throw new Error(`Missing value for ${optionName}`);
        }
        const numericValue = Number(nextArgument);
        if (Number.isNaN(numericValue)) {
          throw new Error(
            `Invalid ${optionName}: ${nextArgument} is not a number`,
          );
        }
        return numericValue;
      }
      if (argument.startsWith(`${optionName}=`)) {
        const rawValue = argument.slice(optionName.length + 1);
        const numericValue = Number(rawValue);
        if (Number.isNaN(numericValue)) {
          throw new Error(`Invalid ${optionName}: ${rawValue} is not a number`);
        }
        return numericValue;
      }
    }
    return undefined;
  }

  private extractStringOption(
    rawArguments: string[],
    optionName: string,
  ): string | undefined {
    for (let index = 0; index < rawArguments.length; index++) {
      const argument = rawArguments[index] as string;
      if (argument === optionName) {
        const nextArgument = rawArguments[index + 1] as string;
        if (!nextArgument || nextArgument.startsWith('-')) {
          throw new Error(`Missing value for ${optionName}`);
        }
        return nextArgument;
      }
      if (argument.startsWith(`${optionName}=`)) {
        return argument.slice(optionName.length + 1);
      }
    }
    return undefined;
  }
}
