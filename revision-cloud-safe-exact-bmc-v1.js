// Compatibility loader for automatic safe exact-BMC cloud removal.
// v2 preserves the proven v10 manual-force chain and adds the strict automatic exact-BMC fallback.
export { removeDetectedRevisionCloudsByExactFamily, isManualCloudForceEnabled, clearManualCloudForcePreviewApprovals } from './revision-cloud-safe-exact-bmc-v2.js?v=20260819-safeexact2';
