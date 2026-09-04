// Additive dispatcher for heavy Type0 text.
// Stable exact-Tj v3 is always attempted first and remains unchanged.
import { editHeavyTextFlate as editStableExactTj } from './text-editor-heavy-flate-v3.js?v=20260822-type0struct-stable1';
import { editHeavyTextFlateSubstring } from './text-editor-heavy-flate-substring-v1.js?v=20260822-substring1';

function exactFamilySafelyDeclined(result, expected) {
  if (result?.verified === true) return false;
  if (Number(result?.count || 0) !== 0 || Number(result?.found || 0) !== 0) return false;
  const reason = String(result?.reason || '');
  return reason === `Tj Type0 probados=0, esperados=${Number(expected || 0)}; no se modifica el PDF`;
}

export async function editHeavyTextFlate(doc, needle, replacement, expected = 0, fileName = '') {
  const stable = await editStableExactTj(doc, needle, replacement, expected, fileName);
  if (stable?.verified === true || !exactFamilySafelyDeclined(stable, expected)) return stable;
  return editHeavyTextFlateSubstring(doc, needle, replacement, expected, fileName);
}
