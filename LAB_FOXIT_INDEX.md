# Lab Foxit-like structural index

Branch: `lab/foxit-index-v3`
Base: `stable/v2.0` (`e3bc533784d9ed581e6970d66b82d89a0f8521c1`)

Goal: move visual-to-structural identity work to PDF open/index time so Delete becomes one direct edit plus one exact verification. No 23-route retry loop, no causal fallback, no second save strategy.

## First isolated benchmarks

Benchmarked a compact JavaScript content-stream scanner outside the public tool. It keeps only compact geometry/source descriptors rather than a second full `deepModel()` object graph.

- `UP3_LIM_O03_PLA_I58_03_ER_00_ZZ_0002.pdf`: 2,230 `/Contents` streams, 10,887,721 decoded stream bytes, 145,409 stroked paths, 458,018 edit ranges. Structural pass: ~909 ms in Node; heap after pass ~39 MB.
- `UP3_LIM_E03_PLA_E07_04_ER_ZZ_ZZ_5111.pdf`: 8 `/Contents` streams, 1,075,576 decoded stream bytes, 3,317 stroked paths, 12,209 edit ranges, including 2 paths spanning multiple streams. Structural pass: ~83 ms in Node; heap after pass ~7 MB.
- Raw tokenizer benchmark on the 10.9 MB / 2,230-stream case: 2,734,832 tokens, 1,185,304 operators in ~401 ms.

These are parser/index benchmarks, not yet browser end-to-end deletion timings. They establish that scanning the page structure once is feasible; the previous multi-minute delay came from repeated full mappings/copies/verifications, not from the stream scan itself.

## Candidate architecture under test

1. Collect visual paths once.
2. Build a compact geometry-signature bucket for visual ordinals.
3. Deep-scan `/Contents` and nested Form XObjects once while preserving transforms and multi-stream edit ranges.
4. Match each structural path to a visual ordinal during that scan; retain only the exact source descriptor needed for later editing.
5. Track shared Form/XObject source ranges so partial instance deletion is blocked unless it can be isolated safely.
6. On Delete: selected ordinals -> exact source ranges -> one working copy -> one transactional edit -> exact `original - blue` verification -> one save/reopen verification.
7. If an exact unique mapping is unavailable, fail fast instead of trying alternative routes or causal search.

Public `gh-pages` remains untouched while this lab is being validated.
