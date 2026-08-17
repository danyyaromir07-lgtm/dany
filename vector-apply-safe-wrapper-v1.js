import { applyVectorOCR as applyLegacyVectorOCR } from './vector-apply-v4.js?v=20260813-partialtoken1';
import { applySafeTitleblockCodes } from './vector-safe-titleblock-apply-v1.js?v=20260817-rotationfix1';
import { applySafeVerticalTitleblockCodes } from './vector-safe-titleblock-vertical-apply-v1.js?v=20260817-rotationfix1';
import { applyVerticalLongDrawingCodes } from './vector-longcode-vertical-apply-v2.js?v=20260817-legacyplacement1';

function normalizedCode(s) {
  return String(s || '').toUpperCase().replace(/O/g, '0');
}
function isShortStructuredCode(s) {
  const raw = String(s || '').trim();
  const parts = raw.split('_').filter(Boolean);
  const normalized = normalizedCode(raw);
  return raw.includes('_') && parts.length >= 2 && normalized.length >= 6 && normalized.length <= 22;
}
function longCodeKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/o/g, '0').replace(/i/g, '1');
}
function isLongDrawingCode(s) {
  const raw = String(s || '').trim();
  const parts = raw.split('_').filter(Boolean);
  const key = longCodeKey(raw);
  return raw.includes('_') && key.length >= 20 && key.length <= 90 && parts.length >= 5 && parts.every(part => /^[A-Za-z0-9.-]+$/.test(part));
}
function horizontalSafeAnalysis(analysis) {
  return {
    ...analysis,
    counts: (analysis?.counts || []).map(rule => {
      if (!isShortStructuredCode(rule?.find)) return rule;
      const ocrMatches = (rule.ocrMatches || []).filter(match => match?.verticalSafeTitleblockCode !== true);
      return { ...rule, ocrMatches, ocrCount: ocrMatches.length };
    }),
  };
}
function legacyAnalysis(analysis) {
  return {
    ...analysis,
    counts: (analysis?.counts || []).map(rule => {
      if (isShortStructuredCode(rule?.find)) return { ...rule, ocrMatches: [], ocrCount: 0 };
      if (isLongDrawingCode(rule?.find)) {
        const ocrMatches = (rule.ocrMatches || []).filter(match => match?.verticalLongDrawingCode !== true);
        return { ...rule, ocrMatches, ocrCount: ocrMatches.length };
      }
      return rule;
    }),
  };
}
export function applyVectorOCR(doc, analysis) {
  const safeHorizontal = applySafeTitleblockCodes(doc, horizontalSafeAnalysis(analysis)) || {};
  const safeVertical = applySafeVerticalTitleblockCodes(doc, analysis) || {};
  const longVertical = applyVerticalLongDrawingCodes(doc, analysis) || {};
  const legacy = applyLegacyVectorOCR(doc, legacyAnalysis(analysis)) || {};
  const safe = {
    count: Number(safeHorizontal.count || 0) + Number(safeVertical.count || 0),
    replacements: [...(safeHorizontal.replacements || []), ...(safeVertical.replacements || [])],
    skipped: [...(safeHorizontal.skipped || []), ...(safeVertical.skipped || [])],
    horizontal: safeHorizontal,
    vertical: safeVertical,
  };
  return {
    count: Number(safe.count || 0) + Number(longVertical.count || 0) + Number(legacy.count || 0),
    replacements: [...(safe.replacements || []), ...(longVertical.replacements || []), ...(legacy.replacements || [])],
    skipped: [...(safe.skipped || []), ...(longVertical.skipped || []), ...(legacy.skipped || [])],
    safeTitleblock: safe,
    longVertical,
    legacy,
  };
}
