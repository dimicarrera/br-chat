/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'components-must-not-touch-api',
      from: { path: '^components' },
      to: { path: '^app/api' },
    },
    {
      name: 'storage-is-pure',
      from: { path: '^lib/storage' },
      to: { path: '^lib/llm' },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.(d\\.ts|spec\\.ts|test\\.ts|spec\\.tsx|test\\.tsx)$',
          '^(evals|node_modules)/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
