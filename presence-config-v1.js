// Presence configuration. Safe client-side values only.
// IMPORTANT: use a Supabase PUBLISHABLE key (sb_publishable_...), never a secret/service_role key.
window.__PDFTOOLS_PRESENCE_CONFIG = Object.freeze({
  enabled: false,
  supabaseUrl: '',
  publishableKey: '',
  heartbeatSeconds: 25,
  activeWindowSeconds: 90
});
