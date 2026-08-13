/* Page bindings for live Supabase data. Keeps the existing interface and its data attributes intact. */
(function () {
  'use strict';
  const api = window.ManglikSupabase;
  if (!api?.client) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  const escape = (value) => String(value || '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' })[c]);
  const toast = (message) => {
    const node = $('.discover-toast, .matches-toast, .messages-toast, .notifications-toast, .settings-toast, .feed-toast, #dashboard-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer); node._timer = setTimeout(() => node.classList.remove('show'), 4200);
  };
  const busy = async (button, action) => {
    if (!button) return action();
    const original = button.textContent; button.disabled = true; button.setAttribute('aria-busy', 'true');
    try { return await action(); } finally { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = original; }
  };
  const age = (dob) => { if (!dob) return ''; const now = new Date(); const birth = new Date(`${dob}T00:00:00`); let value = now.getFullYear() - birth.getFullYear(); if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) value -= 1; return value; };
  const profileCard = (person) => `<article class="member-card" data-member-card="${person.id}"><div class="member-visual ${person.avatar_url ? 'has-image' : 'tone-saffron'}"${person.avatar_url ? ` style="background-image:linear-gradient(rgba(52,35,27,.08),rgba(52,35,27,.3)),url('${escape(person.avatar_url)}')"` : ''}><span class="member-compatibility">Member</span><span class="member-initials">${escape((person.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2))}</span></div><div class="member-content"><div class="member-name-row"><h3>${escape(person.full_name)}, ${age(person.date_of_birth) || '—'}</h3>${person.is_verified ? '<span class="verified-mark" title="Verified member">✓</span>' : ''}</div><p class="member-meta">${escape(person.city || 'Location not shared')}${person.state ? `, ${escape(person.state)}` : ''}</p><p class="member-profession">${escape(person.profession || 'Profession not shared')}</p><p class="member-bio">${escape(person.bio || 'A thoughtful member of the Manglik Meets community.')}</p></div><div class="member-actions"><button class="member-action primary" type="button" data-member-action="view" data-member-id="${person.id}">View</button><button class="member-action" type="button" data-member-action="like" data-member-id="${person.id}" aria-label="Like ${escape(person.full_name)}">♡</button><button class="member-action" type="button" data-member-action="save" data-member-id="${person.id}" aria-label="Save ${escape(person.full_name)}">⌑</button><button class="member-action" type="button" data-member-action="message" data-member-id="${person.id}" aria-label="Message ${escape(person.full_name)}">✉</button></div></article>`;

  async function hydrateProfile() {
    if (!$('#profile-editor-form')) return;
    try {
      const remote = await api.profile.mine();
      if (!remote) return;
      if (typeof profileState !== 'undefined') {
        Object.assign(profileState, remote);
        const media = await api.profile.mediaUrls(remote.profile_media || []);

        let avatarUrl = '';
        if (remote.avatar_url) {
          avatarUrl = await api.storage.signedUrl('profile-images', remote.avatar_url);
        }

        let coverUrl = '';
        if (remote.cover_url) {
          coverUrl = await api.storage.signedUrl('profile-images', remote.cover_url);
        }

        profileState.media.avatar = avatarUrl || media.find((item) => item.media_type === 'avatar')?.url || '';
        profileState.media.cover = coverUrl || media.find((item) => item.media_type === 'cover')?.url || '';
        profileState.media.gallery = media.filter((item) => item.media_type === 'gallery').sort((a, b) => a.sort_order - b.sort_order).map((item) => ({ id: item.id, label: item.caption || 'A shared moment', url: item.url, className: '', storage_path: item.storage_path }));
        renderProfile();
      }
    } catch (error) { console.warn('Profile load unavailable:', error.message); }
  }

  function bindProfile() {
    if (!$('#profile-editor-form')) return;
    hydrateProfile();
    ['#profile-editor-form', '#profile-wizard-form'].forEach((selector) => {
      $(selector)?.addEventListener('submit', async () => {
        try { await api.profile.save(profileState); toast('Profile securely saved to your account.'); } catch (error) { toast(`Profile could not be saved: ${error.message}`); }
      });
    });

    document.addEventListener('change', async (event) => {
      const input = event.target;
      if (!input || input.type !== 'file') return;
      const kind = input.dataset.profileMediaInput || input.dataset.wizardMedia || input.dataset.settingMedia ||
        (input.id === 'profile-picture-upload' ? 'avatar' : input.id === 'cover-picture-upload' ? 'cover' : input.id === 'gallery-picture-upload' ? 'gallery' : null);
      if (!kind) return;

      const files = [...(input.files || [])];
      if (!files.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        toast('Uploading photo…');
        const uploads = await Promise.all(files.map((file, index) => api.profile.upload(file, kind, kind === 'gallery' ? (profileState.media?.gallery?.length || 0) + index : 0)));
        const item = uploads[0];
        const displayUrl = item?.url || item?.signedUrl;
        if (displayUrl) {
          if (kind === 'avatar') {
            profileState.media.avatar = displayUrl;
            profileState.avatar_url = item.path || item.storage_path;
          }
          if (kind === 'cover') {
            profileState.media.cover = displayUrl;
            profileState.cover_url = item.path || item.storage_path;
          }
        }
        if (kind === 'gallery') {
          uploads.forEach((u) => {
            const gUrl = u?.url || u?.signedUrl;
            if (gUrl && !profileState.media.gallery.some((g) => g.id === u.id || g.storage_path === u.storage_path)) {
              profileState.media.gallery.push({ id: u.id, label: u.caption || 'A shared moment', url: gUrl, className: '', storage_path: u.storage_path });
            }
          });
        }
        renderProfile();
        window.ManglikNavigation?.loadIdentity();
        toast(`${uploads.length} photo${uploads.length === 1 ? '' : 's'} uploaded and saved.`);
      } catch (error) {
        console.error('[Upload error]:', error);
        toast(`Photo upload failed: ${error.message}`);
      }
    }, true);
    $('#gallery-manager-list')?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-gallery-id]'); const item = profileState.media.gallery.find((photo) => photo.id === row?.dataset.galleryId);
      if (!item) return;
      if (event.target.matches('[data-gallery-delete]') && item.storage_path) api.profile.deleteMedia(item).then(() => toast('Photo removed from your gallery.')).catch((error) => toast(error.message));
      if (event.target.dataset.galleryMove) setTimeout(() => api.profile.reorderMedia(profileState.media.gallery.filter((photo) => photo.storage_path)).catch((error) => toast(error.message)), 0);
    }, true);
  }

  function currentFilters() {
    const data = {};
    document.querySelectorAll('[data-filter]').forEach((input) => {
      if (input.type === 'checkbox') {
        if (input.checked) data[input.dataset.filter] = true;
      } else if (input.value && !/^any /i.test(input.value)) {
        data[input.dataset.filter] = input.value;
      }
    });
    if (data.ageMin === '25') delete data.ageMin;
    if (data.ageMax === '35') delete data.ageMax;
    return data;
  }

  async function getOppositeGender() {
    try {
      const user = await api.requireUser();
      const { data: me } = await api.client.from('profiles').select('gender').eq('id', user.id).maybeSingle();
      const g = (me?.gender || '').toLowerCase().trim();
      if (g === 'male' || g === 'man' || g === 'm') return 'female';
      if (g === 'female' || g === 'woman' || g === 'f') return 'male';
    } catch (e) {}
    return null;
  }

  async function liveDiscover(event) {
    event?.preventDefault(); event?.stopImmediatePropagation();
    const input = $('#discover-search-input, #member-search-input');
    const recommendedGrid = $('[data-member-grid="recommended"]');
    const compatibleGrid = $('[data-member-grid="compatible"]');
    const nearbyList = $('[data-member-list="nearby"]');
    const newList = $('[data-member-list="new"]');

    if (!recommendedGrid) return;
    recommendedGrid.setAttribute('aria-busy', 'true');
    recommendedGrid.innerHTML = '<div class="empty-members">Searching the community…</div>';

    try {
      const filters = currentFilters();
      const currentUser = await api.requireUser().catch(() => null);
      let result = await api.profile.search({ query: input?.value || '', filters, limit: 100 });
      if (currentUser) result = result.filter((p) => p.id !== currentUser.id);

      const cardsData = await Promise.all(result.map(async (person) => {
        let avatar_url = person.avatar_url;
        if (avatar_url && !avatar_url.startsWith('http') && !avatar_url.startsWith('data:')) {
          avatar_url = await api.storage.signedUrl('profile-images', avatar_url);
        }
        return { ...person, avatar_url };
      }));

      const html = cardsData.length ? cardsData.map(profileCard).join('') : '<div class="empty-members">No members match those details yet. Try widening your search or filters.</div>';
      recommendedGrid.innerHTML = html;

      if (compatibleGrid) {
        compatibleGrid.innerHTML = cardsData.length > 1 ? cardsData.slice().reverse().map(profileCard).join('') : html;
      }
      if (nearbyList) {
        nearbyList.innerHTML = cardsData.slice(0, 5).map(profileCard).join('');
      }
      if (newList) {
        newList.innerHTML = cardsData.slice(0, 5).map(profileCard).join('');
      }

      $('#recommended-heading').textContent = input?.value ? `Results for “${input.value}”` : 'Recommended matches';
      $('#recommended-subtitle').textContent = `${cardsData.length} live member${cardsData.length === 1 ? '' : 's'} found.`;
    } catch (error) {
      recommendedGrid.innerHTML = '<div class="empty-members">We could not load members right now. Please try again.</div>';
      toast(`Search failed: ${error.message}`);
    } finally {
      recommendedGrid.removeAttribute('aria-busy');
    }
  }
  function bindDiscover() {
    if (!$('#discover-search-form')) return;
    $('#discover-search-form').addEventListener('submit', liveDiscover, true);
    $('#advanced-filters')?.addEventListener('submit', liveDiscover, true);
    $('#filter-toggle')?.addEventListener('click', () => { const filters = $('#advanced-filters'); const open = filters.classList.toggle('is-open'); $('#filter-toggle').setAttribute('aria-expanded', String(open)); });
    $('#discover-mobile-menu')?.addEventListener('click', () => $('#discover-sidebar').classList.toggle('is-open'));
    liveDiscover();
  }

  async function openMemberDrawer(personId) {
    const drawer = $('#member-drawer, #match-drawer');
    const backdrop = $('#member-drawer-backdrop, #match-drawer-backdrop');
    const content = $('#member-drawer-content, #match-drawer-content');
    if (!drawer || !content) return;

    drawer.classList.add('is-open', 'open');
    backdrop?.classList.add('is-open', 'open');
    drawer.setAttribute('aria-hidden', 'false');
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#666">Loading profile...</div>';

    try {
      const { data: person } = await api.client.from('profiles').select('*, profile_media(*)').eq('id', personId).single();
      if (!person) throw new Error('Profile not found.');

      let avatarUrl = person.avatar_url;
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
        avatarUrl = await api.storage.signedUrl('profile-images', avatarUrl);
      }

      const calcAge = (dob) => {
        if (!dob) return '';
        const birth = new Date(`${dob}T00:00:00`);
        const today = new Date();
        let a = today.getFullYear() - birth.getFullYear();
        if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) a -= 1;
        return a > 0 ? a : '';
      };

      const personAge = calcAge(person.date_of_birth);
      const name = escape(person.full_name || 'Member');
      const username = escape(person.username || 'member');
      const city = escape([person.city, person.state].filter(Boolean).join(', ') || 'Location not shared');
      const profession = escape(person.profession || 'Profession not shared');
      const education = escape(person.education || 'Education not shared');
      const manglik = escape(person.manglik_status || 'Manglik status not shared');
      const religion = escape(person.religion || 'Religion not shared');
      const bio = escape(person.bio || 'A thoughtful member of the Manglik Meets community.');
      const initials = escape((person.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase());
      const languages = Array.isArray(person.languages) ? person.languages.join(', ') : escape(person.languages || '—');
      const interests = Array.isArray(person.interests) ? person.interests.join(', ') : escape(person.interests || '—');

      content.innerHTML = `
        <div class="member-visual drawer-profile-visual ${avatarUrl ? 'has-image' : 'tone-saffron'}" ${avatarUrl ? `style="background-image:linear-gradient(rgba(52,35,27,.08),rgba(52,35,27,.3)),url('${escape(avatarUrl)}');background-size:cover;background-position:center"` : ''}>
          <span class="member-initials">${initials}</span>
        </div>
        <h2>${name}${personAge ? `, ${personAge}` : ''} ${person.is_verified ? '<span class="verified-mark">✓</span>' : ''}</h2>
        <p class="drawer-subtitle">@${username} · ${city}</p>
        <div class="drawer-data">
          <div><small>Profession</small><strong>${profession}</strong></div>
          <div><small>Education</small><strong>${education}</strong></div>
          <div><small>Manglik status</small><strong>${manglik}</strong></div>
          <div><small>Religion</small><strong>${religion}</strong></div>
          <div><small>Languages</small><strong>${languages}</strong></div>
          <div><small>Interests</small><strong>${interests}</strong></div>
        </div>
        <p class="drawer-bio">${bio}</p>
        <div class="drawer-actions">
          <button class="member-action" type="button" data-member-action="like" data-member-id="${person.id}">♡ Like</button>
          <button class="member-action" type="button" data-member-action="save" data-member-id="${person.id}">⌑ Save</button>
          <button class="member-action primary" type="button" data-member-action="message" data-member-id="${person.id}">✉ Message</button>
        </div>
      `;
    } catch (error) {
      content.innerHTML = `<div style="padding:30px;text-align:center;color:#c43e3e">Could not load profile: ${escape(error.message)}</div>`;
    }
  }

  function closeMemberDrawer() {
    document.querySelectorAll('#member-drawer, #match-drawer').forEach((d) => {
      d.classList.remove('is-open', 'open');
      d.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('#member-drawer-backdrop, #match-drawer-backdrop').forEach((b) => {
      b.classList.remove('is-open', 'open');
    });
  }

  function bindSocialActions() {
    document.querySelectorAll('#member-drawer-close, #match-drawer-close').forEach((btn) => btn.addEventListener('click', closeMemberDrawer));
    document.querySelectorAll('#member-drawer-backdrop, #match-drawer-backdrop').forEach((backdrop) => backdrop.addEventListener('click', closeMemberDrawer));

    document.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-member-action], [data-match-action]');
      if (!action || !isUuid(action.dataset.memberId || action.dataset.personId)) return;
      const id = action.dataset.memberId || action.dataset.personId;
      const type = action.dataset.memberAction || action.dataset.matchAction;
      if (!['view', 'like', 'save', 'pass', 'message'].includes(type)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (type === 'view') {
        openMemberDrawer(id);
        return;
      }
      try {
        await busy(action, async () => {
          if (type === 'like') await api.social.like(id);
          else if (type === 'save') await api.social.save(id);
          else if (type === 'pass') await api.social.matchAction(id, 'pass');
          else { const conversationId = await api.chat.start(id); sessionStorage.setItem('manglik-meets-open-conversation', conversationId); window.location.href = 'messages.html'; return; }
          toast(type === 'pass' ? 'This suggestion has been passed.' : `${type === 'like' ? 'Like' : 'Saved profile'} updated.`);
        });
      } catch (error) { toast(`Could not update this profile: ${error.message}`); }
    }, true);
  }

  async function bindMatches() {
    const grid = $('#match-grid');
    if (!grid) return;

    const resolveAvatar = async (profile) => {
      if (!profile) return profile;
      let url = profile.avatar_url;
      if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        url = await api.storage.signedUrl('profile-images', url);
      }
      return { ...profile, avatar_url: url || '' };
    };

    const matchCard = (profile, options = {}) => {
      const initials = escape((profile.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2));
      const hasAvatar = !!profile.avatar_url;
      const visualStyle = hasAvatar
        ? ` style="background-image:linear-gradient(rgba(52,35,27,.08),rgba(52,35,27,.3)),url('${escape(profile.avatar_url)}');background-size:cover;background-position:center"`
        : '';
      const unmatchBtn = options.showUnmatch
        ? `<button class="match-action" type="button" data-match-action="unmatch" data-person-id="${profile.id}" aria-label="Unmatch ${escape(profile.full_name)}">✕ Unmatch</button>`
        : `<button class="match-action" type="button" data-match-action="pass" data-person-id="${profile.id}" aria-label="Pass ${escape(profile.full_name)}">×</button>`;

      return `<article class="match-card" data-match-card="${profile.id}">
        <div class="match-visual ${hasAvatar ? 'has-image' : 'tone-saffron'}"${visualStyle}>
          <span class="match-online">${profile.is_online ? '<i></i>Online' : 'Recently active'}</span>
          <span class="match-initials">${initials}</span>
        </div>
        <div class="match-card-body">
          <div class="match-name"><h3>${escape(profile.full_name || 'Member')}, ${age(profile.date_of_birth) || '—'}</h3>${profile.is_verified ? '<span class="match-verified">✓</span>' : ''}</div>
          <p class="match-meta">${escape(profile.city || 'Location not shared')} · ${escape(profile.profession || 'Member')}</p>
          <div class="compatibility-row">
            ${(profile.interests || []).slice(0, 2).map((v) => `<span>${escape(v)}</span>`).join('')}
            <span>${escape(profile.religion || '')}</span>
          </div>
          <div class="match-widget">
            <div><small>Manglik status</small><strong>${escape(profile.manglik_status || '—')}</strong></div>
            <div><small>Education</small><strong>${escape(profile.education || '—')}</strong></div>
          </div>
        </div>
        <div class="match-actions">
          <button class="match-action primary" type="button" data-match-action="view" data-person-id="${profile.id}">View</button>
          <button class="match-action" type="button" data-match-action="like" data-person-id="${profile.id}">♡</button>
          ${unmatchBtn}
          <button class="match-action" type="button" data-match-action="save" data-person-id="${profile.id}">⌑</button>
          <button class="match-action" type="button" data-match-action="message" data-person-id="${profile.id}">✉</button>
        </div>
      </article>`;
    };

    const render = async () => {
      grid.setAttribute('aria-busy', 'true');
      grid.innerHTML = '<div style="padding:40px;text-align:center;color:#666">Loading matches…</div>';
      try {
        const user = await api.requireUser();
        const view = (window.location.hash || '#mutual').slice(1) || 'mutual';

        /* Fetch mutual matches */
        const mutualRows = await api.social.matches();

        /* Fetch pending likes (people who liked me but I haven't liked back) */
        let pendingRows = [];
        try { pendingRows = await api.social.pendingLikes(); } catch (e) { console.warn('Pending likes unavailable:', e.message); }

        /* Fetch suggested profiles (everyone not already matched or pending, filtered by opposite gender) */
        let suggestedProfiles = [];
        try {
          const opp = await getOppositeGender();
          const filters = opp ? { gender: opp } : {};
          const allProfiles = await api.profile.search({ filters, limit: 50 });
          const matchedIds = new Set(mutualRows.map((r) => r.user_one_id === user.id ? r.user_two_id : r.user_one_id));
          const pendingIds = new Set(pendingRows.map((r) => r.user_one_id || r.user_id));
          suggestedProfiles = (allProfiles || []).filter((p) => p.id !== user.id && !matchedIds.has(p.id) && !pendingIds.has(p.id));
        } catch (e) { console.warn('Suggested profiles unavailable:', e.message); }

        /* Resolve avatars for all profile sets */
        const resolveAll = async (rows, getProfile) => {
          return Promise.all(rows.map(async (row) => {
            const profile = getProfile(row, user);
            if (!profile) return null;
            return resolveAvatar(profile);
          }));
        };

        const mutualProfiles = (await resolveAll(mutualRows, (row, u) =>
          row._other || (row.user_one_id === u.id ? (row.user_two || row.matched_user) : (row.user_one || row.user))
        )).filter(Boolean);

        const pendingProfiles = (await resolveAll(pendingRows, (row) =>
          row.user_one || row.matched_user
        )).filter(Boolean);

        const suggested = await Promise.all(suggestedProfiles.slice(0, 20).map(resolveAvatar));

        /* Update counts */
        const suggestedCount = suggested.length;
        const pendingCount = pendingProfiles.length;
        const mutualCount = mutualProfiles.length;
        $('#suggested-count').textContent = suggestedCount;
        $('#pending-count').textContent = pendingCount;
        $('#mutual-count').textContent = mutualCount;
        $('#pending-tab-count').textContent = pendingCount;

        /* Render the active view */
        let items = [];
        let showUnmatch = false;
        if (view === 'mutual') {
          items = mutualProfiles;
          showUnmatch = true;
        } else if (view === 'pending') {
          items = pendingProfiles;
        } else if (view === 'suggested') {
          items = suggested;
        } else if (view === 'favorites') {
          try {
            const savedRows = await api.social.saved();
            items = await Promise.all((savedRows || []).map(async (row) => {
              if (!row.profiles) return null;
              return resolveAvatar(row.profiles);
            }));
            items = items.filter(Boolean);
          } catch (e) { console.warn('Favorites unavailable:', e.message); }
        } else if (view === 'viewed') {
          items = []; /* Recently viewed is client-side only; show empty */
        } else {
          items = suggested;
        }

        grid.innerHTML = items.length
          ? items.map((profile) => matchCard(profile, { showUnmatch })).join('')
          : '';
        $('#matches-empty').hidden = items.length !== 0;
      } catch (error) {
        grid.innerHTML = '';
        $('#matches-empty').hidden = false;
        toast(`Matches could not load: ${error.message}`);
      } finally {
        grid.removeAttribute('aria-busy');
      }
    };

    await render();

    /* Listen for realtime changes to matches table */
    try {
      api.client.channel('live-matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, render).subscribe();
    } catch (e) { console.warn('Realtime subscription not available:', e.message); }

    /* Tab switching */
    document.querySelectorAll('.match-tab').forEach((tab) => tab.addEventListener('click', () => {
      window.location.hash = tab.dataset.matchView;
      document.querySelectorAll('.match-tab').forEach((item) => item.classList.toggle('active', item === tab));
      setTimeout(render, 0);
    }));

    /* Handle unmatch action */
    grid.addEventListener('click', async (event) => {
      const unmatchBtn = event.target.closest('[data-match-action="unmatch"]');
      if (!unmatchBtn) return;
      const profileId = unmatchBtn.dataset.personId;
      if (!profileId || !isUuid(profileId)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await busy(unmatchBtn, async () => {
          await api.social.unmatch(profileId);
          toast('You have been unmatched.');
          await render();
        });
      } catch (error) { toast(`Could not unmatch: ${error.message}`); }
    });
  }

  async function bindNotifications() {
    if (!$('#notification-list')) return;
    const render = async () => {
      try { const rows = await api.notifications.list(); const list = $('#notification-list'); list.innerHTML = rows.map((item) => `<article class="notification-row ${item.is_read ? '' : 'unread'}" data-live-notification-id="${item.id}"><span class="notification-icon icon-${escape(item.category)}">✦</span><div class="notification-copy"><strong>${escape(item.actor?.full_name || 'Manglik Meets')} ${escape(item.title)}</strong><span>${escape(item.body || '')}</span></div><div class="notification-meta"><small>${new Date(item.created_at).toLocaleDateString()}</small><div class="notification-row-actions"><button type="button" data-live-notification="${item.is_read ? 'unread' : 'read'}">${item.is_read ? '•' : '✓'}</button><button type="button" data-live-notification="delete">×</button></div></div></article>`).join(''); $('#notifications-empty').hidden = rows.length !== 0; const unread = rows.filter((item) => !item.is_read).length; $('#notification-summary').textContent = unread ? `You have ${unread} unread update${unread === 1 ? '' : 's'} waiting.` : 'You are all caught up.'; window.ManglikNotificationBadges?.setUnreadCount(unread); } catch (error) { toast(`Notifications could not load: ${error.message}`); }
    };
    await render();
    const user = await api.requireUser().catch(() => null); if (user) api.notifications.subscribe(user.id, render);
    $('#notification-list').addEventListener('click', async (event) => { const control = event.target.closest('[data-live-notification]'); if (!control) return; const id = control.closest('[data-live-notification-id]')?.dataset.liveNotificationId; try { if (control.dataset.liveNotification === 'delete') await api.client.from('notifications').delete().eq('id', id); else await api.notifications.read(id, control.dataset.liveNotification === 'read'); await render(); } catch (error) { toast(error.message); } });
    $('#mark-all-read')?.addEventListener('click', async () => { try { await api.notifications.markAllRead(); await render(); } catch (error) { toast(error.message); } });
    $('#clear-read')?.addEventListener('click', async () => { try { await api.notifications.clearRead(); await render(); } catch (error) { toast(error.message); } });
  }

  function bindSettings() {
    if (!$('#settings-account')) return;
    $('#update-email-form')?.addEventListener('submit', async () => { const email = $('#new-email').value.trim(); if (!email) return; try { await api.settings.updateEmail(email); toast('Update email request sent. Check your new inbox if confirmation is enabled.'); } catch (error) { toast(error.message); } });
    $('#change-password-form')?.addEventListener('submit', async () => { const password = $('#new-password').value; if (!password || password !== $('#confirm-password').value) return; try { await api.settings.updatePassword(password); toast('Password updated securely.'); } catch (error) { toast(error.message); } });
    document.querySelectorAll('form[data-supabase-action="update-mobile"], form[data-supabase-action="update-recovery-email"], form[data-supabase-action="update-profile"], form[data-supabase-action="update-privacy"]').forEach((form) => form.addEventListener('submit', async () => { try { const source = {}; form.querySelectorAll('[data-setting-field]').forEach((field) => { source[field.dataset.settingField] = field.type === 'checkbox' ? field.checked : field.value.trim(); }); await api.profile.patch(source); toast('Profile settings saved.'); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('form[data-supabase-action="upsert-notification-preferences"], form[data-supabase-action="upsert-appearance"], form[data-supabase-action="upsert-accessibility"]').forEach((form) => form.addEventListener('submit', async () => { const values = {}; form.querySelectorAll('[data-setting-field]').forEach((field) => values[field.dataset.settingField] = field.type === 'checkbox' ? field.checked : field.value); delete values.sms_notifications; try { await api.settings.save(values); toast('Account preferences saved.'); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('[data-setting-media]').forEach((input) => input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; try { await api.profile.upload(file, input.dataset.settingMedia); toast('Profile image uploaded securely.'); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('[data-future-action="logout"]').forEach((button) => button.addEventListener('click', async () => { try { await api.settings.signOut(); window.location.href = 'index.html'; } catch (error) { toast(error.message); } }));
    $('#logout-other-devices')?.addEventListener('click', async () => { try { await api.settings.signOut('others'); toast('Other sessions have been signed out.'); } catch (error) { toast(error.message); } });
  }

  async function bindFeed() {
    if (!$('#composer-form')) return;

    const currentUser = await api.requireUser().catch(() => null);

    if (currentUser) {
      try {
        const myProfile = await api.profile.mine();
        if (myProfile?.full_name) {
          const initials = myProfile.full_name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
          const avatarNode = $('.composer-avatar');
          if (avatarNode) avatarNode.textContent = initials;
        }
      } catch (e) {}
    }

    const renderLiveFeed = async () => {
      const list = $('#feed-list');
      const skeletons = $('#feed-skeletons');
      const loadState = $('#feed-load-state');

      if (!list) return;

      try {
        const posts = await api.feed.list();
        const cardsHtml = await Promise.all((posts || []).map(async (post) => {
          const author = post.profiles || {};
          const name = escape(author.full_name || 'Community Member');
          const initials = escape((author.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase());
          let avatarUrl = author.avatar_url || '';
          if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
            avatarUrl = await api.storage.signedUrl('profile-images', avatarUrl);
          }
          const isLiked = Array.isArray(post.post_reactions) && currentUser && post.post_reactions.some((r) => r.user_id === currentUser.id);
          const likeCount = Array.isArray(post.post_reactions) ? post.post_reactions.length : 0;
          const postDate = new Date(post.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const postType = escape(post.post_type || 'Discussion');

          return `<article class="feed-post" data-post-card="${post.id}">
            <header class="post-head">
              <div class="post-avatar ${avatarUrl ? 'has-image' : 'avatar-saffron'}"${avatarUrl ? ` style="background-image:url('${escape(avatarUrl)}');background-size:cover;background-position:center"` : ''}>
                ${initials}
              </div>
              <div class="post-author">
                <strong>${name}</strong>
                <span>${postDate}</span>
              </div>
              <span class="post-type">${postType}</span>
            </header>
            <div class="post-body">
              <p>${escape(post.body || '')}</p>
            </div>
            <footer class="post-actions">
              <button class="post-action ${isLiked ? 'active' : ''}" type="button" data-post-action="like" data-post-id="${post.id}">
                <span>♡</span><em>${likeCount}</em>
              </button>
              <button class="post-action" type="button" data-post-action="share" data-post-id="${post.id}">
                <span>↗</span>
              </button>
            </footer>
          </article>`;
        }));

        list.innerHTML = cardsHtml.length ? cardsHtml.join('') : '';
        const emptyNode = $('#feed-empty');
        if (emptyNode) emptyNode.hidden = cardsHtml.length !== 0;
      } catch (error) {
        console.warn('Feed load failed:', error.message);
        const emptyNode = $('#feed-empty');
        if (emptyNode) emptyNode.hidden = false;
      } finally {
        if (skeletons) skeletons.hidden = true;
        if (loadState) loadState.hidden = true;
      }
    };

    await renderLiveFeed();

    $('#open-composer')?.addEventListener('click', () => {
      $('#composer-modal')?.classList.add('open');
      $('#composer-modal-backdrop')?.classList.add('open');
      $('#post-body')?.focus();
    });

    document.querySelectorAll('[data-composer-type]').forEach((button) => button.addEventListener('click', () => {
      const postBody = $('#post-body');
      if (postBody) postBody.dataset.postType = button.dataset.composerType;
      $('#composer-modal')?.classList.add('open');
      $('#composer-modal-backdrop')?.classList.add('open');
      $('#post-body')?.focus();
    }));

    const closeComposer = () => {
      $('#composer-modal')?.classList.remove('open');
      $('#composer-modal-backdrop')?.classList.remove('open');
    };

    $('#composer-close')?.addEventListener('click', closeComposer);
    $('#composer-modal-backdrop')?.addEventListener('click', closeComposer);

    $('#composer-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const bodyInput = $('#post-body');
      const body = bodyInput ? bodyInput.value.trim() : '';
      if (!body) return;
      try {
        toast('Publishing update…');
        await api.feed.create({ body, postType: bodyInput.dataset.postType || 'discussion' });
        if (bodyInput) bodyInput.value = '';
        closeComposer();
        await renderLiveFeed();
        toast('Your update was published to the community feed.');
      } catch (error) {
        toast(`Could not publish post: ${error.message}`);
      }
    }, true);

    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-post-action="like"]');
      if (!button || !isUuid(button.dataset.postId)) return;
      try {
        await api.feed.toggleReaction(button.dataset.postId);
        await renderLiveFeed();
      } catch (error) {
        toast(error.message);
      }
    });
  }

  async function bindMessages() {
    const chatList = $('#chat-list');
    if (!chatList) return;

    let active = sessionStorage.getItem('manglik-meets-open-conversation') || '';
    const currentUser = await api.requireUser().catch(() => null);
    if (!currentUser) return;

    let channel = null;
    let selectedImageFile = null;
    let conversationsCache = [];

    const resolveAvatar = async (profile) => {
      if (!profile) return '';
      let url = profile.avatar_url;
      if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        url = await api.storage.signedUrl('profile-images', url);
      }
      return url || '';
    };

    const resolveMediaUrl = async (item) => {
      const pathOrUrl = item.media_url || item.image_path;
      if (!pathOrUrl) return '';
      if (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('data:')) return pathOrUrl;
      return api.storage.signedUrl('chat-media', pathOrUrl);
    };

    const renderHeaderAndDetails = async (otherProfile) => {
      const headerNode = $('#chat-header');
      const detailsNode = $('#conversation-details');
      if (!otherProfile) {
        if (headerNode) headerNode.innerHTML = '<div><strong>Conversation</strong></div>';
        if (detailsNode) detailsNode.innerHTML = '';
        return;
      }

      const avatarUrl = await resolveAvatar(otherProfile);
      const name = escape(otherProfile.full_name || 'Member');
      const initials = escape((otherProfile.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase());
      const isOnline = !!otherProfile.is_online;
      const statusText = isOnline ? 'Online now' : 'Recently active';

      if (headerNode) {
        headerNode.innerHTML = `
          <button class="chat-mobile-list-toggle" id="chat-mobile-list-toggle" type="button" aria-label="Show chats">‹</button>
          <span class="chat-avatar ${avatarUrl ? 'has-image' : 'tone-saffron'}"${avatarUrl ? ` style="background-image:url('${escape(avatarUrl)}');background-size:cover;background-position:center"` : ''}>
            ${initials}${isOnline ? '<i class="online-dot"></i>' : ''}
          </span>
          <div class="chat-contact">
            <strong>${name}</strong>
            <span>${statusText}</span>
          </div>
          <div class="chat-header-actions">
            <button type="button" data-header-action="details" aria-label="Conversation info">ⓘ</button>
          </div>
        `;
      }

      if (detailsNode) {
        detailsNode.innerHTML = `
          <div class="detail-avatar ${avatarUrl ? 'has-image' : 'tone-saffron'}"${avatarUrl ? ` style="background-image:url('${escape(avatarUrl)}');background-size:cover;background-position:center"` : ''}>
            ${initials}${isOnline ? '<i class="online-dot"></i>' : ''}
          </div>
          <h1 class="detail-name">${name}</h1>
          <p class="detail-status">${statusText}</p>
          <div class="detail-actions">
            <button type="button" data-detail-action="profile" data-profile-id="${otherProfile.id}">View profile</button>
          </div>
        `;
      }
    };

    const renderThread = async () => {
      if (!active) {
        const thread = $('#message-thread');
        if (thread) thread.innerHTML = '<div class="chat-list-empty"><p>Select or start a conversation to begin chatting.</p></div>';
        return;
      }

      const thread = $('#message-thread');
      if (!thread) return;

      thread.setAttribute('aria-busy', 'true');
      try {
        const items = await api.chat.messages(active);
        const resolvedItems = await Promise.all(items.map(async (item) => {
          const imageUrl = await resolveMediaUrl(item);
          return { ...item, imageUrl };
        }));

        if (!resolvedItems.length) {
          thread.innerHTML = '<div class="chat-list-empty"><p>No messages yet. Send a message to start the conversation!</p></div>';
        } else {
          let previousDateStr = '';
          thread.innerHTML = resolvedItems.map((item) => {
            const isMine = item.sender_id === currentUser.id;
            const textContent = escape(item.body || item.content || '');
            const msgDate = new Date(item.created_at);
            const dateStr = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            let dateHeader = '';
            if (dateStr !== previousDateStr) {
              previousDateStr = dateStr;
              dateHeader = `<div class="date-separator">${escape(dateStr)}</div>`;
            }
            const timeStr = msgDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const imgTag = item.imageUrl ? `<div style="margin-bottom:6px;"><img src="${escape(item.imageUrl)}" alt="Chat photo" style="max-width:240px;max-height:240px;border-radius:12px;display:block;cursor:pointer;" onclick="window.open('${escape(item.imageUrl)}','_blank')"></div>` : '';

            return `${dateHeader}
              <div class="message-row ${isMine ? 'own mine' : ''}" data-message-id="${item.id}">
                ${isMine ? `<button class="message-action-trigger" type="button" data-message-delete="${item.id}" title="Delete message">×</button>` : ''}
                <div class="message-bubble">
                  ${imgTag}
                  ${textContent ? `<p>${textContent}</p>` : ''}
                  <small class="message-time">${escape(timeStr)}${isMine ? '<span class="read-receipt">✓✓</span>' : ''}</small>
                </div>
              </div>`;
          }).join('');
        }

        /* Auto-scroll to bottom */
        requestAnimationFrame(() => {
          thread.scrollTop = thread.scrollHeight;
        });
      } catch (error) {
        toast(`Messages could not load: ${error.message}`);
      } finally {
        thread.removeAttribute('aria-busy');
      }
    };

    const renderConversations = async () => {
      try {
        const rows = await api.chat.conversations();
        conversationsCache = rows;

        const resolvedConvs = await Promise.all(rows.map(async (row) => {
          const members = row.conversations?.conversation_members || [];
          const otherMember = members.find((m) => m.user_id !== currentUser.id);
          const otherProfile = otherMember?.profiles || null;
          const avatarUrl = otherProfile ? await resolveAvatar(otherProfile) : '';
          return { ...row, otherProfile, avatarUrl };
        }));

        const filterTerm = ($('#chat-search-input')?.value || '').trim().toLowerCase();
        const activeFilter = $('.chat-filter.active')?.dataset.chatFilter || 'recent';

        const filtered = resolvedConvs.filter(({ otherProfile }) => {
          if (!otherProfile) return true;
          const name = (otherProfile.full_name || '').toLowerCase();
          const username = (otherProfile.username || '').toLowerCase();
          const matchesTerm = !filterTerm || name.includes(filterTerm) || username.includes(filterTerm);
          return matchesTerm;
        });

        chatList.innerHTML = filtered.length
          ? filtered.map(({ conversation_id, otherProfile, avatarUrl }) => {
              const name = escape(otherProfile?.full_name || 'Private conversation');
              const initials = escape((otherProfile?.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase());
              const isOnline = !!otherProfile?.is_online;
              const isActive = conversation_id === active;
              return `<button class="chat-row ${isActive ? 'active' : ''}" type="button" data-live-conversation="${conversation_id}">
                <span class="chat-avatar ${avatarUrl ? 'has-image' : 'tone-saffron'}"${avatarUrl ? ` style="background-image:url('${escape(avatarUrl)}');background-size:cover;background-position:center"` : ''}>
                  ${initials}${isOnline ? '<i class="online-dot"></i>' : ''}
                </span>
                <span class="chat-row-copy">
                  <strong>${name}</strong>
                  <span>Click to open conversation</span>
                </span>
              </button>`;
            }).join('')
          : '<div class="chat-list-empty"><p>No conversations found.</p></div>';

        $('#chat-list-empty').hidden = filtered.length !== 0;

        /* Auto-select active conversation */
        if (!active && filtered.length) {
          active = filtered[0].conversation_id;
          sessionStorage.setItem('manglik-meets-open-conversation', active);
        }

        /* Render header and details for active conversation */
        const activeConv = resolvedConvs.find((c) => c.conversation_id === active);
        await renderHeaderAndDetails(activeConv?.otherProfile || null);

        /* Render thread */
        await renderThread();
      } catch (error) {
        toast(`Conversations could not load: ${error.message}`);
      }
    };

    await renderConversations();

    /* Subscribe to realtime message changes for active conversation */
    const subscribeRealtime = (convId) => {
      if (channel) channel.unsubscribe();
      if (!convId) return;
      channel = api.chat.subscribe(convId, async () => {
        await renderThread();
        await renderConversations();
      });
    };

    if (active) subscribeRealtime(active);

    /* Click conversation item */
    chatList.addEventListener('click', async (event) => {
      const row = event.target.closest('[data-live-conversation]');
      if (!row) return;
      active = row.dataset.liveConversation;
      sessionStorage.setItem('manglik-meets-open-conversation', active);
      subscribeRealtime(active);
      await renderConversations();
    });

    /* Conversation search input */
    $('#chat-search-input')?.addEventListener('input', () => {
      renderConversations();
    });

    /* Attachment button & file selection */
    const attachmentBtn = $('#attachment-button, #image-button');
    const imageInput = $('#image-upload-input');
    const imagePreview = $('#image-preview');
    const previewImg = $('#image-preview-image');
    const removePreviewBtn = $('#remove-image-preview');

    attachmentBtn?.addEventListener('click', () => imageInput?.click());

    imageInput?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast('Image must be smaller than 2 MB.');
        imageInput.value = '';
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast('Choose a JPG, PNG, or WebP image file.');
        imageInput.value = '';
        return;
      }
      selectedImageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg) previewImg.src = e.target.result;
        if (imagePreview) imagePreview.hidden = false;
      };
      reader.readAsDataURL(file);
    });

    removePreviewBtn?.addEventListener('click', () => {
      selectedImageFile = null;
      if (imageInput) imageInput.value = '';
      if (imagePreview) imagePreview.hidden = true;
    });

    /* Emoji picker toggle & insertion */
    const emojiToggle = $('#emoji-toggle');
    const emojiPicker = $('#emoji-picker');
    const messageInput = $('#message-input');

    emojiToggle?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (emojiPicker) emojiPicker.hidden = !emojiPicker.hidden;
    });

    emojiPicker?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (messageInput) {
        messageInput.value += btn.textContent;
        messageInput.focus();
      }
      if (emojiPicker) emojiPicker.hidden = true;
    });

    document.addEventListener('click', (e) => {
      if (emojiPicker && !emojiPicker.hidden && !e.target.closest('.emoji-picker-wrap')) {
        emojiPicker.hidden = true;
      }
    });

    /* Enter key to send (Shift+Enter for newline) */
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('#message-composer')?.requestSubmit();
      }
    });

    /* Form submit: Send text or image message */
    $('#message-composer')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!active) {
        toast('Please select a conversation first.');
        return;
      }

      const textInput = $('#message-input');
      const text = textInput ? textInput.value.trim() : '';

      if (!text && !selectedImageFile) return;

      try {
        let mediaUrl = null;
        let messageType = 'text';

        if (selectedImageFile) {
          toast('Uploading chat photo…');
          const uploadRes = await api.chat.uploadImage(selectedImageFile, active);
          mediaUrl = uploadRes.path;
          messageType = 'image';
        }

        await api.chat.send({
          conversationId: active,
          body: text || null,
          content: text || null,
          mediaUrl,
          messageType
        });

        if (textInput) textInput.value = '';
        selectedImageFile = null;
        if (imageInput) imageInput.value = '';
        if (imagePreview) imagePreview.hidden = true;
        if (emojiPicker) emojiPicker.hidden = true;

        await renderThread();
        await renderConversations();
      } catch (error) {
        toast(`Could not send message: ${error.message}`);
      }
    }, true);

    /* Delete message handler */
    $('#message-thread')?.addEventListener('click', async (event) => {
      const delBtn = event.target.closest('[data-message-delete]');
      if (!delBtn) return;
      const msgId = delBtn.dataset.messageDelete;
      if (!msgId) return;
      try {
        await api.chat.deleteMessage(msgId);
        toast('Message deleted.');
        await renderThread();
      } catch (error) {
        toast(`Could not delete message: ${error.message}`);
      }
    });

    /* Details panel action buttons */
    $('#conversation-details')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-detail-action="profile"]');
      if (btn?.dataset.profileId) {
        openMemberDrawer(btn.dataset.profileId);
      }
    });
  }

  bindProfile(); bindDiscover(); bindSocialActions(); bindMatches(); bindNotifications(); bindSettings(); bindFeed(); bindMessages();
}());
