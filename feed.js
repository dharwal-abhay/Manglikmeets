/*
 * Static community-feed prototype.
 * window.feedDataAdapter exposes a Supabase-ready contract without performing
 * database requests, leaving authentication and backend wiring unchanged.
 */

(function () {
    "use strict";
    if (window.ManglikSupabase?.client) return;

    const posts = [
        {
            id: "story-anaya-siddharth", type: "story", filter: "stories", author: "Anaya & Siddharth", initials: "A&S", avatar: "avatar-saffron",
            meta: "Success story · 2 hours ago", tag: "Success story", likes: 248, comments: 36, shares: 19, saved: false,
            body: "We began with a calm conversation about family, food and what home means. Six months later, we are grateful for the patient, genuine connection we found here.",
            visual: { kind: "image", tone: "image-gold", label: "A shared beginning", title: "A match that became a partnership." }, topics: ["SuccessStories", "MeaningfulMatches"]
        },
        {
            id: "tip-first-conversations", type: "tip", filter: "tips", author: "Manglik Meets Guide", initials: "MM", avatar: "avatar-plum",
            meta: "Relationship tip · 5 hours ago", tag: "Relationship tip", likes: 184, comments: 22, shares: 47, saved: false,
            body: "The best first conversations are not interviews. Try one easy question, one real answer, and leave room for curiosity to do its work.",
            topics: ["ConnectionTips", "FirstConversation"]
        },
        {
            id: "astro-season", type: "astrology", filter: "tips", author: "Aarav Joshi", initials: "AJ", avatar: "avatar-blue",
            meta: "Astrology article · Yesterday", tag: "Astrology", likes: 96, comments: 18, shares: 13, saved: false,
            body: "A gentle reminder for the season: astrology can be a beautiful language for reflection, but a kind and clear conversation is still the most powerful signal of compatibility.",
            visual: { kind: "carousel", label: "A light astrological hint", title: "Compatibility starts with listening." }, topics: ["Astrology", "SharedValues"]
        },
        {
            id: "poll-family-intro", type: "poll", filter: "discussions", author: "Community Circle", initials: "CC", avatar: "avatar-sage",
            meta: "Community poll · Yesterday", tag: "Poll", likes: 72, comments: 41, shares: 6, saved: false,
            body: "When did you feel ready to introduce a promising connection to your family?", poll: { total: 318, options: [{ label: "After a few meaningful conversations", value: 58 }, { label: "Once our intentions were clear", value: 32 }, { label: "It depends on the connection", value: 10 }] }, topics: ["Family", "CommunityPoll"]
        },
        {
            id: "new-profile-meera", type: "profile", filter: "all", author: "Meera Iyer", initials: "MI", avatar: "avatar-plum",
            meta: "New profile · 2 days ago", tag: "New member", likes: 64, comments: 12, shares: 4, saved: false,
            body: "Hello everyone. I am a Bengaluru-based educator who loves a good book, morning walks and hosting people at home. Happy to be part of a thoughtful community.",
            visual: { kind: "image", tone: "image-sage", label: "New to the community", title: "Say hello to Meera." }, topics: ["NewProfile", "Bengaluru"]
        },
        {
            id: "discussion-boundaries", type: "discussion", filter: "discussions", author: "Saanvi Sharma", initials: "SS", avatar: "avatar-saffron",
            meta: "Community discussion · 3 days ago", tag: "Discussion", likes: 118, comments: 57, shares: 21, saved: false,
            body: "What is one respectful boundary that made your conversations feel safer and more honest? Sharing ideas might help someone else begin with more confidence.",
            topics: ["HealthyBoundaries", "CommunityCare"]
        }
    ];

    const topics = [
        { title: "#MeaningfulMatches", activity: "1.2k conversations" },
        { title: "#FirstConversation", activity: "684 conversations" },
        { title: "#FamilyAndValues", activity: "519 conversations" },
        { title: "#AstrologyWithIntention", activity: "301 conversations" }
    ];

    const state = { filter: "all", sort: "latest", visible: 4, liked: new Set(), saved: new Set(), pollChoice: new Map(), userPosts: [] };
    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
    let toastTimer;

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", "\"": "&quot;" })[char]);
    }

    function showToast(message) {
        const toast = $("#feed-toast");
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
    }

    function postVisual(post) {
        if (!post.visual) return "";
        if (post.visual.kind === "carousel") {
            return `<div class="post-carousel" data-carousel-post="${post.id}"><div class="carousel-slide"><span>${escapeHtml(post.visual.label)}</span><strong>${escapeHtml(post.visual.title)}</strong></div><div class="carousel-preview"><div></div><div></div></div><span class="carousel-pagination">1 / 3</span></div>`;
        }
        return `<div class="post-image ${post.visual.tone || ""}"><div class="post-image-inner"><small>${escapeHtml(post.visual.label)}</small><strong>${escapeHtml(post.visual.title)}</strong></div></div>`;
    }

    function pollMarkup(post) {
        if (!post.poll) return "";
        const selected = state.pollChoice.get(post.id);
        return `<div class="post-poll" data-poll-id="${post.id}"><p class="poll-question">${escapeHtml(post.body)}</p>${post.poll.options.map((option, index) => `<button class="poll-option ${selected === index ? "selected" : ""}" type="button" data-poll-option="${index}" data-post-id="${post.id}"><span>${escapeHtml(option.label)}</span><span class="poll-progress"><i style="width:${option.value}%"></i></span><b>${option.value}%</b></button>`).join("")}<p class="poll-total">${post.poll.total + (selected === undefined ? 0 : 1)} votes · Poll ends in 3 days</p></div>`;
    }

    function actionButton(post, action, icon, count) {
        const active = (action === "like" && state.liked.has(post.id)) || (action === "save" && state.saved.has(post.id));
        return `<button class="post-action ${action === "save" ? "save-action" : ""} ${active ? "active" : ""}" type="button" data-post-action="${action}" data-post-id="${post.id}" aria-label="${action} this post"><span>${icon}</span>${count !== undefined ? `<em>${count}</em>` : ""}</button>`;
    }

    function postCard(post) {
        const displayedLikes = post.likes + (state.liked.has(post.id) ? 1 : 0);
        const description = post.poll ? "" : `<div class="post-body"><p>${escapeHtml(post.body)}</p>${post.topics?.length ? `<p class="post-topic">${post.topics.map((topic) => `#${escapeHtml(topic)}`).join(" ")}</p>` : ""}</div>`;
        return `<article class="feed-post" data-post-card="${post.id}" data-post-type="${post.type}"><header class="post-head"><div class="post-avatar ${post.avatar}">${escapeHtml(post.initials)}</div><div class="post-author"><strong>${escapeHtml(post.author)}</strong><span>${escapeHtml(post.meta)}</span></div><span class="post-type">${escapeHtml(post.tag)}</span><button class="post-menu" type="button" data-post-action="menu" data-post-id="${post.id}" aria-label="More options">⋯</button></header>${description}${postVisual(post)}${pollMarkup(post)}<footer class="post-actions">${actionButton(post, "like", "♡", displayedLikes)}${actionButton(post, "comment", "◌", post.comments)}${actionButton(post, "share", "↗", post.shares)}${actionButton(post, "save", "⌑")}</footer></article>`;
    }

    function filteredPosts() {
        const combined = [...state.userPosts, ...posts];
        const matches = state.filter === "all" ? combined : combined.filter((post) => post.filter === state.filter);
        return state.sort === "popular" ? [...matches].sort((a, b) => b.likes - a.likes) : matches;
    }

    function renderFeed() {
        const visiblePosts = filteredPosts().slice(0, state.visible);
        $("#feed-list").innerHTML = visiblePosts.map(postCard).join("");
        $("#feed-empty").hidden = visiblePosts.length !== 0;
        const loadState = $("#feed-load-state");
        loadState.hidden = visiblePosts.length === 0 || visiblePosts.length >= filteredPosts().length;
        if (!loadState.hidden) $("#load-more-posts").textContent = "Load more";
    }

    function renderTrending() {
        $("#trending-topics").innerHTML = topics.map((topic, index) => `<div class="trend-row"><span class="trend-number">0${index + 1}</span><div class="trend-copy"><strong>${escapeHtml(topic.title)}</strong><span>${escapeHtml(topic.activity)}</span></div><button type="button" data-trend-topic="${escapeHtml(topic.title.slice(1))}">View</button></div>`).join("");
    }

    function updatePostActions(postId) {
        const post = [...state.userPosts, ...posts].find((item) => item.id === postId);
        if (!post) return;
        const likeCount = post.likes + (state.liked.has(postId) ? 1 : 0);
        $$(`[data-post-id="${postId}"]`).forEach((button) => {
            const action = button.dataset.postAction;
            if (action === "like" || action === "save") button.classList.toggle("active", action === "like" ? state.liked.has(postId) : state.saved.has(postId));
            if (action === "like") button.querySelector("em").textContent = likeCount;
        });
    }

    async function sharePost(post) {
        const data = { title: "Manglik Meets Community", text: `${post.author}: ${post.body}` };
        try {
            if (navigator.share) {
                await navigator.share(data);
                showToast("Share options opened.");
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(data.text);
                showToast("Post copied to your clipboard.");
            } else {
                showToast("Sharing is ready to connect to a live post link.");
            }
        } catch (error) {
            if (error.name !== "AbortError") showToast("This post could not be shared right now.");
        }
    }

    function handlePostAction(button) {
        const post = [...state.userPosts, ...posts].find((item) => item.id === button.dataset.postId);
        if (!post) return;
        switch (button.dataset.postAction) {
            case "like":
                state.liked.has(post.id) ? state.liked.delete(post.id) : state.liked.add(post.id);
                updatePostActions(post.id);
                showToast(state.liked.has(post.id) ? "Post added to your likes." : "Post removed from your likes.");
                break;
            case "save":
                state.saved.has(post.id) ? state.saved.delete(post.id) : state.saved.add(post.id);
                updatePostActions(post.id);
                showToast(state.saved.has(post.id) ? "Post saved for later." : "Post removed from saved items.");
                break;
            case "comment":
                showToast("Comments are ready to connect to the future community_comments table.");
                break;
            case "share":
                sharePost(post);
                break;
            case "menu":
                showToast("Post options will include report and visibility controls in the connected feed.");
                break;
            default:
                break;
        }
    }

    function openComposer(type = "update") {
        $("#composer-modal").classList.add("open");
        $("#composer-modal-backdrop").classList.add("open");
        $("#composer-modal").setAttribute("aria-hidden", "false");
        $("#post-body").dataset.postType = type;
        $("#post-body").focus();
    }

    function closeComposer() {
        $("#composer-modal").classList.remove("open");
        $("#composer-modal-backdrop").classList.remove("open");
        $("#composer-modal").setAttribute("aria-hidden", "true");
    }

    function publishPost(body, type) {
        state.userPosts.unshift({
            id: `local-${Date.now()}`, type, filter: type === "discussion" || type === "poll" ? "discussions" : "all", author: "Aanya Sharma", initials: "AS", avatar: "avatar-saffron",
            meta: "Profile update · Just now", tag: type === "discussion" ? "Discussion" : "Profile update", likes: 0, comments: 0, shares: 0, saved: false, body, topics: ["CommunityUpdate"]
        });
        state.filter = "all";
        state.visible = Math.max(4, state.visible);
        $$(".feed-tab").forEach((tab) => { tab.classList.toggle("active", tab.dataset.feedFilter === "all"); tab.setAttribute("aria-selected", String(tab.dataset.feedFilter === "all")); });
        renderFeed();
        closeComposer();
        $("#composer-form").reset();
        $("#composer-count").textContent = "0 / 500";
        showToast("Your community update is ready to publish when the backend is connected.");
    }

    function initialiseEvents() {
        $("#open-composer").addEventListener("click", () => openComposer());
        $$("[data-composer-type]").forEach((button) => button.addEventListener("click", () => openComposer(button.dataset.composerType)));
        $("#composer-close").addEventListener("click", closeComposer);
        $("#composer-modal-backdrop").addEventListener("click", closeComposer);
        $("#post-body").addEventListener("input", (event) => { $("#composer-count").textContent = `${event.target.value.length} / 500`; });
        $("#composer-form").addEventListener("submit", (event) => {
            event.preventDefault();
            const body = $("#post-body").value.trim();
            if (!body) { showToast("Write a short update before publishing."); return; }
            publishPost(body, $("#post-body").dataset.postType || "update");
        });

        $$(".feed-tab").forEach((tab) => tab.addEventListener("click", () => {
            state.filter = tab.dataset.feedFilter;
            state.visible = 4;
            $$(".feed-tab").forEach((item) => { item.classList.toggle("active", item === tab); item.setAttribute("aria-selected", String(item === tab)); });
            renderFeed();
        }));
        $("#feed-sort").addEventListener("click", () => {
            state.sort = state.sort === "latest" ? "popular" : "latest";
            $("#feed-sort").textContent = state.sort === "latest" ? "Latest ▾" : "Most liked ▾";
            renderFeed();
        });
        $("#load-more-posts").addEventListener("click", () => {
            $("#load-more-posts").textContent = "Loading...";
            setTimeout(() => { state.visible += 3; renderFeed(); }, 350);
        });
        $("#feed-list").addEventListener("click", (event) => {
            const action = event.target.closest("[data-post-action]");
            if (action) handlePostAction(action);
            const option = event.target.closest("[data-poll-option]");
            if (option) { state.pollChoice.set(option.dataset.postId, Number(option.dataset.pollOption)); renderFeed(); showToast("Your poll response was recorded locally."); }
        });
        $("#trending-topics").addEventListener("click", (event) => {
            const topic = event.target.closest("[data-trend-topic]");
            if (topic) showToast(`Topic search for #${topic.dataset.trendTopic} is ready for backend search.`);
        });
        $("#feed-mobile-menu").addEventListener("click", () => {
            const sidebar = $("#feed-sidebar");
            const isOpen = sidebar.classList.toggle("open");
            $("#feed-mobile-menu").setAttribute("aria-expanded", String(isOpen));
        });
        document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeComposer(); });
    }

    /* Supabase-ready contract: connect query results here when tables are introduced. */
    window.feedDataAdapter = {
        getFeedRequest() {
            return { table: "community_posts", select: "id, author_id, type, body, media, topic_tags, created_at, profiles(full_name, username, avatar_url)", filter: state.filter, sort: state.sort, pageSize: state.visible };
        },
        getActionRequest(postId, action) {
            return { table: action === "comment" ? "community_comments" : "post_reactions", postId, action, actorIdField: "user_id" };
        },
        mapRemotePost(post) {
            return { id: post.id, type: post.type, author: post.profiles?.full_name || "Community member", body: post.body, topics: post.topic_tags || [], meta: post.created_at, visual: post.media?.[0] || null };
        }
    };

    renderTrending();
    initialiseEvents();
    setTimeout(() => { $("#feed-skeletons").hidden = true; renderFeed(); }, 420);
}());
