# TCP Kit — Developer CLI/TUI for TCP Microservices

Local developer tool for communicating with TCP servers. Runs entirely on your machine, no backend, VPS, or cloud required.

```bash
npx tcpkit localhost:4000
npx tcpkit localhost:3001 --transport nest
```

## Overview

TCP Kit connects directly to a TCP endpoint from your machine:

```
User -> npx tcpkit <host>:<port> [--transport nest] -> TCP -> Microservice
```

V1 features:

- Endpoint parsing and validation (hostname, IPv4, IPv6, bracket `[::1]:4000`, no `split(":")`)
- Two transports: `tcpkit` (4-byte BE length + JSON) and `nest` (NestJS `length#json` with `{id,pattern,data}`)
- TCP connection lifecycle `DISCONNECTED/CONNECTING/CONNECTED/ERROR/CLOSING`
- Request correlation via `requestId`/`id`, supports concurrent and out-of-order
- JSON payload validation with `JsonPayloadValidator`
- Interactive TUI (Ink) with pattern, payload, response, timing, errors
- Timeouts: connection 5s, request 30s, max payload 1 MB (centralized `TcpKitConfiguration`)
- Debug logger `TcpDebugLogger` to `stderr` + file (`--debug`, `--log-file`, `TCPKIT_DEBUG=1`)
- No HTTP, pure `node:net`

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
npx tcpkit localhost:3001 --transport nest --debug
npx tcpkit 127.0.0.1:4000 --transport nest
npx tcpkit 192.168.1.20:4000
npx tcpkit my-service.local:5000
npx tcpkit [::1]:4000 --transport nest
```

TUI controls:

- `Tab` switch field (Pattern ↔ Payload)
- `Enter` send request
- `Ctrl+C` exit

## Endpoint Syntax

Endpoint is mandatory positional: `host:port`

Supported:

```text
localhost:4000
127.0.0.1:4000
192.168.1.20:8080
my-service.local:5000
[::1]:4000
[2001:db8::1]:4000
```

Validation rejects: `localhost`, `:4000`, `localhost:`, `localhost:abc`, `localhost:0`, `localhost:65536`, `[::1`, `::1]:4000`. Example: `Port must be a number between 1 and 65535.`

## CLI Options

```bash
tcpkit <endpoint> [--connection-timeout <ms>] [--request-timeout <ms>] [--transport <tcpkit|nest>] [--debug] [--log-file <path>]
```

```bash
tcpkit localhost:4000 --connection-timeout 5000
tcpkit localhost:4000 --request-timeout 30000
tcpkit localhost:3001 --transport nest
tcpkit localhost:3001 --transport nest --debug --log-file ./tcpkit.log
tcpkit 13.127.85.156:32003 --transport nest --request-timeout 60000
TCPKIT_DEBUG=1 tcpkit localhost:3001 --transport nest
TCPKIT_LOG_FILE=./debug.log tcpkit localhost:3001 --transport nest
```

`--help` and `--version` supported.

## Architecture

Integrated Nx workspace:

```
apps/cli       -> CLI entry, CliArgumentParser, Ink wiring
libs/core      -> Shared: TcpKitConfiguration, JsonPayloadValidator, Request models
libs/tcp-client -> TcpEndpointParser, TcpConnection, TcpClient, TcpRequestCoordinator, TcpDebugLogger
libs/protocol   -> TcpFrameEncoder/Decoder (4-byte), TcpNestFrameEncoder/Decoder (length#json)
libs/tui       -> TcpKitTui (Ink + React)
```

Dependency: `CLI -> Core -> {TCP Client, Protocol, TUI}` no cycles. `TcpClient` uses `transport` to select framing and packet shape (`{requestId,pattern,payload}` vs Nest `{id,pattern,data}` → normalized to `{requestId,success,payload}`).

Protocol frames:

```
tcpkit: | 4-byte BE length | UTF-8 JSON |
nest:   | "<len>#<json>" |  # e.g. 23#{"id":"...","pattern":"ping","data":{}}
```

Request/response examples:

```json
// tcpkit
{ "requestId": "req_...", "pattern": "getUser", "payload": { "id": 123 } }
{ "requestId": "req_...", "success": true, "payload": { "id": 123, "name": "Vishu" } }
// nest (wire)
{ "id": "req_...", "pattern": "CustomerGroupInternalController.getCustomersByGroupId", "data": { "companyId":"19","groupId":421 } }
{ "id": "req_...", "response": { "count":5, "rows":[...] }, "isDisposed": true }
```

## Debugging

Enable verbose logs to `stderr` (does not break Ink `stdout` rendering):

```bash
tcpkit localhost:3001 --transport nest --debug
tcpkit localhost:3001 --transport nest --verbose --log-file ./tcpkit.log
TCPKIT_DEBUG=1 tcpkit localhost:3001 --transport nest
TCPKIT_LOG_FILE=./debug.log tcpkit localhost:3001 --transport nest
```

Logs: `TcpClient init`, `Connecting...`, `Connected in Xm`s, `Send start {requestId,pattern}`, `Serialized frame N bytes`, `Write success`, `Data received N bytes`, `Decoded N messages`, `Response received`.

Large Nest payloads (e.g. `groupId:419` → 132 rows, ~28KB, 28062#...) are logged truncated to 500 chars.

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
npx nx run-many -t test --parallel=3

npx nx lint tcpkit
npx nx typecheck tcpkit
npx nx graph
npx nx sync
```

## Testing

- Unit: endpoint parser (valid/invalid, IPv6), protocol (serialize, incomplete, multiple, malformed, oversized, nest framing), JSON validator, CLI parser
- Integration: real `node:net` server + `TcpClient` (tcpkit and nest) for connection, framing, concurrent, out-of-order, timeout, closure

```bash
npx nx run-many -t test --parallel=3
```

CI runs on every push to `main`/`master` and every PR (`/.github/workflows/ci.yml:1`):

```yaml
on:
  {
    push: { branches: [main, master] },
    pull_request: { branches: [main, master] },
  }
jobs:
  {
    build: npx nx run-many -t build,
    test: npx nx run-many -t test,
    lint+typecheck,
  }
```

## Build

```bash
npx nx build tcpkit   # outputs apps/cli/dist with bin: tcpkit -> dist/main.js
node apps/cli/dist/main.js --help
node apps/cli/dist/main.js localhost:3001 --transport nest --debug
```

Published package (`apps/cli/package.json` name `tcpkit`) exposes:

```json
{ "bin": { "tcpkit": "./dist/main.js" } }
```

Usage after publish:

```bash
npx tcpkit localhost:4000
npx tcpkit localhost:3001 --transport nest
npm install -g tcpkit
tcpkit localhost:4000 --debug
```

Artifact contains only runtime `dist` files, no Nx workspace required.

## CI/CD

- **CI** `/.github/workflows/ci.yml:1` — runs `build` + `test` + `lint` + `typecheck` on `main`/`master` and PRs, with `nx sync:check` and `format:check`.
- **Release** `/.github/workflows/release.yml:1` — on `push` to `main` or `workflow_dispatch` (dry_run toggle), does `npx nx sync`, `build`, `npx nx release --dry-run`, `npx nx release --verbose` with `NPM_TOKEN`/`NODE_AUTH_TOKEN` and `provenance`. Requires GitHub secret `NPM_TOKEN` (npm Automation token) and `contents:write` + `id-token:write`.

## Publishing

```bash
npx nx build tcpkit
npx nx release --dry-run
npx nx release # versions and publishes @tcpkit/* and tcpkit (topological)
```

Or manual:

```bash
cd libs/protocol && npm publish --access public
cd ../tcp-client && npm publish --access public
cd ../core && npm publish --access public
cd ../tui && npm publish --access public
cd ../../apps/cli && npm publish --access public
```

## Errors

Domain errors: `InvalidTcpEndpointError`, `InvalidTcpPortError`, `TcpConnectionError`, `TcpConnectionTimeoutError`, `TcpProtocolError`, `InvalidJsonPayloadError`, `TcpRequestTimeoutError`, `TcpSocketClosedError`, `TcpOversizedPayloadError`.

Technical errors are translated to user-friendly TUI messages at presentation boundary. Use `--debug` to see raw protocol errors.
