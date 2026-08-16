/* Secure contact form handler connected directly to Supabase data layer. */
(function () {
  'use strict';

  function initContactForm() {
    const form = document.querySelector('#contact-form');
    if (!form) return;

    const statusEl = document.querySelector('#contact-form-status');
    const submitBtn = document.querySelector('#contact-submit');
    const nameInput = document.querySelector('#contact-name');
    const emailInput = document.querySelector('#contact-email');
    const subjectInput = document.querySelector('#contact-subject');
    const messageInput = document.querySelector('#contact-message');
    const honeypot = document.querySelector('#contact-website');

    let isSubmitting = false;

    const showStatus = (message, type) => {
      if (!statusEl) return;
      statusEl.hidden = !message;
      statusEl.textContent = message || '';
      statusEl.className = `contact-form-status ${type || ''}`.trim();
    };

    const validateEmail = (email) => {
      // Standard robust email regex
      return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (isSubmitting) return;

      // 1. Honeypot check (bot prevention)
      if (honeypot && honeypot.value.trim() !== '') {
        form.reset();
        showStatus("Your message has been sent successfully. We'll get back to you soon.", 'success');
        return;
      }

      // 2. Field values & whitespace trimming
      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const subject = subjectInput ? subjectInput.value.trim() : '';
      const message = messageInput ? messageInput.value.trim() : '';

      // 3. Validation
      if (!name || name.length < 2) {
        showStatus('Please enter your name (at least 2 characters).', 'error');
        if (nameInput) nameInput.focus();
        return;
      }

      if (!email || !validateEmail(email)) {
        showStatus('Please enter a valid email address.', 'error');
        if (emailInput) emailInput.focus();
        return;
      }

      if (!message || message.length < 10) {
        showStatus('Please write a message of at least 10 characters so we can assist you.', 'error');
        if (messageInput) messageInput.focus();
        return;
      }

      if (message.length > 4000) {
        showStatus('Message is too long (maximum 4,000 characters).', 'error');
        if (messageInput) messageInput.focus();
        return;
      }

      // 4. Set loading state
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.textContent = 'Sending...';
      }
      showStatus('Sending your message…', '');

      try {
        const api = window.ManglikSupabase;
        if (api?.contact?.submit) {
          await api.contact.submit({ name, email, subject, message });
        } else {
          // Direct client fallback
          const client = window.ManglikAuth?.client || api?.client;
          if (!client) throw new Error('Supabase client is not initialized.');

          let userId = null;
          try {
            const { data } = await client.auth.getUser();
            userId = data?.user?.id || null;
          } catch (_) {}

          const payload = {
            name,
            email: email.toLowerCase(),
            subject: subject || null,
            message,
            status: 'new'
          };
          if (userId) payload.user_id = userId;

          const { error } = await client.from('contact_messages').insert(payload);
          if (error) throw error;
        }

        // 5. Success handling
        form.reset();
        const successMessage = "Your message has been sent successfully. We'll get back to you soon.";
        showStatus(successMessage, 'success');

        // Optional modal notification if present on page
        if (typeof window.openMessage === 'function') {
          window.openMessage('Message Sent', successMessage);
        }
      } catch (error) {
        console.error('[Contact Us submission error]:', error);
        showStatus('Unable to send your message. Please try again.', 'error');
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute('aria-busy');
          submitBtn.textContent = 'Send message';
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactForm, { once: true });
  } else {
    initContactForm();
  }
}());
