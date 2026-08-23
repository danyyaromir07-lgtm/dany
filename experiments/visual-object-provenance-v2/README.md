# Visual Object Provenance Lab v2

Independent experimental prototype.

This version intentionally removes revision-cloud classification and target-color inference.

## Interaction

1. Load a PDF page.
2. Paint only the visible strokes/pixels you want to remove.
3. Analyze the painted mask.
4. The lab maps stroked page-content paths whose rendered bounding boxes touch the mask.
5. Cross-stream paths and parser-unsafe pages fail closed.
6. Simulation revalidates exact `streamIndex + byte span` targets.
7. The output is re-rendered and compared against the user-painted mask.
8. Any significant changed pixel outside the painted mask rejects the output.
9. Download is enabled only when the counterfactual render passes.

## Current limits

- Page `/Contents` strokes only.
- Form XObjects are not mutated.
- Cross-stream paths are detected but not mutated.
- The current candidate prefilter uses rendered path bounding boxes touching the mask.
- Text, images and fills are never selected by this prototype.
- This is a laboratory artifact and is not connected to production.
