// Single Jest entry point: `npm test` runs both projects,
// `npm run test:unit` / `npm run test:e2e` select one (see README).
const base = {
  // isolatedModules (tsconfig) makes ts-jest transpile only (fast); `npm run typecheck` covers types
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    { ...base, displayName: 'e2e', testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'] },
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
};
