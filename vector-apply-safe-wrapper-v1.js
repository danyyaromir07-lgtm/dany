import { applyVectorOCR as applyLegacyVectorOCR } from './vector-apply-v4.js?v=20260813-partialtoken1';
import { applySafeTitleblockCodes } from './vector-safe-titleblock-apply-v1.js?v=20260817-safecode1';

const normKey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/o/g, '0');
function shortStructuredCode(s) {
  const raw = String(s || '').trim();
  const parts = raw.split('_').filter(Boolean);
  const k = normKey(raw);
  return raw.includes('_') && parts.length >= 2 && k.length >= 6 && k.length <= 18;
}

function legacyAnalysis(analysis) {
  return {
    ...analysis,
    counts: (analysis?.counts || []).map(rule => {
      const protectedCode = shortStructuredCode(rule?.find);
      const matches = (rule?.ocrMatches || []).filter(m => !protectedCode && m?.safeTitleblockCode !== true);
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
