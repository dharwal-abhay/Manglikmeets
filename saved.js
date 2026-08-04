/* Saved profiles view. Data is always loaded from the signed-in user's Supabase rows. */
(function () {
  'use strict';
  const list = document.querySelector('#saved-profiles-list');
  const empty = document.querySelector('#saved-empty-state');
  const summary = document.querySelector('#saved-summary');
  const toast = document.querySelector('#saved-toast');
  const menu = document.querySelector('#saved-mobile-menu');
  const sidebar = document.querySelector('#saved-sidebar');
  let timer;

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
  const initials = (name) => String(name || 'Member').split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const yearsOld = (dob) => {
    if (!dob) return '';
    const birth = new Date(`${dob}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
    return Number.isFinite(age) ? age : '';
  };
  const notify = (message) => { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('is-visible'), 3000); };
  const profileCard = (profile) => {
    const name = escapeHtml(profile.full_name || 'Member');
    const city = escapeHtml([profile.city, profile.state].filter(Boolean).join(', ') || 'Location not shared');
    const profession = escapeHtml(profile.profession || 'Professional details not shared');
    const bio = escapeHtml(profile.bio || 'A Manglik Meets member ready for a meaningful introduction.');
    const age = yearsOld(profile.date_of_birth);
    const image = profile.avatar_url ? `style="background-image:linear-gradient(rgba(52,35,27,.10),rgba(52,35,27,.35)),url('${escapeHtml(profile.avatar_url)}');background-size:cover;background-position:center"` : '';
    return `<article class="member-card" data-profile-id="${escapeHtml(profile.id)}"><div class="member-visual tone-saffron" ${image}><span class="member-status">Saved profile</span><span class="member-initials">${initials(profile.full_name)}</span></div><div class="member-card-content"><div class="member-title-row"><div><h3>${name}${age ? `, ${age}` : ''}</h3><p>@${escapeHtml(profile.username || 'member')}</p></div></div><p class="member-location">⌖ ${city}</p><p class="member-profession">${profession}</p><p class="member-bio">${bio}</p><div class="member-card-actions"><a class="member-action primary-action" href="discover.html?profile=${encodeURIComponent(profile.id)}">View profile</a><button class="member-action" type="button" data-saved-action="message">Message</button><button class="member-action is-active" type="button" data-saved-action="remove">Saved</button></div></div></article>`;
  };
  async function load() {
    try {
      const rows = await window.ManglikSupabase.social.saved();
      const profiles = rows.map((row) => row.profiles).filter(Boolean);
      list.innerHTML = profiles.map(profileCard).join('');
      empty.hidden = profiles.length > 0;
      summary.textContent = profiles.length ? `${profiles.length} saved profile${profiles.length === 1 ? '' : 's'} for you to revisit.` : 'Your saved introductions will appear here.';
    } catch (error) {
      list.replaceChildren();
      empty.hidden = false;
      summary.textContent = 'Your saved profiles could not be loaded.';
      notify(error.message || 'Unable to load saved profiles.');
    }
  }
  list?.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-profile-id]');
    const action = event.target.dataset.savedAction;
    if (!card || !action) return;
    const profileId = card.dataset.profileId;
    try {
      if (action === 'remove') { await window.ManglikSupabase.social.save(profileId); card.remove(); const remaining = list.children.length; empty.hidden = remaining > 0; summary.textContent = remaining ? `${remaining} saved profile${remaining === 1 ? '' : 's'} for you to revisit.` : 'Your saved introductions will appear here.'; notify('Removed from saved profiles.'); }
      if (action === 'message') { const conversationId = await window.ManglikSupabase.chat.start(profileId); sessionStorage.setItem('manglik-meets-active-conversation', conversationId); location.assign('messages.html'); }
    } catch (error) { notify(error.message || 'That action could not be completed.'); }
  });
  menu?.addEventListener('click', () => { const open = sidebar.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('DOMContentLoaded', load, { once: true });
}());
