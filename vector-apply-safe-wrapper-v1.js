import { applyVectorOCR as applyLegacyVectorOCR } from './vector-apply-v4.js?v=20260813-partialtoken1';
import { applySafeTitleblockCodes } from './vector-safe-titleblock-apply-v1.js?v=20260817-safecode2';

function normalizedCode(s) {
  return String(s || '').toUpperCase().replace(/O/g, '0');
}
function isShortStructuredCode(s) {
  const raw = String(s || '').trim();
  const parts = raw.split('_').filter(Boolean);
  const normalized = normalizedCode(raw);
  return raw.includes('_') && parts.length >= 2 && normalized.length >= 6 && normalized.length <= 22;
}
function legacyAnalysis(analysis) {
  return {
    ...analysis,
    counts: (analysis?.counts || []).map(rule => {
      if (!isShortStructuredCode(rule?.find)) return rule;
      return { ...rule, ocrMatches: [], ocrCount: 0 };
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
