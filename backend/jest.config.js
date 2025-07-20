module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 60000, // Increased for CI environments
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.ts',
  // Better output for CI
  verbose: process.env.CI ? true : false,
  // Prevent hanging in CI
  forceExit: process.env.CI ? true : false,
  // Disable parallelization in CI for stability
  maxWorkers: process.env.CI ? 1 : '50%',
}; 