(function () {
  'use strict';

  // Inject HTML markup into body
  const injectChatbotHTML = () => {
    if (document.getElementById('chat-launcher')) return;

    const launcher = document.createElement('button');
    launcher.className = 'chat-launcher';
    launcher.id = 'chat-launcher';
    launcher.setAttribute('aria-label', 'Open Manglik Meets assistant');
    launcher.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.48 8.6 8.6 0 0 1-3.13-.61L4 20l1.18-3.65A7.1 7.1 0 0 1 4 12a8 8 0 0 1 16-.5Z"/>
        <path d="M8 12h.01M12 12h.01M16 12h.01" stroke-linecap="round" stroke-width="2.5"/>
      </svg>
      <i class="pulse"></i>
    `;

    const chatSection = document.createElement('section');
    chatSection.className = 'chat';
    chatSection.id = 'chat';
    chatSection.setAttribute('aria-label', 'Manglik Meets assistant');
    chatSection.innerHTML = `
      <div class="chat-top">
        <div class="chat-person">
          <span class="chat-avatar">M</span>
          <div>
            <b>Mira · Manglik Meets</b>
            <small>● Online now</small>
          </div>
        </div>
        <button class="chat-close" id="chat-close" aria-label="Close chat">×</button>
      </div>
      <div class="messages" id="messages">
        <div class="message bot">
          Namaste, I’m Mira. I can help you understand Manglik Meets, shape your profile, and connect at a pace that feels right for you.
        </div>
      </div>
      <div class="quick">
        <button type="button">How does Manglik Meets work?</button>
        <button type="button">Profile preferences</button>
        <button type="button">Privacy help</button>
      </div>
      <form class="chat-form" id="chat-form">
        <input id="chat-input" placeholder="Type your message…" aria-label="Chat message" required autocomplete="off">
        <button aria-label="Send message">↑</button>
      </form>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(chatSection);
  };

  const initChatbot = () => {
    injectChatbotHTML();

    const launcher = document.getElementById('chat-launcher');
    const chat = document.getElementById('chat');
    const closeBtn = document.getElementById('chat-close');
    const messages = document.getElementById('messages');
    const input = document.getElementById('chat-input');
    const form = document.getElementById('chat-form');
    const quickButtons = document.querySelectorAll('.quick button');

    if (!launcher || !chat) return;

    launcher.onclick = () => {
      chat.classList.toggle('open');
      if (chat.classList.contains('open') && input) input.focus();
    };

    if (closeBtn) {
      closeBtn.onclick = () => chat.classList.remove('open');
    }

    const addMessage = (text, kind) => {
      const message = document.createElement('div');
      message.className = `message ${kind}`;
      message.textContent = text;
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
    };

    const answerChat = async (text) => {
      try {
        const response = await fetch('/.netlify/functions/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const responseText = await response.text();
        let data;

        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          data = {};
        }

        if (!response.ok) {
          const errorMessage = data?.error?.message || `The chat service returned HTTP ${response.status}.`;
          console.error('Chat function error:', response.status, data);
          addMessage(errorMessage, 'bot');
          return;
        }

        if (!data.reply) {
          addMessage('The chat service did not return a response. Please try again.', 'bot');
          return;
        }

        addMessage(data.reply, 'bot');
      } catch (error) {
        console.error('Chat network error:', error);
        addMessage('Unable to reach the chat service. Please try again shortly.', 'bot');
      }
    };

    if (form) {
      form.onsubmit = (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        addMessage(text, 'user');
        input.value = '';
        answerChat(text);
      };
    }

    quickButtons.forEach((button) => {
      button.onclick = () => {
        addMessage(button.textContent, 'user');
        answerChat(button.textContent);
      };
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
}());
