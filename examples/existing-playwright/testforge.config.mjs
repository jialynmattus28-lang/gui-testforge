export default {
  frozenAsset: './testforge/frozen/card-loss.json',
  outputDir: './tests/generated/testforge',
  testModule: './fixtures/test.mjs',
  driverModule: './testforge/gui-driver.mjs',
  playwrightConfig: './playwright.config.mjs',
  fileExtension: '.spec.mjs',
  fixtureNames: ['page', 'context', 'request', 'accountSession'],
};
