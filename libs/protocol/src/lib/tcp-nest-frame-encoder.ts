export class TcpNestFrameEncoder {
  serialize(message: unknown): Buffer {
    const jsonString = JSON.stringify(message);
    const framedString = `${jsonString.length}#${jsonString}`;
    return Buffer.from(framedString, 'utf8');
  }
}
