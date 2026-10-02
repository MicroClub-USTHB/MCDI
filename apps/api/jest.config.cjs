module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [require.resolve('ts-jest'), {}],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.module.ts',
    '!**/*.entity.ts',
    '!**/*.factory.ts',
    '!**/database/entities/index.ts',
    '!**/database/seeders/**',
    '!**/database/seed.ts',
    '!**/database/clear.ts',
    '!**/*.config.ts',
    '!**/config.module.ts',
    '!**/main.ts',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 75,
      branches: 68,
      statements: 80,
    },
  },
  testEnvironment: 'node',
};
