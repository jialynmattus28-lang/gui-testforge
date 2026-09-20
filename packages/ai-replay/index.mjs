import { readFile } from 'node:fs/promises';
import { validateProviderProposal } from '../ai-provider/index.mjs';

export function createReplayProvider({ recordingPath }) {
  if (!recordingPath) throw new Error('ReplayProvider requires a recordingPath');

  async function load() {
    const parsed = JSON.parse(await readFile(recordingPath, 'utf8'));
    return validateProviderProposal({ ...parsed, source: 'offline-replay' });
  }

  return {
    id: 'offline-replay',
    status() {
      return { id: 'offline-replay', configured: true, networkRequired: false };
    },
    async healthCheck() {
      await load();
      return { ok: true, networkUsed: false };
    },
    async generateTestIR() {
      return load();
    },
    async reviewTestIR() {
      const proposal = await load();
      return { source: proposal.source, findings: structuredClone(proposal.reviewFindings ?? []) };
    },
    async refineTestIR({ testCase }) {
      return { source: 'offline-replay', testCase: structuredClone(testCase) };
    },
  };
}
