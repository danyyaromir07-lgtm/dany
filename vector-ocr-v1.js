// Stable public entry point for batch analysis.
// OCR engine is centralized in vector-ocr-v12.js to avoid stale version routing.
export { runRecognition } from './vector-ocr-v12.js?v=20260813-ocr12';
