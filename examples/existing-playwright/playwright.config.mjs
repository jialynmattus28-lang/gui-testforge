import { defineConfig } from '@playwright/test';

const reporter = [['line']];
if (process.env.GUI_TESTFORGE_PROGRESS_REPORT) reporter.push(['./testforge/progress-reporter.mjs']);
if (process.env.GUI_TESTFORGE_JSON_REPORT) {
  reporter.push(['json', { outputFile: process.env.GUI_TESTFORGE_JSON_REPORT }]);
}
reporter.push(['html', {
  outputFolder: process.env.GUI_TESTFORGE_HTML_REPORT ?? '.playwright-report',
  open: 'never',
}]);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter,
  use: {
    baseURL: process.env.GUI_TESTFORGE_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
