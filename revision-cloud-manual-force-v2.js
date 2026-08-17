// Compatibility loader. The existing public import path is preserved; current logic lives in v2-next.
import './revision-cloud-manual-zero-arm-v1.js?v=20260817-vectorzero1';
export { removeDetectedRevisionCloudsByExactFamily, isManualCloudForceEnabled, clearManualCloudForcePreviewApprovals } from './revision-cloud-manual-force-v2-next.js?v=20260817-vectorzero1';
