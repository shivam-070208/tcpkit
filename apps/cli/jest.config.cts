const { readFileSync } = require('fs');
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);
swcJestConfig.swcrc = false;
module.exports = {
  displayName: 'cli',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest', swcJestConfig] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
