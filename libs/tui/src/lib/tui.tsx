import { useEffect, useState, useMemo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { TcpClient } from '@tcpkit/tcp-client';
import { TcpConnectionState } from '@tcpkit/tcp-client';
import { JsonPayloadValidator } from '@tcpkit/core';
import type { TcpKitConfiguration } from '@tcpkit/core';

interface TcpKitTuiProperties {
  tcpKitConfiguration: TcpKitConfiguration;
}

export function TcpKitTui({ tcpKitConfiguration }: TcpKitTuiProperties) {
  const { exit } = useApp();
  const tcpClient = useMemo(
    () =>
      new TcpClient(tcpKitConfiguration.tcpEndpoint, {
        connectionTimeout: tcpKitConfiguration.connectionTimeout,
        requestTimeout: tcpKitConfiguration.requestTimeout,
        maximumPayloadSize: tcpKitConfiguration.maximumPayloadSize,
        transport: tcpKitConfiguration.transport,
        debug: tcpKitConfiguration.debug,
        logFile: tcpKitConfiguration.logFile,
      }),
    [tcpKitConfiguration],
  );

  const jsonPayloadValidator = useMemo(() => new JsonPayloadValidator(), []);

  const [connectionState, setConnectionState] = useState<string>(
    TcpConnectionState.DISCONNECTED,
  );
  const [pattern, setPattern] = useState('ping');
  const [payloadInput, setPayloadInput] = useState('{\n  "id": 123\n}');
  const [focusedField, setFocusedField] = useState<'pattern' | 'payload'>(
    'pattern',
  );
  const [isSending, setIsSending] = useState(false);
  const [responseText, setResponseText] = useState('Awaiting request...');
  const [responseTime, setResponseTime] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const endpointLabel = `${tcpKitConfiguration.tcpEndpoint.host}:${tcpKitConfiguration.tcpEndpoint.port}`;

  useEffect(() => {
    let cancelled = false;
    setConnectionState(TcpConnectionState.CONNECTING);
    tcpClient
      .connect()
      .then(() => {
        if (!cancelled) setConnectionState(TcpConnectionState.CONNECTED);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setConnectionState(TcpConnectionState.ERROR);
          setConnectionError(error.message);
        }
      });
    return () => {
      cancelled = true;
      void tcpClient.close();
    };
  }, [tcpClient]);

  const handleSendRequest = async () => {
    if (isSending) return;
    setValidationError(null);
    setConnectionError(null);
    setResponseTime(null);

    let parsedPayload: unknown;
    try {
      parsedPayload = jsonPayloadValidator.validate(payloadInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setValidationError(message);
      setResponseText(message);
      return;
    }

    if (!pattern.trim()) {
      setValidationError('Pattern is required');
      setResponseText('Pattern is required');
      return;
    }

    setIsSending(true);
    setResponseText('Sending request...');
    const startTime = Date.now();

    try {
      const tcpResponse = await tcpClient.send(pattern.trim(), parsedPayload);
      const durationMs = Date.now() - startTime;
      setResponseTime(`${durationMs}ms`);
      setConnectionState(tcpClient.getConnectionState());
      setResponseText(JSON.stringify(tcpResponse, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponseText(
        `Error: ${message}\n\nEnsure:\n- target is running on ${endpointLabel}\n- pattern "${pattern}" is handled`,
      );
      setConnectionState(TcpConnectionState.ERROR);
      setConnectionError(message);
    } finally {
      setIsSending(false);
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      void tcpClient.close();
      exit();
      return;
    }

    if (key.tab) {
      setFocusedField((previous) =>
        previous === 'pattern' ? 'payload' : 'pattern',
      );
      return;
    }

    if (key.return) {
      void handleSendRequest();
      return;
    }

    if (key.escape) {
      setFocusedField('pattern');
      return;
    }

    if (focusedField === 'pattern') {
      if (key.backspace || key.delete) {
        setPattern((previous) => previous.slice(0, -1));
      } else if (key.return) {
        void handleSendRequest();
      } else if (input && !key.ctrl && !key.meta) {
        setPattern((previous) => previous + input);
      }
    } else {
      if (key.backspace || key.delete) {
        setPayloadInput((previous) => previous.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        if (input === '\r') {
          setPayloadInput((previous) => previous + '\n');
        } else {
          setPayloadInput((previous) => previous + input);
        }
      } else if (key.return) {
        setPayloadInput((previous) => previous + '\n');
      }
    }
  });

  const connectionColor =
    connectionState === TcpConnectionState.CONNECTED
      ? 'green'
      : connectionState === TcpConnectionState.CONNECTING
        ? 'yellow'
        : connectionState === TcpConnectionState.ERROR
          ? 'red'
          : 'gray';

  const statusDot =
    connectionState === TcpConnectionState.CONNECTED
      ? '●'
      : connectionState === TcpConnectionState.CONNECTING
        ? '◐'
        : '○';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width={80}
    >
      <Box justifyContent="center">
        <Text bold color="cyan">
          TCP KIT
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyanBright">
          Endpoint
        </Text>
        <Box gap={1}>
          <Text color={connectionColor}>{statusDot}</Text>
          <Text color={connectionColor}>{connectionState}</Text>
        </Box>
        <Text>{endpointLabel}</Text>
        {connectionError ? <Text color="red">{connectionError}</Text> : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyanBright">
          Pattern {focusedField === 'pattern' ? '◀' : ''}
        </Text>
        <Box
          borderStyle="single"
          borderColor={focusedField === 'pattern' ? 'cyan' : 'gray'}
          paddingX={1}
        >
          <Text color={focusedField === 'pattern' ? 'white' : 'gray'}>
            {pattern || ' '}
          </Text>
          {focusedField === 'pattern' && !isSending ? (
            <Text color="cyan">▋</Text>
          ) : null}
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyanBright">
          Payload (JSON) {focusedField === 'payload' ? '◀' : ''}
        </Text>
        <Box
          borderStyle="single"
          borderColor={focusedField === 'payload' ? 'cyan' : 'gray'}
          paddingX={1}
          flexDirection="column"
        >
          <Text>{payloadInput || ' '}</Text>
          {focusedField === 'payload' && !isSending ? (
            <Text color="cyan">▋</Text>
          ) : null}
        </Box>
        {validationError ? <Text color="red">{validationError}</Text> : null}
      </Box>

      <Box marginTop={1} gap={1}>
        <Text color="gray">Enter → Send</Text>
        <Text color="gray">Tab → Switch field</Text>
        <Text color="gray">Ctrl+C → Exit</Text>
      </Box>

      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={1}
      >
        <Box justifyContent="space-between">
          <Text bold color="cyanBright">
            Response
          </Text>
          {responseTime ? (
            <Text color="yellow">⏱ {responseTime}</Text>
          ) : isSending ? (
            <Text color="yellow">sending...</Text>
          ) : null}
        </Box>
        <Box marginTop={1}>
          <Text>{responseText}</Text>
        </Box>
      </Box>
    </Box>
  );
}
