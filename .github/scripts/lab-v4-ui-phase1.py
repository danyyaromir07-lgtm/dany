from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
marker='\nasync function renderPage(){'
if marker not in s:
    raise SystemExit('renderPage marker missing')
api=r'''
// LAB UI phase 1: read-only state bridge + explicit selection reset.
// Does not change mapping, deletion, verification, saving, or indexing algorithms.
function clearVisualSelectionUI(){
 visualSelected=[];structSelected=[];selectionMapSafe=false;selectionFamilies=0;selectionAlternatives=[];
 drawSelection();setButtons();
 if(doc)status.textContent=indexReady?'Selección limpiada · índice estructural listo.':'Selección limpiada · preparando índice estructural…';
}
window.selectorPhase1={
 clearSelection:clearVisualSelectionUI,
 getState:()=>({
  hasDocument:!!doc,
  selected:Number(visualSelected.length||0),
  visualTotal:Number(classicVisual.length||0),
  structuralTotal:Number(model?.strokes?.length||0),
  indexReady:!!indexReady,
  analysisReady:!!analysisReady,
  structuralIncomplete:!!model?.incomplete,
  pending:!!pending
 })
};
'''
if 'window.selectorPhase1=' not in s:
    s=s.replace(marker,'\n'+api+marker,1)
for q in ['window.selectorPhase1=','clearVisualSelectionUI','strictCompactBandedMap','Sin rutas alternativas ni causal.']:
    if q not in s:
        raise SystemExit('missing invariant: '+q)
p.write_text(s)
