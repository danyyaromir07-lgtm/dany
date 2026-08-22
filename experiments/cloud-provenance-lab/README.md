# Cloud Visual -> Vector Provenance Lab

Experimental, isolated prototype. It is not imported by `main`, `index.html`, or the public PDF Tools page.

## Goal

1. Render a PDF page locally in the browser.
2. Detect visually cloud-like red components.
3. Parse page content streams and identify exact red stroke spans.
4. Link the visual candidate to exact PDF vector spans.
5. Revalidate those spans before mutation.
6. Simulate removing only those spans.
7. Reopen the output and compare before/after renders.
8. Reject the output if meaningful pixels changed outside the authorized cloud box.

## Safety boundaries in v0.1

- Page content streams only; Form XObjects are not mutated yet.
- Visual detection is red-stroke oriented in v0.1.
- Inline-image / parser-unsafe cases are marked unsafe.
- A visual candidate alone never authorizes deletion.
- Download is only enabled after a successful structural revalidation and render-diff check.
- The original file is never overwritten.

## Running

Serve this directory with any static HTTP server and open `cloud-provenance-lab.html`. The app loads MuPDF WASM/JS from jsDelivr and processes PDFs locally in the browser.
