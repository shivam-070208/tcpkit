import React from 'react';
import { render } from 'ink';
import { CliArgumentParser } from './cli-argument-parser.js';
import { TcpKitTui } from '@tcpkit/tui';

export class CliApplication {
  private readonly cliArgumentParser = new CliArgumentParser();

  async run(rawArguments: string[]): Promise<void> {
    if (rawArguments.includes('--help') || rawArguments.includes('-h')) {
      this.printHelp();
      return;
    }

    if (rawArguments.includes('--version') || rawArguments.includes('-v')) {
      this.printVersion();
      return;
    }

    let parsedArguments;
    try {
      parsedArguments = this.cliArgumentParser.parse(rawArguments);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exitCode = 1;
      return;
    }

    const inkInstance = render(
      React.createElement(TcpKitTui, {
        tcpKitConfiguration: parsedArguments.tcpKitConfiguration,
      }),
    );
    await inkInstance.waitUntilExit();
  }

  private printHelp(): void {
    console.log(
      [
        'tcpkit - TCP Kit CLI for TCP microservices',
        '',
        'Usage:',
        '  tcpkit <host>:<port> [options]',
        '',
        'Examples:',
        '  tcpkit localhost:4000',
        '  tcpkit 127.0.0.1:4000 --transport nest',
        '  tcpkit 192.168.1.20:4000',
        '  tcpkit my-service.local:5000',
        '  tcpkit [::1]:4000',
        '',
        'Options:',
        '  --connection-timeout <ms>  Connection timeout in ms (default 5000)',
        '  --request-timeout <ms>     Request timeout in ms (default 30000)',
        '  --transport <tcpkit|nest>  Transport framing (default tcpkit, use nest for NestJS microservices)',
        '  -h, --help                 Show help',
        '  -v, --version              Show version',
        '',
        'NestJS example:',
        '  tcpkit localhost:3001 --transport nest',
        '',
      ].join('\n'),
    );
  }

  private printVersion(): void {
    console.log('0.0.1');
  }
}
