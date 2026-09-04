// Eligibility gate for the partial TrueType literal-Tj heavy editor.
// Different-length replacements are not an error for this family: they are simply ineligible
// and must be left to the other heavy text engines.
import { editHeavyTrueTypeLiteralTjPartial as editV8 } from './text-editor-heavy-flate-v8-truetype-literal-tj.js?v=20260904-mixedfont1-base';

export async function editHeavyTrueTypeLiteralTjPartial(doc, needle, replacement, maxExpected=0, fileName='', allowAllFlate=false){
  if(String(needle||'').length!==String(replacement||'').length){
    return {count:0, found:0, verified:false, ineligible:true, reason:'sin Tj literal TrueType elegible: reemplazo de distinta longitud'};
  }
  return editV8(doc, needle, replacement, maxExpected, fileName, allowAllFlate);
}
