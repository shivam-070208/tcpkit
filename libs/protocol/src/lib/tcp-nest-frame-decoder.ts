export class TcpNestFrameDecoder {
  private stringBuffer = '';
  private contentLength: number | null = null;

  push(tcpChunk: Buffer): unknown[] {
    const chunkString = tcpChunk.toString('utf8');
    this.stringBuffer += chunkString;
    const decodedMessages: unknown[] = [];

    while (true) {
      if (this.contentLength === null) {
        const delimiterIndex = this.stringBuffer.indexOf('#');
        if (delimiterIndex === -1) {
          break;
        }
        const rawContentLength = this.stringBuffer.substring(0, delimiterIndex);
        const parsedLength = parseInt(rawContentLength, 10);
        if (isNaN(parsedLength)) {
          this.contentLength = null;
          this.stringBuffer = '';
          throw new Error(`Corrupted packet length: ${rawContentLength}`);
        }
        this.contentLength = parsedLength;
        this.stringBuffer = this.stringBuffer.substring(delimiterIndex + 1);
      }

      if (this.contentLength !== null) {
        if (this.stringBuffer.length < this.contentLength) {
          break;
        }
        if (this.stringBuffer.length === this.contentLength) {
          const messageString = this.stringBuffer;
          this.contentLength = null;
          this.stringBuffer = '';
          decodedMessages.push(JSON.parse(messageString));
          break;
        }
        const messageString = this.stringBuffer.substring(0, this.contentLength);
        const rest = this.stringBuffer.substring(this.contentLength);
        decodedMessages.push(JSON.parse(messageString));
        this.contentLength = null;
        this.stringBuffer = rest;
      }
    }

    return decodedMessages;
  }

  clear(): void {
    this.stringBuffer = '';
    this.contentLength = null;
  }
}
