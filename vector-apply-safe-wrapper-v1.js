import { applyVectorOCR as applyLegacyVectorOCR } from './vector-apply-v4.js?v=20260813-partialtoken1';
import { applySafeTitleblockCodes } from './vector-safe-titleblock-apply-v1.js?v=20260817-safecode1';

function legacyAnalysis(analysis) {
  return {
    ...analysis,
    counts: (analysis?.counts || []).map(rule => {
      const matches = (rule?.ocrMatches || []).filter(m => m?.safeTitleblockCode !== true);
      return { ...rule, ocrMatches: matches, ocrCount: matches.length };
    }),
  };
}

export function applyVectorOCR(doc, analysis) {
  const safe = applySafeTitleblockCodes(doc, analysis) || {};
  const legacy = applyLegacyVectorOCR(doc, legacyAnalysis(analysis)) || {};
  return {
    count: Number(safe.count || 0) + Number(legacy.count || 0),
    replacements: [...(safe.replacements || []), ...(legacy.replacements || [])],
    skipped: [...(safe.skipped || []), ...(legacy.skipped || [])],
    safeTitleblock: safe,
    legacy,
  };
}
