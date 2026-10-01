module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': [require.resolve('ts-jest'), {}],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
  maxWorkers: 1,
};
