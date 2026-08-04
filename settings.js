/* Settings account-center prototype. All mutations are exposed as Supabase-ready payloads. */
(function () {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const state = { active: 'account', pendingSensitiveAction: null };
  let toastTimer;

  function showToast(message) { const toast = $('#settings-toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200); }
  function valuesFor(form) { const values = {}; $$('[data-setting-field]', form).forEach((field) => { if (field.type === 'checkbox') values[field.dataset.settingField] = field.checked; else if (field.type === 'radio') { if (field.checked) values[field.dataset.settingField] = field.value; } else values[field.dataset.settingField] = field.value.trim(); }); return values; }
  function setSection(name) { state.active = name; $$('.settings-section').forEach((section) => section.classList.toggle('active', section.dataset.settingsSection === name)); $$('.settings-nav-item').forEach((button) => button.classList.toggle('active', button.dataset.settingsTarget === name)); }
  function applyTheme(theme) { const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches); document.body.classList.toggle('dark-mode', isDark); localStorage.setItem('manglik-meets-theme', theme); }
  function updateVerificationState(session) { const user = session?.user || session || null; const email = user?.email || 'aanya@example.com'; $('#current-email').textContent = email; const isProductionVerification = window.ManglikVerification?.requiresVerification(); const isVerified = window.ManglikVerification?.isEmailVerified(user); $('#email-status').textContent = !isProductionVerification ? 'Development trusted' : isVerified ? 'Email verified' : 'Verification needed'; $('#email-status').classList.toggle('muted', Boolean(isProductionVerification && !isVerified)); const notice = $('#settings-verification-notice'); window.ManglikVerification?.render(session, { slot: notice }); }
  function openConfirm(action) { const labels = { deactivate: { title: 'Deactivate your account?', copy: 'Your profile will be hidden until you decide to return.' }, delete: { title: 'Delete your account?', copy: 'This is permanent after confirmation. We will request a final server-side confirmation before any data is deleted.' } }; state.pendingSensitiveAction = action; $('#settings-confirm-title').textContent = labels[action].title; $('#settings-confirm-copy').textContent = labels[action].copy; $('#settings-confirm').hidden = false; }
  function closeConfirm() { state.pendingSensitiveAction = null; $('#settings-confirm').hidden = true; }
  function initialiseAccount() { const auth = window.ManglikAuth; if (auth) { auth.onChange(updateVerificationState); updateVerificationState(auth.getSession()); } else updateVerificationState(null); }
  function initialiseEvents() {
    const mobileActions = $('#update-phone-form .setting-form-row');
    if (mobileActions && !mobileActions.querySelector('[data-supabase-action="verify-mobile"]')) {
      const verifyMobile = document.createElement('button');
      verifyMobile.className = 'outline-button';
      verifyMobile.type = 'button';
      verifyMobile.dataset.supabaseAction = 'verify-mobile';
      verifyMobile.textContent = 'Verify mobile';
      mobileActions.append(verifyMobile);
    }
    $$('.settings-nav-item').forEach((button) => button.addEventListener('click', () => { setSection(button.dataset.settingsTarget); document.querySelector('.settings-content').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    $$('form[data-supabase-action]').forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); if (form.id === 'change-password-form' && $('#new-password').value !== $('#confirm-password').value) { showToast('New passwords do not match.'); return; } const action = form.dataset.supabaseAction; const payload = valuesFor(form); localStorage.setItem(`manglik-meets-settings-${action}`, JSON.stringify(payload)); if (form.id === 'appearance-settings-form') applyTheme(payload.theme || 'light'); if (form.id === 'accessibility-settings-form') { document.documentElement.style.fontSize = `${payload.font_size || 100}%`; document.body.classList.toggle('reduce-motion', Boolean(payload.reduce_motion)); } showToast(`${action.replaceAll('-', ' ')} is ready to sync to your account.`); }));
    $('#font-size-range').addEventListener('input', (event) => { $('#font-size-output').textContent = `${event.target.value}%`; document.documentElement.style.fontSize = `${event.target.value}%`; });
    $('#logout-other-devices').addEventListener('click', () => showToast('Other sessions will be signed out when Supabase session management is connected.'));
    $$('.session-list [data-session-action]').forEach((button) => button.addEventListener('click', () => { button.closest('div').remove(); showToast('Session removed from this local preview.'); }));
    $$('[data-placeholder-action]').forEach((button) => button.addEventListener('click', () => showToast('This feature is prepared for the connected production workflow.')));
    $$('[data-supabase-action]').forEach((button) => { if (button.tagName === 'BUTTON' && button.type === 'button' && !button.closest('form')) button.addEventListener('click', () => showToast(`${button.dataset.supabaseAction.replaceAll('-', ' ')} is ready for Supabase.`)); });
    const verifyMobile = $('[data-supabase-action="verify-mobile"]');
    if (verifyMobile) verifyMobile.addEventListener('click', async () => {
      const phone = $('#mobile-number')?.value.trim();
      if (!phone) { showToast('Enter your mobile number first.'); return; }
      try {
        const code = window.prompt('Enter the verification code sent to your phone. Leave this blank to send a new code.');
        if (code) await window.ManglikSupabase.auth.verifyPhoneChange(phone, code);
        else await window.ManglikSupabase.auth.updatePhone(phone);
        showToast(code ? 'Mobile number verified.' : 'Verification code sent to your phone.');
      } catch (error) { showToast(error.message); }
    });
    $$('[data-sensitive-action]').forEach((button) => button.addEventListener('click', () => openConfirm(button.dataset.sensitiveAction)));
    $('#settings-confirm-cancel').addEventListener('click', closeConfirm);
    $('#settings-confirm-continue').addEventListener('click', () => { const action = state.pendingSensitiveAction; closeConfirm(); showToast(`${action === 'delete' ? 'Account deletion request' : 'Account deactivation'} is prepared for secure server-side confirmation.`); });
    $('#settings-mobile-menu').addEventListener('click', () => { const sidebar = $('#settings-sidebar'); const isOpen = sidebar.classList.toggle('open'); $('#settings-mobile-menu').setAttribute('aria-expanded', String(isOpen)); });
  }

  /* One backend contract for each account-center form and safety action. */
  window.settingsDataAdapter = {
    getFormRequest(formId, payload) { const form = document.getElementById(formId); return { table: form?.dataset.supabaseTable, action: form?.dataset.supabaseAction, values: payload }; },
    getAuthRequest(action, payload) { return { provider: 'supabase-auth', action, payload }; },
    getStorageRequest(kind, file) { return { bucket: 'profile-media', path: `current-user/${kind}/${file?.name || 'file'}`, file }; },
    getAccountAction(action) { return { table: 'account_requests', values: { action, requested_at: new Date().toISOString() } }; },
    getPreferencesRequest(payload) { return { table: 'user_preferences', action: 'upsert', values: payload }; }
  };

  const storedTheme = localStorage.getItem('manglik-meets-theme');
  if (storedTheme) { const themeChoice = $(`input[name="theme"][value="${storedTheme}"]`); if (themeChoice) themeChoice.checked = true; applyTheme(storedTheme); }
  window.addEventListener('manglik-verification-message', (event) => showToast(`${event.detail.title}: ${event.detail.body}`));
  initialiseAccount(); initialiseEvents();
}());
