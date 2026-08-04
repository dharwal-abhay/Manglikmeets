/*
 * Local messaging prototype. `window.messagesRealtimeAdapter` provides the
 * query and Realtime contract for a future Supabase implementation.
 */
(function () {
  'use strict';
  if (window.ManglikSupabase?.client) return;

  const chats = [
    { id: 'rohan', name: 'Rohan Mehta', initials: 'RM', tone: 'tone-saffron', city: 'Mumbai, India', profession: 'Strategy Consultant', online: true, favorite: true, unread: 0, time: '10:42 AM', preview: 'That sounds like a lovely plan.' },
    { id: 'vihaan', name: 'Vihaan Kapoor', initials: 'VK', tone: 'tone-plum', city: 'New Delhi, India', profession: 'Architect', online: false, favorite: false, unread: 2, time: 'Yesterday', preview: 'I would enjoy hearing more about it.' },
    { id: 'kabir', name: 'Kabir Singh', initials: 'KS', tone: 'tone-sage', city: 'Chandigarh, India', profession: 'Civil Engineer', online: true, favorite: true, unread: 1, time: 'Mon', preview: 'Your book recommendation was spot on.' },
    { id: 'ishaan', name: 'Ishaan Verma', initials: 'IV', tone: 'tone-blue', city: 'Pune, India', profession: 'Software Engineer', online: false, favorite: false, unread: 0, time: 'Sun', preview: 'Let us continue this conversation soon.' }
  ];

  const messages = {
    rohan: [
      { id: 'r1', sender: 'them', date: 'Today', time: '10:22 AM', body: 'Hi Aanya, I enjoyed reading your profile. Your love for design and small rituals really stood out.' },
      { id: 'r2', sender: 'me', date: 'Today', time: '10:25 AM', body: 'That is kind of you, Rohan. I noticed you enjoy thoughtful travel too — what has been your favourite recent trip?', read: true },
      { id: 'r3', sender: 'them', date: 'Today', time: '10:31 AM', body: 'A quiet few days in Coorg. Coffee estates, long walks and absolutely no rushed itinerary.' },
      { id: 'r4', sender: 'me', date: 'Today', time: '10:35 AM', body: 'That sounds wonderfully unhurried. Coorg has been on my list for ages!', read: true },
      { id: 'r5', sender: 'them', date: 'Today', time: '10:42 AM', body: 'That sounds like a lovely plan.', reply: 'Coorg has been on my list for ages!' }
    ],
    vihaan: [
      { id: 'v1', sender: 'them', date: 'Yesterday', time: '7:48 PM', body: 'Hello Aanya. I loved the way you described building a warm home through little rituals.' },
      { id: 'v2', sender: 'me', date: 'Yesterday', time: '7:53 PM', body: 'Thank you, Vihaan. I think the small things are often the ones that make a home feel personal.', read: true },
      { id: 'v3', sender: 'them', date: 'Yesterday', time: '8:01 PM', body: 'I would enjoy hearing more about it.' }
    ],
    kabir: [
      { id: 'k1', sender: 'them', date: 'Monday', time: '6:12 PM', body: 'I finished the book you suggested. The writing was beautiful and surprisingly hopeful.' },
      { id: 'k2', sender: 'me', date: 'Monday', time: '6:19 PM', body: 'I am so glad! It is one of those books that stays with you.', read: true },
      { id: 'k3', sender: 'them', date: 'Monday', time: '6:27 PM', body: 'Your book recommendation was spot on.' }
    ],
    ishaan: [
      { id: 'i1', sender: 'them', date: 'Sunday', time: '4:40 PM', body: 'Hope you had a calm weekend. I enjoyed our chat about work-life balance.' },
      { id: 'i2', sender: 'me', date: 'Sunday', time: '4:52 PM', body: 'I did, thank you. It was nice talking to someone who values a slower Sunday too.', read: true },
      { id: 'i3', sender: 'them', date: 'Sunday', time: '5:03 PM', body: 'Let us continue this conversation soon.' }
    ]
  };

  const state = { activeChat: 'rohan', filter: 'recent', search: '', messageSearch: '', replyTo: null, imageUrl: '', typing: true };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  let toastTimer;

  function showToast(message) {
    const toast = $('#messages-toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function getChat(id = state.activeChat) { return chats.find((chat) => chat.id === id); }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]); }

  function filteredChats() {
    const term = state.search.trim().toLowerCase();
    return chats.filter((chat) => {
      const matchesTerm = !term || `${chat.name} ${chat.city} ${chat.profession}`.toLowerCase().includes(term);
      const matchesFilter = state.filter === 'recent' || (state.filter === 'unread' && chat.unread > 0) || (state.filter === 'favorites' && chat.favorite);
      return matchesTerm && matchesFilter;
    });
  }

  function renderChatList() {
    const result = filteredChats();
    $('#chat-list').innerHTML = result.map((chat) => `<button class="chat-row ${chat.id === state.activeChat ? 'active' : ''}" type="button" data-chat-id="${chat.id}"><span class="chat-avatar ${chat.tone}">${chat.initials}${chat.online ? '<i class="online-dot"></i>' : ''}</span><span class="chat-row-copy"><strong>${escapeHtml(chat.name)}</strong><span class="${chat.unread ? 'unread-preview' : ''}">${escapeHtml(chat.preview)}</span></span><span class="chat-row-meta"><small>${chat.time}</small>${chat.unread ? `<b class="unread-badge">${chat.unread}</b>` : chat.favorite ? '<b class="favorite-star">★</b>' : ''}</span></button>`).join('');
    $('#chat-list-empty').hidden = result.length !== 0;
    $('#unread-count').textContent = chats.reduce((total, chat) => total + chat.unread, 0);
  }

  function renderHeader() {
    const chat = getChat();
    $('#chat-header').innerHTML = `<button class="chat-mobile-list-toggle" id="chat-mobile-list-toggle" type="button" aria-label="Show chats">‹</button><span class="chat-avatar ${chat.tone}">${chat.initials}${chat.online ? '<i class="online-dot"></i>' : ''}</span><div class="chat-contact"><strong>${escapeHtml(chat.name)}</strong><span>${chat.online ? 'Online now' : 'Last active recently'}</span></div><div class="chat-header-actions"><button type="button" data-header-action="call" aria-label="Call">⌕</button><button type="button" data-header-action="search" aria-label="Search messages">⌕</button><button type="button" data-header-action="details" aria-label="Conversation info">ⓘ</button></div>`;
    $('#typing-name').textContent = `${chat.name.split(' ')[0]} is typing`;
    $('#typing-indicator').hidden = !state.typing;
  }

  function renderDetails() {
    const chat = getChat();
    $('#conversation-details').innerHTML = `<div class="detail-avatar ${chat.tone}">${chat.initials}${chat.online ? '<i class="online-dot"></i>' : ''}</div><h1 class="detail-name">${escapeHtml(chat.name)}</h1><p class="detail-status">${chat.online ? 'Online now' : 'Recently active'}</p><div class="detail-actions"><button type="button" data-detail-action="profile">View profile</button><button type="button" data-detail-action="mute">Mute</button><button type="button" data-detail-action="favorite">${chat.favorite ? '★ Favorite' : 'Add favorite'}</button></div><section class="detail-section"><h2>Shared media</h2><button class="text-action" type="button" data-detail-action="media">View all</button><div class="shared-media"><span></span><span></span><span></span></div></section><section class="detail-section"><h2>Shared files</h2><div class="shared-file"><span class="file-icon">PDF</span><div><strong>Conversation prompts.pdf</strong><span>Shared yesterday · 1.2 MB</span></div></div><div class="shared-file"><span class="file-icon">DOC</span><div><strong>Weekend ideas.doc</strong><span>Shared Monday · 90 KB</span></div></div></section><section class="detail-section"><h2>Search messages</h2><label class="details-search">⌕<input id="detail-message-search" type="search" placeholder="Find a message"></label></section>`;
  }

  function messageMarkup(message) {
    const own = message.sender === 'me';
    const hasMatch = !state.messageSearch || message.body.toLowerCase().includes(state.messageSearch.toLowerCase());
    if (!hasMatch) return '';
    return `<div class="message-row ${own ? 'own' : ''}" data-message-id="${message.id}"><button class="message-action-trigger" type="button" data-message-menu="${message.id}" aria-label="Message options">⋯</button><div class="message-bubble">${message.reply ? `<div class="message-reply">${escapeHtml(message.reply)}</div>` : ''}${message.image ? `<img class="message-image" src="${message.image}" alt="Shared image">` : ''}${message.body ? `<p>${escapeHtml(message.body)}</p>` : ''}<small class="message-time">${message.time}${own ? `<span class="read-receipt">${message.read ? '✓✓' : '✓'}</span>` : ''}</small></div></div>`;
  }

  function renderThread() {
    const conversation = messages[state.activeChat] || [];
    let previousDate = '';
    const markup = conversation.map((message) => {
      const separator = message.date !== previousDate ? `<div class="date-separator">${escapeHtml(message.date)}</div>` : '';
      previousDate = message.date;
      return separator + messageMarkup(message);
    }).join('');
    $('#message-thread').innerHTML = markup || '<div class="date-separator">No matching messages</div>';
    requestAnimationFrame(() => { const thread = $('#message-thread'); thread.scrollTop = thread.scrollHeight; });
  }

  function renderReplyPreview() {
    const preview = $('#reply-preview');
    preview.hidden = !state.replyTo;
    if (state.replyTo) $('#reply-preview-text').textContent = state.replyTo.body || 'Image';
  }

  function selectChat(id) {
    state.activeChat = id;
    state.messageSearch = '';
    state.replyTo = null;
    chats.find((chat) => chat.id === id).unread = 0;
    $('#message-search-input').value = '';
    $('#message-search-bar').hidden = true;
    $('.chat-list-panel').classList.remove('mobile-open');
    renderChatList(); renderHeader(); renderDetails(); renderThread(); renderReplyPreview();
  }

  function toggleMessageMenu(messageId, trigger) {
    const menu = $('#message-action-menu');
    if (!menu.hidden && menu.dataset.messageId === messageId) { menu.hidden = true; return; }
    const message = (messages[state.activeChat] || []).find((item) => item.id === messageId);
    menu.dataset.messageId = messageId;
    menu.innerHTML = `<button type="button" data-message-action="reply">Reply</button><button type="button" data-message-action="copy">Copy</button>${message.sender === 'me' ? '<button type="button" data-message-action="delete">Delete</button>' : ''}`;
    const rect = trigger.getBoundingClientRect();
    menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 125)}px`;
    menu.style.left = `${Math.min(rect.left - 82, window.innerWidth - 135)}px`;
    menu.hidden = false;
  }

  async function copyMessage(message) {
    try { await navigator.clipboard?.writeText(message.body || 'Image'); showToast('Message copied.'); }
    catch { showToast('Copy is unavailable in this preview.'); }
  }

  function messageAction(action) {
    const menu = $('#message-action-menu');
    const conversation = messages[state.activeChat];
    const index = conversation.findIndex((message) => message.id === menu.dataset.messageId);
    const message = conversation[index];
    if (!message) return;
    if (action === 'reply') { state.replyTo = message; renderReplyPreview(); $('#message-input').focus(); }
    if (action === 'copy') copyMessage(message);
    if (action === 'delete') { conversation.splice(index, 1); renderThread(); showToast('Message removed from this local preview.'); }
    menu.hidden = true;
  }

  function autoGrow(textarea) { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`; }

  function sendMessage() {
    const input = $('#message-input');
    const body = input.value.trim();
    if (!body && !state.imageUrl) return;
    const now = new Date();
    const message = { id: `local-${Date.now()}`, sender: 'me', date: 'Today', time: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), body, image: state.imageUrl, read: false, reply: state.replyTo?.body || '' };
    messages[state.activeChat].push(message);
    const chat = getChat();
    chat.preview = body || 'Shared an image';
    chat.time = 'Now';
    state.replyTo = null; state.imageUrl = '';
    input.value = ''; autoGrow(input);
    $('#image-preview').hidden = true;
    renderChatList(); renderThread(); renderReplyPreview();
    state.typing = false; $('#typing-indicator').hidden = true;
    setTimeout(() => { message.read = true; renderThread(); }, 850);
  }

  function handleImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { state.imageUrl = reader.result; $('#image-preview-image').src = reader.result; $('#image-preview').hidden = false; };
    reader.readAsDataURL(file);
  }

  function initialiseEvents() {
    $('#chat-list').addEventListener('click', (event) => { const row = event.target.closest('[data-chat-id]'); if (row) selectChat(row.dataset.chatId); });
    $('#chat-search-input').addEventListener('input', (event) => { state.search = event.target.value; renderChatList(); });
    $$('.chat-filter').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.chatFilter; $$('.chat-filter').forEach((item) => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', String(item === button)); }); renderChatList(); }));
    $('#message-composer').addEventListener('submit', (event) => { event.preventDefault(); sendMessage(); });
    $('#message-input').addEventListener('input', (event) => autoGrow(event.target));
    $('#message-thread').addEventListener('click', (event) => { const trigger = event.target.closest('[data-message-menu]'); if (trigger) toggleMessageMenu(trigger.dataset.messageMenu, trigger); });
    $('#message-action-menu').addEventListener('click', (event) => { const action = event.target.closest('[data-message-action]'); if (action) messageAction(action.dataset.messageAction); });
    $('#cancel-reply').addEventListener('click', () => { state.replyTo = null; renderReplyPreview(); });
    $('#attachment-button').addEventListener('click', () => showToast('Attachments are ready for Supabase Storage integration.'));
    $('#image-button').addEventListener('click', () => $('#image-upload-input').click());
    $('#image-upload-input').addEventListener('change', (event) => handleImage(event.target.files[0]));
    $('#remove-image-preview').addEventListener('click', () => { state.imageUrl = ''; $('#image-preview').hidden = true; $('#image-upload-input').value = ''; });
    $('#emoji-toggle').addEventListener('click', () => { $('#emoji-picker').hidden = !$('#emoji-picker').hidden; });
    $('#emoji-picker').addEventListener('click', (event) => { if (event.target.tagName !== 'BUTTON') return; const input = $('#message-input'); input.value += event.target.textContent; autoGrow(input); input.focus(); $('#emoji-picker').hidden = true; });
    $('#voice-button').addEventListener('click', (event) => { event.currentTarget.classList.toggle('recording'); showToast(event.currentTarget.classList.contains('recording') ? 'Voice recording placeholder started.' : 'Voice recording placeholder stopped.'); });
    $('#chat-header').addEventListener('click', (event) => { const action = event.target.closest('[data-header-action]'); if (!action) { if (event.target.closest('#chat-mobile-list-toggle')) $('.chat-list-panel').classList.add('mobile-open'); return; } if (action.dataset.headerAction === 'search') { $('#message-search-bar').hidden = false; $('#message-search-input').focus(); } else showToast('This conversation action is ready for future integration.'); });
    $('#close-message-search').addEventListener('click', () => { state.messageSearch = ''; $('#message-search-input').value = ''; $('#message-search-bar').hidden = true; renderThread(); });
    $('#message-search-input').addEventListener('input', (event) => { state.messageSearch = event.target.value; renderThread(); });
    $('#conversation-details').addEventListener('input', (event) => { if (event.target.id === 'detail-message-search') { state.messageSearch = event.target.value; renderThread(); } });
    $('#conversation-details').addEventListener('click', (event) => { const button = event.target.closest('[data-detail-action]'); if (!button) return; if (button.dataset.detailAction === 'favorite') { const chat = getChat(); chat.favorite = !chat.favorite; renderChatList(); renderDetails(); } else if (button.dataset.detailAction === 'profile') window.location.href = 'dashboard.html'; else showToast('This panel is ready for connected conversation data.'); });
    $('#messages-mobile-menu').addEventListener('click', () => { const sidebar = $('#messages-sidebar'); const isOpen = sidebar.classList.toggle('open'); $('#messages-mobile-menu').setAttribute('aria-expanded', String(isOpen)); });
    document.addEventListener('click', (event) => { if (!event.target.closest('#message-action-menu') && !event.target.closest('[data-message-menu]')) $('#message-action-menu').hidden = true; });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { $('#message-action-menu').hidden = true; $('#emoji-picker').hidden = true; } });
  }

  /* Future Supabase Realtime integration contract — intentionally not subscribed yet. */
  window.messagesRealtimeAdapter = {
    getConversationQuery() { return { table: 'conversations', select: 'id, updated_at, conversation_members(user_id, profiles(full_name, avatar_url, online_status)), messages(id, body, created_at, sender_id, read_at)', order: { column: 'updated_at', ascending: false } }; },
    getMessagesQuery(conversationId) { return { table: 'messages', select: 'id, conversation_id, sender_id, body, media_url, reply_to_id, created_at, read_at', filters: { conversation_id: conversationId }, order: { column: 'created_at', ascending: true } }; },
    getMessageInsert(conversationId, payload) { return { table: 'messages', values: { conversation_id: conversationId, body: payload.body, media_url: payload.mediaUrl || null, reply_to_id: payload.replyToId || null } }; },
    subscribe(client, conversationId, onMessage) { return client.channel(`messages:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, onMessage).subscribe(); }
  };

  renderChatList(); renderHeader(); renderDetails(); renderThread(); renderReplyPreview(); initialiseEvents();
}());
