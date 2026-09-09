import { JsonPayloadValidator } from './json-payload-validator.js';
describe('core', () => {
  it('should validate json', () => {
    const v = new JsonPayloadValidator();
    expect(v.validate('{"a":1}')).toEqual({ a: 1 });
  });
});
