import { JsonPayloadValidator, InvalidJsonPayloadError } from './json-payload-validator.js';

describe('JsonPayloadValidator', () => {
  const validator = new JsonPayloadValidator();

  it('should validate object', () => {
    expect(validator.validate('{"a":1}')).toEqual({ a: 1 });
  });

  it('should validate array', () => {
    expect(validator.validate('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('should validate primitives', () => {
    expect(validator.validate('"hello"')).toEqual('hello');
    expect(validator.validate('123')).toEqual(123);
    expect(validator.validate('true')).toEqual(true);
    expect(validator.validate('null')).toEqual(null);
  });

  it('should validate nested JSON', () => {
    expect(validator.validate('{"a":{"b":[1,2]}}')).toEqual({ a: { b: [1, 2] } });
  });

  it('should return empty object for empty', () => {
    expect(validator.validate('')).toEqual({});
    expect(validator.validate('   ')).toEqual({});
  });

  it('should throw for malformed JSON', () => {
    expect(() => validator.validate('{invalid}')).toThrow(InvalidJsonPayloadError);
  });

  it('should provide meaningful error', () => {
    try {
      validator.validate('{"a":}');
      fail('should throw');
    } catch (error) {
      expect((error as Error).message).toContain('Invalid JSON');
    }
  });
});
