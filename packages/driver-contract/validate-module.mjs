import { pathToFileURL } from 'node:url';
import { assertDriverFactory } from './index.mjs';

const modulePath = process.argv[2];
if (!modulePath) throw new Error('GUI Driver module path is required');

assertDriverFactory(await import(`${pathToFileURL(modulePath).href}?checked=${Date.now()}`));
