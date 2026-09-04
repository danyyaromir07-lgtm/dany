// DanForge PDF theme only. Visual overrides; no PDF logic, state, IDs, or event handlers are changed.
const THEME_ID='danforge-blue-theme-v1';
if(!document.getElementById(THEME_ID)){
  const style=document.createElement('style');
  style.id=THEME_ID;
  style.textContent=`
:root{
  --primary:#1769b0;
  --primary2:#0d4f8f;
}
.brand-mark{box-shadow:0 8px 22px rgba(23,105,176,.20)}
.dropzone{border-color:#abcbe6;background:linear-gradient(180deg,#fff,#f8fbfe);box-shadow:inset 0 0 0 1px rgba(23,105,176,.025)}
.dropzone:hover,.dropzone.dragging{border-color:#1769b0;background:#f5faff;box-shadow:inset 0 0 0 1px rgba(23,105,176,.08),0 8px 24px rgba(23,105,176,.06)}
.drop-icon{background:linear-gradient(135deg,#1769b0,#2f86cc);box-shadow:0 8px 18px rgba(23,105,176,.18)}
.selected-count{border-color:#c8dced;background:#f5faff;color:#175589}
.selected-file-count{border-color:#c8dced;background:#f5faff;color:#175589}
.selected-file-count.has-files{background:#eaf4fb;color:#104f82}
.text-fields input:focus,.batch-rule input:focus{border-color:#2f7fbe;box-shadow:0 0 0 3px rgba(23,105,176,.09)}
.panel-title span{color:#1769b0}
.option-box{border-color:#d3e2ef;background:#f8fbfe}
.info-box{border-color:#d7e6f2;background:#f8fbfe}
.info-box strong{color:#145b94}
.preview-note{border-color:#d4e4f0;background:#f7fbfe;color:#526b7d}
.progress-fill{background:linear-gradient(90deg,#1769b0,#3b92d1)}
button:focus-visible,input:focus-visible,summary:focus-visible{outline-color:rgba(23,105,176,.20)}
.primary{box-shadow:0 8px 20px rgba(23,105,176,.18)}
#analysisTool .analysis-grid .panel:nth-child(2) .option-box:has(input[type="checkbox"]:checked){border-color:#c7dceb;background:linear-gradient(180deg,#fbfdff 0,#f5faff 100%)}
#analysisTool .analysis-grid .panel:nth-child(2) .option-box input[type="checkbox"]:checked{background:linear-gradient(135deg,#1769b0,#2f86cc);box-shadow:inset 0 1px 2px rgba(31,42,68,.08),0 0 0 3px rgba(23,105,176,.08)}
#analysisTool .analysis-grid .panel:nth-child(2) .option-box input[type="checkbox"]:focus-visible{outline-color:rgba(23,105,176,.20)}
#previewOriginalBtn.primary,#previewResultBtn.primary{color:#124f7f;border-color:#c6dceb}
`;
  document.head.appendChild(style);
}
