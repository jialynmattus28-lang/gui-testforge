import { assertValidCases } from '../ir/index.mjs';

export function validateProviderProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') throw new Error('AI provider returned no proposal');
  assertValidCases(proposal.cases);
  if (proposal.reviewFindings !== undefined && !Array.isArray(proposal.reviewFindings)) {
    throw new Error('AI provider reviewFindings must be an array');
  }
  return structuredClone(proposal);
}

export function parseJsonContent(content) {
  if (typeof content !== 'string') throw new Error('AI provider returned no JSON content');
  const trimmed = content.trim();
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  try {
    return JSON.parse(unfenced);
  } catch (error) {
    throw new Error(`AI provider returned invalid JSON: ${error.message}`);
  }
}
