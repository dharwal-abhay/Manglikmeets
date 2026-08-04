/*
 * Environment switch for Manglik Meets.
 * Set REQUIRE_EMAIL_VERIFICATION to true after production SMTP/Resend and
 * Supabase email confirmation are enabled.
 */
const APP_CONFIG = {
  REQUIRE_EMAIL_VERIFICATION: false,
  SUPABASE_URL: 'https://ssdjxqwvckysfecjwqcl.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_CUJ_PgBeVlZ6rdpMewBukQ_mE78ahWs'
};

window.APP_CONFIG = Object.freeze(APP_CONFIG);
