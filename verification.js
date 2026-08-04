/* Reusable email-verification policy and UI. */
(function () {
  'use strict';

  const copy = {
    title: 'Verify your email',
    reminder: 'Confirm your email address to unlock the full Manglik Meets experience.',
    action: 'Resend verification email',
    sentTitle: 'Verification email sent',
    sentBody: 'Please check your inbox for the confirmation link.',
    developmentWelcomeTitle: 'Welcome to Manglik Meets',
    developmentWelcomeBody: 'Your account is ready to use.',
    productionWelcomeTitle: 'Check your email',
    productionWelcomeBody: 'Open the confirmation email we sent to complete your account setup.'
  };

  const getUser = (sessionOrUser) => sessionOrUser?.user || sessionOrUser || null;
  const isEmailVerified = (sessionOrUser) => {
    const user = getUser(sessionOrUser);
    return Boolean(user?.email_confirmed_at || user?.confirmed_at);
  };
  const requiresVerification = () => Boolean(window.APP_CONFIG?.REQUIRE_EMAIL_VERIFICATION);
  const isTrusted = (sessionOrUser) => {
    const user = getUser(sessionOrUser);
    return Boolean(user && (!requiresVerification() || isEmailVerified(user)));
  };
  const shouldShowNotice = (sessionOrUser) => Boolean(requiresVerification() && getUser(sessionOrUser) && !isEmailVerified(sessionOrUser));

  const render = (sessionOrUser, options = {}) => {
    const slot = options.slot || document.querySelector('[data-verification-slot]');
    if (!slot) return;
    const visible = shouldShowNotice(sessionOrUser);
    slot.hidden = !visible;
    slot.innerHTML = visible ? `<section class="verification-notice" role="status" data-verification-component><div><strong>${copy.title}</strong><p>${copy.reminder}</p></div><button type="button" data-verification-resend>${copy.action}</button></section>` : '';
    document.querySelectorAll('[data-email-verification-badge]').forEach((badge) => { badge.hidden = !visible; });
  };

  const getSignUpFeedback = (signUpData) => {
    if (!requiresVerification()) return { title: copy.developmentWelcomeTitle, body: copy.developmentWelcomeBody };
    return signUpData?.session
      ? { title: copy.developmentWelcomeTitle, body: copy.developmentWelcomeBody }
      : { title: copy.productionWelcomeTitle, body: copy.productionWelcomeBody };
  };

  const resend = async () => {
    const user = window.ManglikAuth?.getUser();
    const client = window.ManglikAuth?.client;
    if (!requiresVerification() || !user?.email || !client) return { skipped: true };
    const { error } = await client.auth.resend({ type: 'signup', email: user.email, options: { emailRedirectTo: window.location.origin } });
    return { error };
  };

  const initialise = async () => {
    const auth = window.ManglikAuth;
    if (!auth) return;
    auth.onChange((session) => render(session));
    const session = await auth.start();
    render(session);
    document.addEventListener('click', async (event) => {
      const resendButton = event.target.closest('[data-verification-resend]');
      if (!resendButton) return;
      resendButton.disabled = true;
      const result = await resend();
      resendButton.disabled = false;
      if (result.error) window.dispatchEvent(new CustomEvent('manglik-verification-message', { detail: { title: 'Unable to resend email', body: result.error.message } }));
      else window.dispatchEvent(new CustomEvent('manglik-verification-message', { detail: { title: copy.sentTitle, body: copy.sentBody } }));
    });
  };

  window.ManglikVerification = { copy, isEmailVerified, isTrusted, requiresVerification, shouldShowNotice, render, resend, getSignUpFeedback, initialise };
  document.addEventListener('DOMContentLoaded', initialise, { once: true });
}());
