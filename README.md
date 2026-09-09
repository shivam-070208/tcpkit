# TCP Kit — Developer CLI/TUI for TCP Microservices

Local developer tool for communicating with TCP servers. Runs entirely on your machine, no backend, VPS, or cloud required.

```bash
npx tcpkit localhost:4000
```

## Overview

TCP Kit connects directly to a TCP endpoint from your machine:

```
User -> npx tcpkit <host>:<port> -> TCP (length-prefixed JSON) -> Microservice
```

V1 features:
- Endpoint parsing and validation (hostname, IPv4, IPv6)
- Length-prefixed JSON protocol (4-byte BE + UTF-8)
- TCP connection lifecycle with states DISCONNECTED/CONNECTING/CONNECTED/ERROR/CLOSING
- Request correlation via unique requestId
- JSON payload validation
- Interactive TUI (Ink) with pattern, payload, response, timing, errors
- Timeouts: connection 5s, request 30s, max payload 1 MB
- Concurrent requests and out-of-order handling
- No NestJS, no HTTP, pure `node:net`

## Installation

```bash
npm install -g tcpkit
# or
npx tcpkit localhost:4000
```

Local dev:

```bash
npm install
npx nx sync
```

## Quick Start

```bash
npx tcpkit localhost:4000
# connect to any reachable host
npx tcpkit 127.0.0.1:4000
npx tcpkit 192.168.1.20:4000
npx tcpkit my-service.local:5000
npx tcpkit [::1]:4000
```

TUI controls:
- `Tab` switch field (Pattern ↔ Payload)
- `Enter` send request
- `Ctrl+C` exit

## Endpoint Syntax

Endpoint is mandatory positional argument: `host:port`

Supported:

```text
localhost:4000
127.0.0.1:4000
192.168.1.20:8080
my-service.local:5000
[::1]:4000
[2001:db8::1]:4000
```

Validation rejects: `localhost`, `:4000`, `localhost:`, `localhost:abc`, `localhost:0`, `localhost:65536`, `[::1`, `::1]:4000`. Errors are specific, e.g. `Port must be a number between 1 and 65535.`

Parser does not use `split(":")`; IPv6 bracket notation is required.

## CLI Options

```bash
tcpkit <endpoint> [--connection-timeout <ms>] [--request-timeout <ms>]
```

```bash
tcpkit localhost:4000 --connection-timeout 5000
tcpkit localhost:4000 --request-timeout 30000
tcpkit localhost:4000 --connection-timeout=5000 --request-timeout=30000
```

`--help` and `--version` supported.

## Architecture

Integrated Nx workspace:

```
apps/cli      -> CLI entry, argument parser, Ink wiring
libs/core     -> Shared: TcpKitConfiguration, JsonPayloadValidator, Request models
libs/tcp-client -> TcpEndpointParser, TcpConnection, TcpClient, RequestCoordinator
libs/protocol    -> TcpFrameEncoder, TcpFrameDecoder (4-byte length prefix)
libs/tui      -> TcpKitTui (Ink + React)
```

Dependency direction: `CLI -> Core -> {TCP Client, Protocol, TUI}` with no cycles, core re-exports endpoint/client, TCP client uses protocol framing via `node:net`.

Protocol frame:

```
| 4-byte BE length | UTF-8 JSON payload |
```

Request:

```json
{ "requestId": "req_...", "pattern": "getUser", "payload": { "id": 123 } }
```

Response:

```json
{ "requestId": "req_...", "success": true, "payload": { "id": 123, "name": "Vishu" } }
```

## Development

```bash
npx nx build @tcpkit/protocol
npx nx build @tcpkit/tcp-client
npx nx build @tcpkit/core
npx nx build @tcpkit/tui
npx nx build tcpkit

npx nx test @tcpkit/protocol
npx nx test @tcpkit/tcp-client
npx nx test @tcpkit/core
npx nx test tcpkit
npx nx run-many -t test

npx nx lint tcpkit
npx nx typecheck tcpkit
npx nx graph
npx nx sync
```

## Testing

- Unit: endpoint parser (valid/invalid, IPv6), protocol (serialize, incomplete, multiple, malformed, oversized), JSON validator (objects/arrays/primitives/nested/malformed), CLI parser
- Integration: real `node:net` server + `TcpClient` for connection, framing, concurrent, out-of-order, timeout, closure

```bash
npx nx run-many -t test --parallel=3
```

## Build

```bash
npx nx build tcpkit   # outputs apps/cli/dist with bin: tcpkit -> dist/main.js
node apps/cli/dist/main.js --help
```

Published package (`apps/cli/package.json` name `tcpkit`) exposes:

```json
{ "bin": { "tcpkit": "./dist/main.js" } }
```

Usage after publish:

```bash
npx tcpkit localhost:4000
npm install -g tcpkit
tcpkit localhost:4000
```

Artifact contains only runtime `dist` files, no Nx workspace required at runtime.

## Publishing

```bash
npx nx build tcpkit
npx nx release --dry-run
npx nx release # versions and publishes @tcpkit/* and tcpkit
```

Or manual for CLI only:

```bash
cd apps/cli
npm publish --access public
```

## Errors

Domain errors: `InvalidTcpEndpointError`, `InvalidTcpPortError`, `TcpConnectionError`, `TcpConnectionTimeoutError`, `TcpProtocolError`, `InvalidJsonPayloadError`, `TcpRequestTimeoutError`, `TcpSocketClosedError`, `TcpOversizedPayloadError`.

Technical errors are translated to user-friendly TUI messages at presentation boundary.
