# Foxit-style compact index laboratory

This branch is isolated from production (`gh-pages`).

Validated synthetic cases:
- cross-stream path spanning multiple `/Contents` streams;
- reused Form XObject: partial instance deletion blocked, complete shared selection allowed;
- exact transactional delete + reopen verification.

120k-stroke performance gate on GitHub Actions runner:
- visual extraction: ~703 ms;
- compact structural index: ~948 ms;
- mapping 96 selected strokes: ~0.301 ms;
- cached-index exact delete + save/reopen verification: ~2116 ms;
- 24 content streams touched;
- RSS observed: 292 MB before delete, 498 MB after verification.

Production remains at `stable/v2.0` until candidate UI integration is tested.
