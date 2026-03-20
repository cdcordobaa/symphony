module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.steps.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          verbatimModuleSyntax: false,
          esModuleInterop: true,
        },
      },
    ],
  },
};
