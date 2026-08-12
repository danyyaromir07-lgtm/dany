// Compatibility shim: the batch analyzer historically imports v2.
// Keep that import stable while routing recognition to the current OCR engine.
export { runRecognition } from './vector-ocr-v3.js?v=20260812-ocr10';
