export interface TcpKitRequest {
  requestId: string;
  pattern: string;
  payload: unknown;
}

export interface TcpKitResponse {
  requestId: string;
  success: boolean;
  payload?: unknown;
  error?: string;
}
