/* Live Settings controller. Each action has one Supabase-backed owner. */
(function () {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const api = window.ManglikSupabase;
  const state = { user: null, profile: null, settings: null, pendingAction: null, phoneChangePending: false };
  let toastTimer;

  const messageFor = (error, fallback) => {
    if (!error) return fallback;
    if (error.message?.includes('profiles_username_unique') || error.message?.includes('duplicate key')) {
      return 'This username is already taken. Please choose another.';
    }
    return error.message || fallback;
  };
  const notify = (message) => {
    const toast = $('#settings-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  };
  const setBusy = async (button, work) => {
    const label = button?.textContent;
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    try { return await work(); }
    finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = button.dataset.nextLabel || label;
        delete button.dataset.nextLabel;
      }
    }
  };
  const formValues = (form) => {
    const values = {};
    $$('[data-setting-field]', form).forEach((field) => {
      if (field.type === 'checkbox') values[field.dataset.settingField] = field.checked;
      else if (field.type !== 'radio' || field.checked) values[field.dataset.settingField] = field.value.trim();
    });
    return values;
  };
  const setSection = (name) => {
    $$('.settings-section').forEach((section) => section.classList.toggle('active', section.dataset.settingsSection === name));
    $$('.settings-nav-item').forEach((button) => button.classList.toggle('active', button.dataset.settingsTarget === name));
    history.replaceState(null, '', `#${name}`);
  };
  const applyTheme = (theme) => {
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark-mode', dark);
    localStorage.setItem('manglik-meets-theme', theme);
  };
  const applyAccessibility = (values) => {
    const size = Math.max(90, Math.min(120, Number(values.font_size || 100)));
    document.documentElement.style.fontSize = `${size}%`;
    document.body.classList.toggle('reduce-motion', Boolean(values.reduce_motion));
    $('#font-size-output').textContent = `${size}%`;
  };
  const updateVerification = (user) => {
    $('#current-email').textContent = user?.email || 'Email not available';
    const required = window.ManglikVerification?.requiresVerification();
    const verified = window.ManglikVerification?.isEmailVerified(user);
    $('#email-status').textContent = required ? (verified ? 'Email verified' : 'Verification needed') : 'Development trusted';
    $('#email-status').classList.toggle('muted', Boolean(required && !verified));
    window.ManglikVerification?.render({ user }, { slot: $('#settings-verification-notice') });
  };
  const loadProfileIntoForm = (profile) => {
    if (!profile) return;
    $('#mobile-number').value = profile.mobile_number || '';
    $('#recovery-email').value = profile.recovery_email || '';
    $('#settings-bio').value = profile.bio || '';
    $('#settings-username').value = profile.username || '';
    const privacy = profile.privacy || {};
    const values = {
      private_profile: privacy.privateProfile ?? profile.private_profile,
      hide_age: privacy.hideAge ?? profile.hide_age,
      hide_city: privacy.hideCity ?? profile.hide_city,
      hide_online_status: privacy.hideOnlineStatus ?? profile.hide_online_status,
      hide_last_seen: privacy.hideLastSeen ?? profile.hide_last_seen
    };
    Object.entries(values).forEach(([key, value]) => {
      const field = $(`[data-setting-field="${key}"]`);
      if (field) field.checked = Boolean(value);
    });
  };
  const loadSettingsIntoForm = (settings) => {
    if (!settings) return;
    Object.entries(settings).forEach(([key, value]) => {
      const fields = $$(`[data-setting-field="${key}"]`);
      fields.forEach((field) => {
        if (field.type === 'checkbox') field.checked = Boolean(value);
        else if (field.type === 'radio') field.checked = field.value === value;
        else field.value = value;
      });
    });
    applyTheme(settings.theme || 'light');
    applyAccessibility(settings);
  };
  const showConfirm = (action) => {
    const content = {
      deactivate: ['Deactivate your account?', 'Your profile will be made private and you will be signed out. You can return by signing in again.'],
      delete: ['Delete account?', 'Account deletion requires a secure server-side request. We will direct you to Support rather than remove only part of your account.']
    }[action];
    if (!content) return;
    state.pendingAction = action;
    $('#settings-confirm-title').textContent = content[0];
    $('#settings-confirm-copy').textContent = content[1];
    $('#settings-confirm').hidden = false;
  };
  const closeConfirm = () => { state.pendingAction = null; $('#settings-confirm').hidden = true; };

  async function initialize() {
    if (!api?.client) { notify('Service is currently unavailable.'); return; }
    try {
      state.user = await api.requireUser();
      const [profile, settings] = await Promise.all([api.profile.mine(), api.settings.load()]);
      state.profile = profile;
      state.settings = settings;
      updateVerification(state.user);
      loadProfileIntoForm(profile);
      loadSettingsIntoForm(settings);
      const startSection = location.hash.slice(1);
      if ($(`[data-settings-target="${startSection}"]`)) setSection(startSection);
    } catch (error) { notify(messageFor(error, 'Your account settings could not be loaded.')); }
  }

  function bindNavigation() {
    $$('.settings-nav-item').forEach((button) => button.addEventListener('click', () => {
      setSection(button.dataset.settingsTarget);
      $('.settings-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    $('#settings-mobile-menu')?.addEventListener('click', () => {
      const sidebar = $('#settings-sidebar');
      const open = sidebar.classList.toggle('open');
      $('#settings-mobile-menu').setAttribute('aria-expanded', String(open));
    });
  }

  function bindForms() {
    $('#update-email-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = $('#new-email').value.trim();
      if (!email) return notify('Enter the new email address first.');
      setBusy(event.submitter, async () => {
        try { await api.settings.updateEmail(email); notify('Email update requested. Check the new inbox if confirmation is enabled.'); $('#new-email').value = ''; }
        catch (error) { notify(messageFor(error, 'Email could not be updated.')); }
      });
    });
    $('#change-password-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const password = $('#new-password').value;
      if (password.length < 8) return notify('Use a password with at least 8 characters.');
      if (password !== $('#confirm-password').value) return notify('New passwords do not match.');
      setBusy(event.submitter, async () => {
        try { await api.settings.updatePassword(password); event.currentTarget.reset(); notify('Password updated securely.'); }
        catch (error) { notify(messageFor(error, 'Password could not be updated.')); }
      });
    });
    $('#update-phone-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const phone = $('#mobile-number').value.trim();
      if (!phone) return notify('Enter a mobile number first.');
      const submitter = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
      setBusy(submitter, async () => {
        try {
          if (!state.phoneChangePending) {
            await api.auth.updatePhone(phone);
            state.phoneChangePending = true;
            const code = document.createElement('input');
            code.id = 'mobile-verification-code'; code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 6; code.placeholder = '6-digit code'; code.setAttribute('aria-label', 'Mobile verification code');
            event.currentTarget.querySelector('.setting-form-row').append(code);
            submitter.dataset.nextLabel = 'Verify code';
            notify('Verification code sent. Enter it, then select Verify code.');
          } else {
            const code = $('#mobile-verification-code')?.value.trim();
            if (!code) throw new Error('Enter the verification code sent to your phone.');
            await api.auth.verifyPhoneChange(phone, code);
            await api.profile.patch({ mobile_number: phone });
            state.phoneChangePending = false;
            $('#mobile-verification-code')?.remove();
            submitter.dataset.nextLabel = 'Save number';
            notify('Mobile number verified and saved.');
          }
        } catch (error) { notify(messageFor(error, 'Mobile number could not be updated.')); }
      });
    });
    $('#recovery-email-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = $('#recovery-email').value.trim();
      setBusy(event.submitter, async () => { try { await api.profile.patch({ recovery_email: email || null }); notify('Recovery email saved.'); } catch (error) { notify(messageFor(error, 'Recovery email could not be saved.')); } });
    });
    $('#profile-settings-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);
      if (values.username && !/^[a-z0-9_]{3,30}$/.test(values.username)) return notify('Use 3–30 lowercase letters, numbers, or underscores for your username.');
      setBusy(event.submitter, async () => {
        try {
          state.profile = await api.profile.patch(values);
          window.ManglikNavigation?.loadIdentity();
          notify('Profile details saved.');
        } catch (error) { notify(messageFor(error, 'Profile details could not be saved.')); }
      });
    });
    $('#privacy-settings-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      setBusy(event.submitter, async () => { try { state.profile = await api.profile.patch(formValues(event.currentTarget)); notify('Privacy choices saved.'); } catch (error) { notify(messageFor(error, 'Privacy choices could not be saved.')); } });
    });
    $('#notification-settings-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);
      delete values.sms_notifications;
      setBusy(event.submitter, async () => { try { state.settings = await api.settings.save(values); notify('Notification choices saved.'); } catch (error) { notify(messageFor(error, 'Notification choices could not be saved.')); } });
    });
    $('#appearance-settings-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);
      applyTheme(values.theme || 'light');
      setBusy(event.submitter, async () => { try { state.settings = await api.settings.save(values); notify('Appearance saved.'); } catch (error) { notify(messageFor(error, 'Appearance could not be saved.')); } });
    });
    $('#accessibility-settings-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);
      values.font_size = Number(values.font_size || 100);
      applyAccessibility(values);
      setBusy(event.submitter, async () => { try { state.settings = await api.settings.save(values); notify('Accessibility choices saved.'); } catch (error) { notify(messageFor(error, 'Accessibility choices could not be saved.')); } });
    });
  }

  function bindActions() {
    window.addEventListener('hashchange', () => {
      const startSection = location.hash.slice(1);
      if ($(`[data-settings-target="${startSection}"]`)) setSection(startSection);
    });
    $('#font-size-range')?.addEventListener('input', (event) => applyAccessibility({ font_size: event.target.value, reduce_motion: $('#reduce-motion').checked }));
    $('#reduce-motion')?.addEventListener('change', (event) => applyAccessibility({ font_size: $('#font-size-range').value, reduce_motion: event.target.checked }));
    $$('input[name="theme"]').forEach((radio) => radio.addEventListener('change', (event) => applyTheme(event.target.value)));
    $$('.settings-card [data-setting-media]').forEach((input) => input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await api.profile.upload(file, input.dataset.settingMedia);
        window.ManglikNavigation?.loadIdentity();
        notify(`${input.dataset.settingMedia === 'avatar' ? 'Profile picture' : 'Cover photo'} uploaded.`);
      } catch (error) { notify(messageFor(error, 'Image could not be uploaded.')); }
    }));
    $('#logout-other-devices')?.addEventListener('click', (event) => setBusy(event.currentTarget, async () => {
      try { await api.settings.signOut('others'); notify('Other sessions have been signed out.'); }
      catch (error) { notify(messageFor(error, 'Other sessions could not be signed out.')); }
    }));
    $$('[data-session-action]').forEach((button) => button.closest('div')?.remove());
    $$('[data-sensitive-action]').forEach((button) => button.addEventListener('click', () => showConfirm(button.dataset.sensitiveAction)));
    $('#settings-confirm-cancel')?.addEventListener('click', closeConfirm);
    $('#settings-confirm')?.addEventListener('click', (event) => { if (event.target === $('#settings-confirm')) closeConfirm(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#settings-confirm')?.hidden) closeConfirm(); });
    $('#settings-confirm-continue')?.addEventListener('click', async (event) => {
      const action = state.pendingAction;
      closeConfirm();
      if (action === 'delete') { location.assign('index.html#contact'); return; }
      if (action === 'deactivate') {
        await setBusy(event.currentTarget, async () => {
          try { await api.profile.patch({ private_profile: true }); await api.settings.signOut('global'); location.assign('index.html'); }
          catch (error) { notify(messageFor(error, 'Account could not be deactivated.')); }
        });
      }
    });
    $('[data-supabase-action="request-data-export"]')?.addEventListener('click', async (event) => setBusy(event.currentTarget, async () => {
      try {
        const exportData = { exported_at: new Date().toISOString(), account: { id: state.user?.id, email: state.user?.email }, profile: state.profile, settings: state.settings };
        const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'manglik-meets-data.json'; link.click(); URL.revokeObjectURL(url);
        notify('Your available account data has been downloaded.');
      } catch (error) { notify(messageFor(error, 'Your data export could not be created.')); }
    }));
    $$('[data-supabase-action="list-blocked-users"], [data-supabase-action="list-reported-users"]').forEach((button) => button.addEventListener('click', () => notify('Safety-list management will appear here when there are records to show.')));
    $$('[data-placeholder-action]').forEach((button) => button.addEventListener('click', () => notify('This option is not available yet.')));
  }

  window.settingsDataAdapter = {
    getFormRequest(formId, payload) { const form = document.getElementById(formId); return { table: form?.dataset.supabaseTable, action: form?.dataset.supabaseAction, values: payload }; },
    getAuthRequest(action, payload) { return { provider: 'supabase-auth', action, payload }; }
  };

  if ($('#current-email')) $('#current-email').textContent = 'Loading account email…';
  bindNavigation();
  bindForms();
  bindActions();
  initialize();
}());
