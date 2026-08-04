/* Secure contact form client. Messages are submitted only through the Netlify function. */
(function () {
  'use strict';
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const status = document.querySelector('#contact-form-status');
  const button = document.querySelector('#contact-submit');
  const show = (message, type) => { status.hidden = false; status.textContent = message; status.className = `contact-form-status ${type || ''}`; };
  const fields = ['name', 'email', 'subject', 'message'];

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const invalid = fields.map((name) => form.elements[name]).find((field) => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    const payload = Object.fromEntries(new FormData(form).entries());
    button.disabled = true; button.setAttribute('aria-busy', 'true'); show('Sending your message…');
    try {
      const session = await window.ManglikAuth?.start();
      const response = await fetch('/.netlify/functions/contact-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'We could not send your message. Please try again.');
      form.reset();
      show('Thank you — your message is with our support team. We will reply to your email address soon.', 'success');
    } catch (error) {
      const offline = window.location.protocol === 'file:';
      show(offline ? 'Please open the deployed site to send a support message.' : error.message, 'error');
    } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  });
}());
