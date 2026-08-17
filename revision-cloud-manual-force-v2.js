// Compatibility loader. The existing public import path is preserved; current logic lives in v3.
import './revision-cloud-manual-zero-arm-v1.js?v=20260817-vectorzero1';
export { removeDetectedRevisionCloudsByExactFamily, isManualCloudForceEnabled, clearManualCloudForcePreviewApprovals } from './revision-cloud-manual-force-v3.js?v=20260817-zeroexact1';
