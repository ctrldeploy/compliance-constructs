module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    collectCoverageFrom: ['lib/**/*.ts', '!lib/app.ts'],
    coverageReporters: ['text-summary', 'lcov'],
};
