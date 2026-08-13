/* Supabase data layer for Manglik Meets. All browser queries use the publishable key and RLS. */
(function () {
  'use strict';
  const auth = window.ManglikAuth;
  const client = auth?.client;
  const bucket = 'profile-images';
  const noClient = () => !client ? new Error('Supabase is not configured.') : null;
  const fail = (error, context) => { const message = error?.message || 'Something went wrong.'; console.error(`[Manglik Meets] ${context}`, error); return new Error(message); };
  const requireUser = async () => { if (noClient()) throw noClient(); const { data, error } = await client.auth.getUser(); if (error) throw fail(error, 'session'); if (!data.user) throw new Error('Please sign in to continue.'); return data.user; };
  const run = async (request, context) => { const { data, error } = await request; if (error) throw fail(error, context); return data; };
  const array = (value) => Array.isArray(value) ? value : String(value || '').split(',').map((v) => v.trim()).filter(Boolean);
  const toDbProfile = (state) => {
    const payload = {
      full_name: state.name ?? state.full_name, username: state.username?.toLowerCase() || null, date_of_birth: state.dob || state.date_of_birth || null,
      gender: state.gender || null, height: state.height || null, weight: state.weight || null, religion: state.religion || null, caste: state.caste || null,
      manglik_status: state.manglikStatus || state.manglik_status || null, profession: state.profession || null, education: state.education || null,
      income: state.income || null, languages: array(state.languages), bio: state.bio || null, interests: array(state.interests), hobbies: array(state.hobbies),
      personality_traits: array(state.personalityTraits || state.personality_traits), smoking: state.smoking || null, drinking: state.drinking || null,
      food_preference: state.foodPreference || state.food_preference || null, fitness: state.fitness || null, pets: state.pets || null,
      looking_for: state.lookingFor || state.looking_for || null, marriage_timeline: state.marriageTimeline || state.marriage_timeline || null,
      family_type: state.familyType || state.family_type || null, values_text: state.values || state.values_text || null, expectations: state.expectations || null,
      city: state.city || null, state: state.state || null, mobile_number: state.mobile_number || state.mobile || null, recovery_email: state.recovery_email || null,
      private_profile: state.private_profile ?? !!state.privacy?.privateProfile,
      hide_age: state.hide_age ?? !!state.privacy?.hideAge, hide_city: state.hide_city ?? !!state.privacy?.hideCity, hide_profession: state.hide_profession ?? !!state.privacy?.hideProfession,
      hide_last_seen: state.hide_last_seen ?? !!state.privacy?.hideLastSeen, hide_online_status: state.hide_online_status ?? !!state.privacy?.hideOnlineStatus
    };
    if (state.avatar_url) payload.avatar_url = state.avatar_url;
    if (state.cover_url) payload.cover_url = state.cover_url;
    return payload;
  };
  const fromDbProfile = (p) => !p ? null : ({ ...p, avatar_url: p.avatar_url || '', cover_url: p.cover_url || '', name: p.full_name || '', dob: p.date_of_birth || '', manglikStatus: p.manglik_status || '', foodPreference: p.food_preference || '', personalityTraits: (p.personality_traits || []).join(', '), lookingFor: p.looking_for || '', marriageTimeline: p.marriage_timeline || '', familyType: p.family_type || '', values: p.values_text || '', languages: (p.languages || []).join(', '), interests: (p.interests || []).join(', '), hobbies: (p.hobbies || []).join(', '), privacy: { privateProfile: p.private_profile, hideAge: p.hide_age, hideCity: p.hide_city, hideProfession: p.hide_profession, hideLastSeen: p.hide_last_seen, hideOnlineStatus: p.hide_online_status } });
  const profile = {
    async mine() { const user = await requireUser(); return fromDbProfile(await run(client.from('profiles').select('*, profile_media(*)').eq('id', user.id).maybeSingle(), 'load profile')); },
    async save(state) { const user = await requireUser(); const payload = { id: user.id, ...toDbProfile(state) }; return fromDbProfile(await run(client.from('profiles').upsert(payload).select().single(), 'save profile')); },
    async patch(values) { const user = await requireUser(); return fromDbProfile(await run(client.from('profiles').update(values).eq('id', user.id).select().single(), 'update profile')); },
    async search({ query = '', filters = {}, limit = 100, from = 0 } = {}) { await requireUser(); let request = client.from('profiles').select('id, full_name, username, date_of_birth, gender, city, state, profession, education, religion, interests, languages, bio, manglik_status, avatar_url, cover_url, is_verified, is_online, last_active_at, created_at, profile_media(*)').order('created_at', { ascending: false }).range(from, from + limit - 1); const term = query.trim().replace(/[,%()]/g, ''); if (term) request = request.or(`full_name.ilike.%${term}%,username.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%,profession.ilike.%${term}%,education.ilike.%${term}%,religion.ilike.%${term}%`); if (filters.gender) request = request.eq('gender', filters.gender); if (filters.religion) request = request.eq('religion', filters.religion); if (filters.manglik) request = request.eq('manglik_status', filters.manglik); if (filters.profession) request = request.ilike('profession', `%${filters.profession}%`); if (filters.education) request = request.ilike('education', `%${filters.education}%`); if (filters.income) request = request.eq('income', filters.income); if (filters.verifiedOnly) request = request.eq('is_verified', true); if (filters.onlineOnly) request = request.eq('is_online', true); if (filters.recentlyActive) request = request.gte('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString()); if (filters.ageMin || filters.ageMax) { const today = new Date(); if (filters.ageMin) { const latest = new Date(today.getFullYear() - Number(filters.ageMin), today.getMonth(), today.getDate()).toISOString().slice(0, 10); request = request.lte('date_of_birth', latest); } if (filters.ageMax) { const earliest = new Date(today.getFullYear() - Number(filters.ageMax) - 1, today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10); request = request.gte('date_of_birth', earliest); } } return run(request, 'search profiles'); },
    async upload(file, type, sortOrder = 0) {
      const user = await requireUser();
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!file || !allowedTypes.includes(file.type)) throw new Error('Choose a valid JPG, PNG, or WebP image.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
      const bucketId = 'profile-images';
      const mediaType = ['avatar', 'cover', 'gallery'].includes(type) ? type : 'gallery';
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${mediaType}/${crypto.randomUUID()}.${extension}`;

      if (mediaType === 'avatar' || mediaType === 'cover') {
        try {
          const { data: currentProfile } = await client.from('profiles').select(`${mediaType}_url`).eq('id', user.id).maybeSingle();
          const oldPath = currentProfile?.[`${mediaType}_url`];
          if (oldPath && !oldPath.startsWith('http') && !oldPath.startsWith('data:')) {
            await client.storage.from(bucketId).remove([oldPath]);
          }
          await client.from('profile_media').delete().eq('profile_id', user.id).eq('media_type', mediaType);
        } catch (e) {
          console.warn(`[Previous ${mediaType} cleanup note]:`, e.message);
        }
      }

      await run(client.storage.from(bucketId).upload(path, file, { upsert: true, contentType: file.type }), 'upload image');
      const row = await run(client.from('profile_media').insert({ profile_id: user.id, bucket_id: bucketId, storage_path: path, media_type: mediaType, mime_type: file.type, size_bytes: file.size, sort_order: sortOrder }).select().single(), 'save media');
      const resolvedUrl = (await storage.signedUrl(bucketId, path)) || storage.publicUrl(bucketId, path);
      if (mediaType === 'avatar' || mediaType === 'cover') await run(client.from('profiles').update({ [`${mediaType}_url`]: path }).eq('id', user.id), 'link image');
      return { ...row, url: resolvedUrl, signedUrl: resolvedUrl };
    },
    async mediaUrls(media) { if (!media?.length) return []; return Promise.all(media.map(async (item) => ({ ...item, url: await storage.signedUrl(item.bucket_id || 'profile-images', item.storage_path) }))); },
    async deleteMedia(media) { await requireUser(); await run(client.storage.from(media.bucket_id || 'profile-images').remove([media.storage_path]), 'delete image'); return run(client.from('profile_media').delete().eq('id', media.id), 'delete media record'); },
    async reorderMedia(media) { const user = await requireUser(); return Promise.all(media.map((item, index) => run(client.from('profile_media').update({ sort_order: index }).eq('id', item.id).eq('profile_id', user.id), 'reorder media'))); }
  };
  profile.searchPage = async ({ query = '', filters = {}, from = 0, pageSize = 24 } = {}) => {
    const rows = await profile.search({ query, filters, from, limit: pageSize + 1 });
    return { data: rows.slice(0, pageSize), nextFrom: rows.length > pageSize ? from + pageSize : null };
  };
  const social = {
    async toggle(table, profileId) {
      const user = await requireUser();
      if (profileId === user.id) throw new Error('You cannot perform this action on yourself.');
      const exists = await run(client.from(table).select('profile_id').eq('user_id', user.id).eq('profile_id', profileId).maybeSingle(), 'check action');
      if (exists) {
        await run(client.from(table).delete().eq('user_id', user.id).eq('profile_id', profileId), 'remove action');
        /* If unliking, also remove any mutual match */
        if (table === 'profile_likes') await this.removeMatch(profileId);
        return false;
      }
      await run(client.from(table).insert({ user_id: user.id, profile_id: profileId }), 'save action');
      /* Check for mutual like and auto-create match */
      if (table === 'profile_likes') {
        try {
          const { data: mutual } = await client.from('profile_likes').select('user_id').eq('user_id', profileId).eq('profile_id', user.id).maybeSingle();
          if (mutual) await this.createMatch(user.id, profileId);
        } catch (e) { console.warn('[Mutual like check]:', e.message); }
      }
      return true;
    },
    like(id) { return this.toggle('profile_likes', id); },
    save(id) { return this.toggle('saved_profiles', id); },
    async createMatch(userId, matchedUserId) {
      if (userId === matchedUserId) return;
      try {
        /* Store canonical pair — smaller UUID first to keep one row per pair. */
        const [one, two] = userId < matchedUserId ? [userId, matchedUserId] : [matchedUserId, userId];
        const payload = { user_one_id: one, user_two_id: two, status: 'matched' };
        await client.from('matches').upsert(payload, { onConflict: 'user_one_id,user_two_id' });
      } catch (e) { console.warn('[Match creation]:', e.message); }
    },
    async removeMatch(profileId) {
      const user = await requireUser();
      /* Delete match rows in either direction (stored as canonical pair) */
      try {
        await client.from('matches').delete().or(
          `and(user_one_id.eq.${user.id},user_two_id.eq.${profileId}),and(user_one_id.eq.${profileId},user_two_id.eq.${user.id})`
        );
      } catch (e) { console.warn('[Match removal]:', e.message); }
    },
    async unmatch(profileId) {
      const user = await requireUser();
      /* Remove match rows in both directions */
      await this.removeMatch(profileId);
      /* Also remove both sides of the like so they aren't re-matched */
      try {
        await client.from('profile_likes').delete().or(
          `and(user_id.eq.${user.id},profile_id.eq.${profileId}),and(user_id.eq.${profileId},profile_id.eq.${user.id})`
        );
      } catch (e) { console.warn('[Like cleanup on unmatch]:', e.message); }
    },
    async matchAction(profileId, action) { const user = await requireUser(); return run(client.from('match_actions').upsert({ user_id: user.id, profile_id: profileId, action, updated_at: new Date().toISOString() }), 'save match action'); },
    async saved() { const user = await requireUser(); return run(client.from('saved_profiles').select('created_at, profiles!profile_id(*)').eq('user_id', user.id).order('created_at', { ascending: false }), 'load saved profiles'); },
    async matches() {
      const user = await requireUser();
      let data = null;
      /* Strategy 1: Query with actual DB columns user_one_id / user_two_id and named FK constraints */
      try {
        const res = await client.from('matches')
          .select('*, user_one:profiles!matches_user_one_id_fkey(*), user_two:profiles!matches_user_two_id_fkey(*)')
          .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
          .order('created_at', { ascending: false });
        if (res.error) throw res.error;
        data = res.data || [];
      } catch (e1) {
        console.warn('[Matches query strategy 1]:', e1.message);
        /* Strategy 2: Try generic column-name hint syntax */
        try {
          const res2 = await client.from('matches')
            .select('*, user_one:profiles!user_one_id(*), user_two:profiles!user_two_id(*)')
            .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
            .order('created_at', { ascending: false });
          if (res2.error) throw res2.error;
          data = res2.data || [];
        } catch (e2) {
          console.warn('[Matches query strategy 2]:', e2.message);
          /* Strategy 3: Fetch match rows without join, then hydrate profiles manually */
          try {
            const { data: rawMatches } = await client.from('matches')
              .select('id, user_one_id, user_two_id, status, created_at')
              .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`);
            if (rawMatches?.length) {
              const otherIds = rawMatches.map((r) => r.user_one_id === user.id ? r.user_two_id : r.user_one_id);
              const { data: profiles } = await client.from('profiles').select('*').in('id', otherIds);
              const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
              data = rawMatches.map((r) => {
                const otherId = r.user_one_id === user.id ? r.user_two_id : r.user_one_id;
                return { ...r, user_one: profileMap[r.user_one_id] || null, user_two: profileMap[r.user_two_id] || null, _other: profileMap[otherId] || null };
              });
            } else {
              /* Strategy 4: Fall back to computing mutual likes directly */
              const { data: myLikes } = await client.from('profile_likes').select('profile_id').eq('user_id', user.id);
              const likedIds = (myLikes || []).map((x) => x.profile_id);
              if (likedIds.length) {
                const { data: mutuals } = await client.from('profile_likes').select('user_id').eq('profile_id', user.id).in('user_id', likedIds);
                const mutualIds = (mutuals || []).map((m) => m.user_id);
                if (mutualIds.length) {
                  const { data: matchedProfiles } = await client.from('profiles').select('*').in('id', mutualIds);
                  data = (matchedProfiles || []).map((prof) => ({
                    id: prof.id, user_one_id: user.id, user_two_id: prof.id,
                    status: 'matched', created_at: new Date().toISOString(),
                    user_one: null, user_two: prof, _other: prof
                  }));
                } else { data = []; }
              } else { data = []; }
            }
          } catch (e3) {
            console.warn('[Matches query strategy 3]:', e3.message);
            data = [];
          }
        }
      }
      return data || [];
    },
    async pendingLikes() {
      /* People who liked me but I haven't liked back */
      const user = await requireUser();
      try {
        const { data: likedMe } = await client.from('profile_likes').select('user_id, created_at').eq('profile_id', user.id);
        const { data: iLiked } = await client.from('profile_likes').select('profile_id').eq('user_id', user.id);
        const iLikedSet = new Set((iLiked || []).map((x) => x.profile_id));
        const pendingIds = (likedMe || []).filter((x) => !iLikedSet.has(x.user_id)).map((x) => x.user_id);
        if (!pendingIds.length) return [];
        const { data: profiles } = await client.from('profiles').select('*').in('id', pendingIds);
        return (profiles || []).map((prof) => ({
          id: prof.id, user_id: prof.id, matched_user_id: null,
          user_one_id: prof.id, user_two_id: null,
          status: 'pending', created_at: new Date().toISOString(),
          user_one: prof, user_two: null, matched_user: null
        }));
      } catch (e) { console.warn('[Pending likes]:', e.message); return []; }
    }
  };
  const chat = {
    async conversations() { const user = await requireUser(); return run(client.from('conversation_members').select('conversation_id, is_favorite, last_read_at, conversations(id, updated_at, conversation_members(user_id, profiles!user_id(full_name, username, avatar_url, is_online)))').eq('user_id', user.id).order('joined_at', { ascending: false }), 'load conversations'); },
    async messages(conversationId) { await requireUser(); return run(client.from('messages').select('*, sender:profiles!sender_id(full_name, avatar_url)').eq('conversation_id', conversationId).is('deleted_at', null).order('created_at'), 'load messages'); },
    async send({ conversationId, body, imagePath, replyToId }) { const user = await requireUser(); return run(client.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body: body || null, image_path: imagePath || null, reply_to_id: replyToId || null }).select().single(), 'send message'); },
    async start(otherUserId) { await requireUser(); return run(client.rpc('get_or_create_conversation', { other_user_id: otherUserId }), 'start conversation'); },
    subscribe(conversationId, onMessage) { if (!client) return null; return client.channel(`messages:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, onMessage).subscribe(); }
  };
  const notifications = {
    async list() { const user = await requireUser(); return run(client.from('notifications').select('*, actor:profiles!actor_id(full_name, avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false }), 'load notifications'); },
    async read(id, value = true) { await requireUser(); return run(client.from('notifications').update({ is_read: value }).eq('id', id), 'update notification'); },
    async markAllRead() { const user = await requireUser(); return run(client.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false), 'mark all notifications read'); },
    async clearRead() { const user = await requireUser(); return run(client.from('notifications').delete().eq('user_id', user.id).eq('is_read', true), 'clear notifications'); },
    subscribe(userId, callback) { return client?.channel(`notifications:${userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, callback).subscribe(); }
  };
  const settings = {
    async load() { const user = await requireUser(); return run(client.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(), 'load settings'); },
    async save(values) { const user = await requireUser(); return run(client.from('user_settings').upsert({ user_id: user.id, ...values }).select().single(), 'save settings'); },
    async updateEmail(email) { return run(client.auth.updateUser({ email }), 'update email'); },
    async updatePassword(password) { return run(client.auth.updateUser({ password }), 'update password'); },
    async signOut(scope = 'global') { return run(client.auth.signOut({ scope }), 'sign out'); }
  };
  const authApi = {
    async emailSignIn(email, password) { return run(client.auth.signInWithPassword({ email, password }), 'sign in'); },
    async emailSignUp({ email, password, fullName, username }) { return run(client.auth.signUp({ email, password, options: { data: { full_name: fullName, username }, emailRedirectTo: `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}` } }), 'create account'); },
    async phoneOtp(phone) { return run(client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } }), 'send phone OTP'); },
    async verifyPhoneOtp(phone, token) { return run(client.auth.verifyOtp({ phone, token, type: 'sms' }), 'verify phone OTP'); },
    async updatePhone(phone) { return run(client.auth.updateUser({ phone }), 'send phone verification'); },
    async verifyPhoneChange(phone, token) { return run(client.auth.verifyOtp({ phone, token, type: 'phone_change' }), 'verify phone change'); },
    async googleSignIn() { return run(client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}dashboard.html` } }), 'start Google login'); },
    async resetPassword(email) { return run(client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}` }), 'send password reset'); },
    async updatePassword(password) { return run(client.auth.updateUser({ password }), 'update password'); },
    async resendEmailVerification(email) { return run(client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}` } }), 'resend verification'); },
    async signOut(scope = 'global') { return run(client.auth.signOut({ scope }), 'sign out'); },
    async deleteAccount() { const user = await requireUser(); return run(client.from('profiles').delete().eq('id', user.id), 'delete profile'); }
  };
  const storage = {
    bucketFor(type) { return 'profile-images'; },
    publicUrl(bucketId, path) {
      if (!path) return '';
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
      const targetBucket = bucketId || 'profile-images';
      const { data } = client.storage.from(targetBucket).getPublicUrl(path);
      return data?.publicUrl || '';
    },
    async upload(file, type) { const user = await requireUser(); const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']; if (!file || !allowedTypes.includes(file.type)) throw new Error('Choose a valid JPG, PNG, or WebP image.'); if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB.'); const bucketId = 'profile-images'; const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'; const path = `${user.id}/${type || 'gallery'}/${crypto.randomUUID()}.${ext}`; await run(client.storage.from(bucketId).upload(path, file, { contentType: file.type, upsert: true }), 'upload file'); return { bucketId, path, fileName: file.name, mimeType: file.type, sizeBytes: file.size }; },
    async signedUrl(bucketId, path, expiresIn = 3600) { if (!path) return ''; if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path; const targetBucket = bucketId || 'profile-images'; const { data, error } = await client.storage.from(targetBucket).createSignedUrl(path, expiresIn); if (error) { return storage.publicUrl(targetBucket, path); } return data?.signedUrl || storage.publicUrl(targetBucket, path); },
    async remove(bucketId, path) { return run(client.storage.from(bucketId || 'profile-images').remove([path]), 'delete file'); }
  };
  const realtime = {
    typing(conversationId, onPresence) { const channel = client.channel(`typing:${conversationId}`, { config: { presence: { key: crypto.randomUUID() } } }); channel.on('presence', { event: 'sync' }, () => onPresence(channel.presenceState())).subscribe(); return { channel, setTyping: (isTyping) => channel.track({ isTyping, at: Date.now() }), close: () => client.removeChannel(channel) }; },
    async markRead(conversationId) { const user = await requireUser(); return run(client.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', user.id), 'mark conversation read'); }
  };
  const admin = {
    async role() { const user = await requireUser(); const { data, error } = await client.from('user_roles').select('roles(name)').eq('user_id', user.id); if (error) throw fail(error, 'load role'); return data.map((entry) => entry.roles?.name).filter(Boolean); },
    async reports({ status = 'open', from = 0, to = 29 } = {}) { return run(client.from('reports').select('*').eq('status', status).order('created_at', { ascending: false }).range(from, to), 'load reports'); }
  };
  const feed = {
    async list({ limit = 20 } = {}) { await requireUser(); return run(client.from('community_posts').select('*, profiles!author_id(full_name, username, avatar_url), post_reactions(user_id)').eq('is_published', true).order('created_at', { ascending: false }).limit(limit), 'load posts'); },
    async create({ body, postType = 'discussion' }) { const user = await requireUser(); return run(client.from('community_posts').insert({ author_id: user.id, body, post_type: postType }).select().single(), 'create post'); },
    async toggleReaction(postId) { const user = await requireUser(); const previous = await run(client.from('post_reactions').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle(), 'check reaction'); if (previous) { await run(client.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id), 'remove reaction'); return false; } await run(client.from('post_reactions').insert({ post_id: postId, user_id: user.id }), 'add reaction'); return true; }
  };
  window.ManglikSupabase = { client, requireUser, profile, social, chat, notifications, settings, feed, auth: authApi, storage, realtime, admin, array, fromDbProfile, toDbProfile };
}());
