/*
 * Discover data is intentionally local for the static prototype.
 * `window.discoverQueryAdapter` exposes the same search state as a Supabase-ready
 * query specification, so the UI can be connected without changing its markup.
 */

(function () {
    "use strict";
    if (window.ManglikSupabase?.client) return;

    const members = [
        {
            id: "arjun-malhotra", name: "Arjun Malhotra", username: "arjun.malhotra", age: 29,
            city: "Gurugram", state: "Haryana", profession: "Product Manager", education: "MBA, IIM Lucknow",
            religion: "Hindu", interests: ["Travel", "Cricket", "Books"], languages: ["Hindi", "English"],
            bio: "Building thoughtful products, collecting good stories, and looking for a warm, values-led connection.",
            compatibility: 96, verified: true, online: true, recentlyActive: true, income: "25L+", height: "5'11\"", manglikStatus: "Manglik", tone: "tone-saffron", joined: 7, followers: 823
        },
        {
            id: "vihaan-kapoor", name: "Vihaan Kapoor", username: "vihaan.k", age: 31,
            city: "New Delhi", state: "Delhi", profession: "Architect", education: "B.Arch, SPA Delhi",
            religion: "Hindu", interests: ["Design", "Photography", "Music"], languages: ["Hindi", "English", "Punjabi"],
            bio: "An architect who finds joy in old neighbourhoods, honest conversations and Sunday breakfast plans.",
            compatibility: 93, verified: true, online: false, recentlyActive: true, income: "18L+", height: "6'0\"", manglikStatus: "Anshik Manglik", tone: "tone-plum", joined: 14, followers: 652
        },
        {
            id: "rohan-mehta", name: "Rohan Mehta", username: "rohan.mehta", age: 30,
            city: "Mumbai", state: "Maharashtra", profession: "Strategy Consultant", education: "B.Com, NMIMS",
            religion: "Hindu", interests: ["Fitness", "Cinema", "Food"], languages: ["Hindi", "English", "Marathi"],
            bio: "Grounded, family-oriented, and always ready to plan the next small adventure together.",
            compatibility: 91, verified: true, online: true, recentlyActive: true, income: "30L+", height: "5'10\"", manglikStatus: "Manglik", tone: "tone-blue", joined: 22, followers: 540
        },
        {
            id: "kabir-singh", name: "Kabir Singh", username: "kabir.s", age: 28,
            city: "Chandigarh", state: "Punjab", profession: "Civil Engineer", education: "B.Tech, PEC",
            religion: "Hindu", interests: ["Cycling", "Cooking", "Travel"], languages: ["Hindi", "English", "Punjabi"],
            bio: "Calm by nature, close to family, and happiest around a home-cooked meal and great company.",
            compatibility: 89, verified: false, online: false, recentlyActive: false, income: "15L+", height: "5'9\"", manglikStatus: "Manglik", tone: "tone-sage", joined: 4, followers: 264
        },
        {
            id: "ishaan-verma", name: "Ishaan Verma", username: "ishaanv", age: 27,
            city: "Pune", state: "Maharashtra", profession: "Software Engineer", education: "B.Tech, VIT",
            religion: "Hindu", interests: ["Tennis", "Podcasts", "Pets"], languages: ["Hindi", "English"],
            bio: "A curious engineer who values kindness, dependable people, and a life balanced with laughter.",
            compatibility: 87, verified: true, online: true, recentlyActive: true, income: "20L+", height: "5'8\"", manglikStatus: "Anshik Manglik", tone: "tone-rose", joined: 2, followers: 910
        },
        {
            id: "dev-shah", name: "Dev Shah", username: "dev.shah", age: 32,
            city: "Ahmedabad", state: "Gujarat", profession: "Entrepreneur", education: "BBA, Gujarat University",
            religion: "Hindu", interests: ["Business", "Reading", "Food"], languages: ["Gujarati", "Hindi", "English"],
            bio: "A practical romantic with deep roots, a growth mindset, and space for the right partnership.",
            compatibility: 85, verified: true, online: false, recentlyActive: true, income: "35L+", height: "5'11\"", manglikStatus: "Manglik", tone: "tone-saffron", joined: 30, followers: 728
        },
        {
            id: "aditya-nair", name: "Aditya Nair", username: "aditya.nair", age: 29,
            city: "Bengaluru", state: "Karnataka", profession: "UX Researcher", education: "M.Des, NID",
            religion: "Hindu", interests: ["Art", "Yoga", "Travel"], languages: ["Malayalam", "Hindi", "English"],
            bio: "Thoughtful and quietly optimistic. I appreciate depth, gentle humour and shared everyday rituals.",
            compatibility: 83, verified: false, online: true, recentlyActive: false, income: "18L+", height: "5'9\"", manglikStatus: "Non-Manglik", tone: "tone-plum", joined: 11, followers: 408
        },
        {
            id: "samar-joshi", name: "Samar Joshi", username: "samar.joshi", age: 26,
            city: "Jaipur", state: "Rajasthan", profession: "Doctor", education: "MBBS, SMS Medical College",
            religion: "Hindu", interests: ["Music", "Volunteering", "Fitness"], languages: ["Hindi", "English"],
            bio: "A doctor with a soft spot for meaningful conversations, family dinners and keeping things real.",
            compatibility: 82, verified: true, online: false, recentlyActive: true, income: "16L+", height: "5'10\"", manglikStatus: "Manglik", tone: "tone-blue", joined: 1, followers: 1170
        }
    ];

    const state = {
        query: "",
        filters: {},
        recentSearches: JSON.parse(localStorage.getItem("manglik-meets-recent-searches") || "[]"),
        liked: new Set(),
        saved: new Set(),
        currentMember: null
    };

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

    const searchInput = $("#member-search-input");
    const suggestionBox = $("#search-suggestions");
    const suggestionList = $("#suggestion-list");
    const suggestionLabel = $("#suggestion-label");
    const filterForm = $("#advanced-filters");
    const filterCount = $("#filter-count");
    const toast = $("#discover-toast");
    let toastTimeout;

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", "\"": "&quot;"
        })[character]);
    }

    function initials(name) {
        return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("is-visible");
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 3200);
    }

    function memberVisual(member, drawer = false) {
        return `
            <div class="member-visual ${member.tone}${drawer ? " drawer-profile-visual" : ""}">
                ${member.online ? '<span class="member-status"><i></i> Online now</span>' : '<span class="member-status">Recently active</span>'}
                <span class="compatibility-badge">${member.compatibility}% compatible</span>
                <span class="member-initials">${initials(member.name)}</span>
            </div>`;
    }

    function actionButton(action, member, label, extraClass = "") {
        const active = (action === "like" && state.liked.has(member.id)) || (action === "save" && state.saved.has(member.id));
        return `<button class="member-action ${extraClass} ${active ? "is-active" : ""}" type="button" data-member-action="${action}" data-member-id="${member.id}" aria-label="${label} ${member.name}">${label}</button>`;
    }

    function createMemberCard(member) {
        return `
            <article class="member-card" data-member-card="${member.id}">
                ${memberVisual(member)}
                <div class="member-content">
                    <div class="member-name-row">
                        <h3>${escapeHtml(member.name)}, ${member.age}</h3>
                        ${member.verified ? '<span class="verified-mark" title="Verified member">✓</span>' : ""}
                    </div>
                    <p class="member-meta">${escapeHtml(member.city)}, ${escapeHtml(member.state)}</p>
                    <p class="member-profession">${escapeHtml(member.profession)}</p>
                    <p class="member-bio">${escapeHtml(member.bio)}</p>
                </div>
                <div class="member-actions">
                    ${actionButton("view", member, "View", "primary")}
                    ${actionButton("like", member, "♡")}
                    ${actionButton("save", member, "⌑")}
                    ${actionButton("share", member, "↗")}
                    ${actionButton("message", member, "✉")}
                </div>
            </article>`;
    }

    function createListItem(member) {
        return `
            <article class="member-list-item">
                <div class="member-list-avatar ${member.tone}">${initials(member.name)}</div>
                <div>
                    <h3>${escapeHtml(member.name)}, ${member.age}${member.verified ? ' <span class="verified-mark">✓</span>' : ""}</h3>
                    <p>${escapeHtml(member.city)} · ${escapeHtml(member.profession)} · ${member.compatibility}% match</p>
                </div>
                ${actionButton("view", member, "View")}
            </article>`;
    }

    function renderMembers(containerSelector, memberList, compact = false) {
        const container = $(containerSelector);
        if (!container) return;
        container.innerHTML = memberList.length
            ? memberList.map(compact ? createListItem : createMemberCard).join("")
            : '<div class="empty-members">No members match these preferences yet. Try widening a filter or searching another city.</div>';
    }

    function renderDefaultSections() {
        renderMembers('[data-member-grid="recommended"]', [...members].sort((a, b) => b.compatibility - a.compatibility).slice(0, 3));
        renderMembers('[data-member-grid="compatible"]', [...members].sort((a, b) => b.compatibility - a.compatibility).slice(1, 4));
        renderMembers('[data-member-list="nearby"]', members.filter((member) => ["Gurugram", "New Delhi", "Chandigarh"].includes(member.city)).slice(0, 2), true);
        renderMembers('[data-member-list="new"]', [...members].sort((a, b) => a.joined - b.joined).slice(0, 2), true);
    }

    function allSearchableText(member) {
        return [
            member.name, member.username, member.city, member.state, member.profession,
            member.education, member.religion, ...member.interests, ...member.languages
        ].join(" ").toLowerCase();
    }

    function matchesFilters(member, filters) {
        const minAge = Number(filters.ageMin || 0);
        const maxAge = Number(filters.ageMax || 100);
        const memberHeight = Number(member.height.match(/\d+/)?.[0] || 0) * 12 + Number(member.height.match(/'(\d+)/)?.[1] || 0);
        const selectedHeightMin = Number(filters.height || 0) * 12;
        const isNearby = ["Gurugram", "New Delhi", "Chandigarh"].includes(member.city);
        const withinDistance = !filters.distance || filters.distance === "Anywhere in India" ||
            (filters.distance === "Within 25 km" && member.city === "Gurugram") ||
            (filters.distance === "Within 50 km" && isNearby);

        return member.age >= minAge && member.age <= maxAge &&
            memberHeight >= selectedHeightMin &&
            (!filters.manglik || member.manglikStatus === filters.manglik) &&
            (!filters.gender || member.gender === filters.gender) &&
            (!filters.religion || member.religion === filters.religion) &&
            (!filters.education || member.education.toLowerCase().includes(filters.education.toLowerCase())) &&
            (!filters.profession || member.profession.toLowerCase().includes(filters.profession.toLowerCase())) &&
            (!filters.income || member.income === filters.income) &&
            withinDistance &&
            (!filters.verifiedOnly || member.verified) &&
            (!filters.onlineOnly || member.online) &&
            (!filters.recentlyActive || member.recentlyActive);
    }

    function searchMembers(query = state.query, filters = state.filters) {
        const term = query.trim().toLowerCase();
        return members.filter((member) => (!term || allSearchableText(member).includes(term)) && matchesFilters(member, filters));
    }

    function applySearch() {
        const results = searchMembers();
        renderMembers('[data-member-grid="recommended"]', results);
        const heading = $('#recommended-heading');
        const subtitle = $('#recommended-subtitle');
        if (state.query || Object.keys(state.filters).length) {
            heading.textContent = state.query ? `Results for “${state.query}”` : "Your filtered matches";
            subtitle.textContent = `${results.length} member${results.length === 1 ? "" : "s"} found based on your search.`;
        } else {
            heading.textContent = "Recommended matches";
            subtitle.textContent = "Thoughtful introductions based on your shared values and profile details.";
        }
        return results;
    }

    function renderSuggestions(query = "") {
        const term = query.trim().toLowerCase();
        let entries;

        if (term) {
            entries = members
                .filter((member) => allSearchableText(member).includes(term))
                .slice(0, 5)
                .map((member) => ({ label: member.name, detail: `${member.city} · ${member.profession}`, value: member.name }));
            suggestionLabel.textContent = entries.length ? "Member suggestions" : "No direct matches";
        } else if (state.recentSearches.length) {
            entries = state.recentSearches.map((value) => ({ label: value, detail: "Recent search", value }));
            suggestionLabel.textContent = "Recent searches";
        } else {
            entries = ["Verified Manglik members", "New Delhi", "Product Manager", "Hindi speakers"].map((value) => ({ label: value, detail: "Trending search", value }));
            suggestionLabel.textContent = "Trending searches";
        }

        suggestionList.innerHTML = entries.length
            ? entries.map((entry) => `<button class="suggestion-item" type="button" data-search-term="${escapeHtml(entry.value)}"><span class="suggestion-icon">⌕</span><span>${escapeHtml(entry.label)} <small>— ${escapeHtml(entry.detail)}</small></span></button>`).join("")
            : '<div class="suggestion-item"><span>Try a city, profession, interest or name.</span></div>';
    }

    function openSuggestions() {
        renderSuggestions(searchInput.value);
        suggestionBox.classList.add("is-visible");
    }

    function closeSuggestions() {
        setTimeout(() => suggestionBox.classList.remove("is-visible"), 130);
    }

    function saveRecentSearch(value) {
        const clean = value.trim();
        if (!clean) return;
        state.recentSearches = [clean, ...state.recentSearches.filter((term) => term.toLowerCase() !== clean.toLowerCase())].slice(0, 4);
        localStorage.setItem("manglik-meets-recent-searches", JSON.stringify(state.recentSearches));
    }

    function getFiltersFromForm() {
        const raw = {};
        $$('[data-filter]', filterForm).forEach((field) => {
            if (field.type === "checkbox") raw[field.dataset.filter] = field.checked;
            else if (field.value && field.value !== "Any distance") raw[field.dataset.filter] = field.value;
        });

        if (raw.ageMin === "25") delete raw.ageMin;
        if (raw.ageMax === "35") delete raw.ageMax;
        return raw;
    }

    function updateFilterCount() {
        const count = Object.values(state.filters).filter(Boolean).length;
        filterCount.textContent = count;
        filterCount.hidden = count === 0;
    }

    function openDrawer(member) {
        state.currentMember = member;
        const drawerContent = $('#member-drawer-content');
        drawerContent.innerHTML = `
            ${memberVisual(member, true)}
            <h2>${escapeHtml(member.name)}, ${member.age} ${member.verified ? '<span class="verified-mark">✓</span>' : ""}</h2>
            <p class="drawer-subtitle">@${escapeHtml(member.username)} · ${escapeHtml(member.city)}, ${escapeHtml(member.state)}</p>
            <div class="drawer-data">
                <div><small>Profession</small><strong>${escapeHtml(member.profession)}</strong></div>
                <div><small>Education</small><strong>${escapeHtml(member.education)}</strong></div>
                <div><small>Manglik status</small><strong>${escapeHtml(member.manglikStatus)}</strong></div>
                <div><small>Languages</small><strong>${escapeHtml(member.languages.join(", "))}</strong></div>
            </div>
            <p class="drawer-bio">${escapeHtml(member.bio)}</p>
            <div class="drawer-actions">
                ${actionButton("like", member, state.liked.has(member.id) ? "Liked" : "Like")}
                ${actionButton("save", member, state.saved.has(member.id) ? "Saved" : "Save")}
                ${actionButton("share", member, "Share profile")}
                ${actionButton("message", member, "Message", "primary")}
            </div>`;
        $('#member-drawer').classList.add("is-open");
        $('#member-drawer-backdrop').classList.add("is-open");
        $('#member-drawer').setAttribute("aria-hidden", "false");
    }

    function closeDrawer() {
        $('#member-drawer').classList.remove("is-open");
        $('#member-drawer-backdrop').classList.remove("is-open");
        $('#member-drawer').setAttribute("aria-hidden", "true");
    }

    async function shareMember(member) {
        const shareData = {
            title: `${member.name} on Manglik Meets`,
            text: `Take a look at ${member.name}'s profile on Manglik Meets.`
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                showToast("Profile share sheet opened.");
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(`${shareData.text} @${member.username}`);
                showToast("Profile details copied to your clipboard.");
            } else {
                showToast("Sharing is ready to connect to your live profile links.");
            }
        } catch (error) {
            if (error.name !== "AbortError") showToast("Could not share this profile right now.");
        }
    }

    function handleMemberAction(button) {
        const member = members.find((entry) => entry.id === button.dataset.memberId);
        if (!member) return;

        switch (button.dataset.memberAction) {
            case "view":
                openDrawer(member);
                break;
            case "like":
                state.liked.has(member.id) ? state.liked.delete(member.id) : state.liked.add(member.id);
                showToast(state.liked.has(member.id) ? `${member.name} added to your likes.` : `${member.name} removed from your likes.`);
                refreshActionButtons(member.id);
                break;
            case "save":
                state.saved.has(member.id) ? state.saved.delete(member.id) : state.saved.add(member.id);
                showToast(state.saved.has(member.id) ? `${member.name}'s profile is saved.` : `${member.name} removed from saved profiles.`);
                refreshActionButtons(member.id);
                break;
            case "share":
                shareMember(member);
                break;
            case "message":
                window.location.href = 'messages.html';
                break;
            default:
                break;
        }
    }

    function refreshActionButtons(memberId) {
        const member = members.find((entry) => entry.id === memberId);
        $$(`[data-member-id="${memberId}"]`).forEach((button) => {
            const action = button.dataset.memberAction;
            if (action === "like" || action === "save") {
                const active = action === "like" ? state.liked.has(memberId) : state.saved.has(memberId);
                button.classList.toggle("is-active", active);
                if (button.closest(".drawer-actions")) button.textContent = active ? (action === "like" ? "Liked" : "Saved") : (action === "like" ? "Like" : "Save");
            }
        });
        if (state.currentMember && state.currentMember.id === member.id) openDrawer(member);
    }

    function setCategory(category) {
        let results = members;
        let title = "Discover members";
        switch (category) {
            case "verified": results = members.filter((member) => member.verified); title = "Verified members"; break;
            case "trending": results = [...members].sort((a, b) => b.followers - a.followers); title = "Trending profiles"; break;
            case "active": results = members.filter((member) => member.online || member.recentlyActive); title = "Most active members"; break;
            case "recent": results = [...members].sort((a, b) => a.joined - b.joined); title = "Recently joined"; break;
            default: break;
        }
        state.query = "";
        searchInput.value = "";
        renderMembers('[data-member-grid="recommended"]', results);
        $('#recommended-heading').textContent = title;
        $('#recommended-subtitle').textContent = "Explore members selected from the Manglik Meets community.";
        window.scrollTo({ top: $('#recommended-heading').getBoundingClientRect().top + window.scrollY - 104, behavior: "smooth" });
    }

    function initialiseEvents() {
        $("#filter-toggle").addEventListener("click", () => {
            const isOpen = filterForm.classList.toggle("is-open");
            $("#filter-toggle").setAttribute("aria-expanded", String(isOpen));
        });

        $("#discover-search-form").addEventListener("submit", (event) => {
            event.preventDefault();
            state.query = searchInput.value.trim();
            saveRecentSearch(state.query);
            applySearch();
            suggestionBox.classList.remove("is-visible");
            showToast(state.query ? `Showing members matching “${state.query}”.` : "Showing recommended matches.");
        });

        searchInput.addEventListener("focus", openSuggestions);
        searchInput.addEventListener("input", () => {
            renderSuggestions(searchInput.value);
            suggestionBox.classList.add("is-visible");
        });
        searchInput.addEventListener("blur", closeSuggestions);

        suggestionList.addEventListener("mousedown", (event) => {
            const item = event.target.closest("[data-search-term]");
            if (!item) return;
            event.preventDefault();
            searchInput.value = item.dataset.searchTerm;
            state.query = searchInput.value;
            saveRecentSearch(state.query);
            applySearch();
            suggestionBox.classList.remove("is-visible");
        });

        filterForm.addEventListener("submit", (event) => {
            event.preventDefault();
            state.filters = getFiltersFromForm();
            updateFilterCount();
            applySearch();
            showToast("Filters applied to your discovery results.");
        });

        $("#clear-filters").addEventListener("click", () => {
            filterForm.reset();
            state.filters = {};
            updateFilterCount();
            applySearch();
            showToast("Filters cleared.");
        });

        document.addEventListener("click", (event) => {
            const memberAction = event.target.closest("[data-member-action]");
            if (memberAction) handleMemberAction(memberAction);

            const searchChip = event.target.closest("[data-search-chip]");
            if (searchChip) {
                searchInput.value = searchChip.dataset.searchChip;
                state.query = searchInput.value;
                saveRecentSearch(state.query);
                applySearch();
            }

            const category = event.target.closest("[data-discover-category]");
            if (category) setCategory(category.dataset.discoverCategory);
        });

        $("#member-drawer-close").addEventListener("click", closeDrawer);
        $("#member-drawer-backdrop").addEventListener("click", closeDrawer);
        $("#discover-mobile-menu").addEventListener("click", () => {
            const sidebar = $("#discover-sidebar");
            const isOpen = sidebar.classList.toggle("is-open");
            $("#discover-mobile-menu").setAttribute("aria-expanded", String(isOpen));
        });
        document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                searchInput.focus();
            }
            if (event.key === "Escape") closeDrawer();
        });
    }

    /* Adapter contract for future Supabase integration. This performs no network call. */
    window.discoverQueryAdapter = {
        getSearchPayload() {
            return { query: state.query, filters: { ...state.filters } };
        },
        buildQuerySpec() {
            return {
                table: "profiles",
                select: "id, full_name, username, date_of_birth, city, state, profession, education, religion, interests, languages, bio, manglik_status, is_verified, last_active_at, profile_media(*)",
                searchColumns: ["full_name", "username", "city", "state", "profession", "education", "religion", "interests", "languages"],
                filters: { ...state.filters },
                searchTerm: state.query,
                order: [{ column: "compatibility_score", ascending: false }, { column: "last_active_at", ascending: false }]
            };
        },
        mapProfileToCard(profile) {
            return {
                id: profile.id,
                name: profile.full_name,
                username: profile.username,
                city: profile.city,
                state: profile.state,
                profession: profile.profession,
                education: profile.education,
                religion: profile.religion,
                interests: profile.interests || [],
                languages: profile.languages || [],
                bio: profile.bio,
                verified: profile.is_verified,
                recentlyActive: Boolean(profile.last_active_at)
            };
        }
    };

    renderDefaultSections();
    updateFilterCount();
    initialiseEvents();
}());
