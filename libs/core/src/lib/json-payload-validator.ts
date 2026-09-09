export class InvalidJsonPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJsonPayloadError';
  }
}

export class JsonPayloadValidator {
  validate(rawPayload: string): unknown {
    const trimmedPayload = rawPayload.trim();
    if (trimmedPayload === '') return {};

    try {
      return JSON.parse(trimmedPayload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new InvalidJsonPayloadError(`Invalid JSON\n\n${errorMessage}`);
    }
  }

  isValidJson(rawPayload: string): boolean {
    try {
      this.validate(rawPayload);
      return true;
    } catch {
      return false;
    }
  }

  formatValidationError(rawPayload: string): string | null {
    try {
      this.validate(rawPayload);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
}
