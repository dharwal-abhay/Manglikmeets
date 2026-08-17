-- =====================================================================
-- MANGLIK MEETS — CANONICAL PRODUCTION DATABASE SCHEMA (REFINED)
-- Target Database: PostgreSQL 15+ / Supabase
-- Description: Adversarially-hardened, production-ready schema featuring
--              strict domain integrity, RLS column-privacy views, secure
--              conversation controls, Realtime, and Storage policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ---------------------------------------------------------------------

-- Generic timestamp updater trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper to check if authenticated user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Automatic profile & settings initialization on auth user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_name TEXT;
    default_username TEXT;
BEGIN
    default_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
    default_username := LOWER(COALESCE(NEW.raw_user_meta_data->>'username', CONCAT('user_', SUBSTRING(NEW.id::text FROM 1 FOR 8))));

    -- Create profile
    INSERT INTO public.profiles (
        id,
        full_name,
        username,
        is_verified,
        is_online,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        default_name,
        default_username,
        FALSE,
        FALSE,
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create partner preferences record
    INSERT INTO public.partner_preferences (
        user_id,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Create user settings record
    INSERT INTO public.user_settings (
        user_id,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trigger binding for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. TABLES & CONSTRAINTS
-- ---------------------------------------------------------------------

-- 3.1 PROFILES (Core Identity & Demographics)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE CHECK (username ~* '^[a-z0-9_]{3,30}$'),
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('Woman', 'Man', 'Non-binary', 'Prefer not to say')),
    height TEXT,
    weight TEXT,
    religion TEXT,
    caste TEXT,
    manglik_status TEXT CHECK (manglik_status IN ('Manglik', 'Anshik Manglik', 'Non-Manglik', 'Open to discuss', 'Prefer not to say')),
    profession TEXT,
    education TEXT,
    income TEXT,
    languages TEXT[] DEFAULT '{}',
    bio TEXT CHECK (LENGTH(bio) <= 1000),
    interests TEXT[] DEFAULT '{}',
    hobbies TEXT[] DEFAULT '{}',
    personality_traits TEXT[] DEFAULT '{}',
    smoking TEXT CHECK (smoking IN ('Never', 'Occasionally', 'Regularly', 'Prefer not to say')),
    drinking TEXT CHECK (drinking IN ('Never', 'Socially', 'Occasionally', 'Prefer not to say')),
    food_preference TEXT CHECK (food_preference IN ('Vegetarian', 'Non-vegetarian', 'Vegan', 'Jain', 'Eggetarian')),
    fitness TEXT CHECK (fitness IN ('Very active', 'Active', 'Balanced', 'Occasional')),
    pets TEXT CHECK (pets IN ('Love pets', 'Have pets', 'Open to pets', 'Prefer no pets')),
    looking_for TEXT CHECK (looking_for IN ('Marriage', 'Serious relationship leading to marriage', 'Getting to know someone')),
    marriage_timeline TEXT CHECK (marriage_timeline IN ('Within 1 year', '1–2 years', '2–3 years', 'Open to the right timing')),
    family_type TEXT CHECK (family_type IN ('Nuclear', 'Joint', 'Open to both')),
    values_text TEXT,
    expectations TEXT,
    city TEXT,
    state TEXT,
    mobile_number TEXT,
    recovery_email TEXT,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    is_online BOOLEAN DEFAULT FALSE NOT NULL,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    account_status TEXT DEFAULT 'active' NOT NULL CHECK (account_status IN ('active', 'suspended', 'deactivated', 'deleted')),
    avatar_url TEXT,
    cover_url TEXT,
    private_profile BOOLEAN DEFAULT FALSE NOT NULL,
    hide_age BOOLEAN DEFAULT FALSE NOT NULL,
    hide_city BOOLEAN DEFAULT FALSE NOT NULL,
    hide_profession BOOLEAN DEFAULT FALSE NOT NULL,
    hide_last_seen BOOLEAN DEFAULT FALSE NOT NULL,
    hide_online_status BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.2 PARTNER PREFERENCES (Isolated Match Preferences)
CREATE TABLE IF NOT EXISTS public.partner_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    preferred_age TEXT,
    preferred_age_min INT CHECK (preferred_age_min IS NULL OR (preferred_age_min >= 18 AND preferred_age_min <= 100)),
    preferred_age_max INT CHECK (preferred_age_max IS NULL OR (preferred_age_max >= 18 AND preferred_age_max <= 100)),
    preferred_religion TEXT,
    preferred_profession TEXT,
    preferred_education TEXT,
    preferred_height TEXT,
    manglik_preference TEXT CHECK (manglik_preference IN ('Manglik', 'Open to all', 'Open to discuss respectfully', 'Prefer not to say')),
    distance TEXT CHECK (distance IN ('Within my city', 'Within 25 km', 'Within 50 km', 'Within 100 km', 'Anywhere in India', 'Open to relocate')),
    preferred_languages TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT chk_age_range CHECK (preferred_age_min IS NULL OR preferred_age_max IS NULL OR preferred_age_min <= preferred_age_max)
);

-- 3.3 PROFILE MEDIA (Avatar, Cover, Gallery)
CREATE TABLE IF NOT EXISTS public.profile_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bucket_id TEXT DEFAULT 'profile-images' NOT NULL,
    storage_path TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('avatar', 'cover', 'gallery')),
    mime_type TEXT,
    size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes > 0),
    sort_order INT DEFAULT 0 NOT NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.4 PROFILE LIKES (Expressing Interest)
CREATE TABLE IF NOT EXISTS public.profile_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_profile_likes UNIQUE (user_id, profile_id),
    CONSTRAINT chk_no_self_like CHECK (user_id <> profile_id)
);

-- 3.5 SAVED PROFILES (Private Shortlist)
CREATE TABLE IF NOT EXISTS public.saved_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_saved_profiles UNIQUE (user_id, profile_id),
    CONSTRAINT chk_no_self_save CHECK (user_id <> profile_id)
);

-- 3.6 MATCH ACTIONS (Explicit Pass / Swipe Actions)
CREATE TABLE IF NOT EXISTS public.match_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('like', 'save', 'pass')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_match_actions UNIQUE (user_id, profile_id, action),
    CONSTRAINT chk_no_self_action CHECK (user_id <> profile_id)
);

-- 3.7 MATCHES (Canonical Pair Mutual Connection)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_one_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_two_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'matched' NOT NULL CHECK (status IN ('suggested', 'pending', 'matched', 'unmatched')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_matches_pair UNIQUE (user_one_id, user_two_id),
    CONSTRAINT chk_canonical_pair CHECK (user_one_id < user_two_id),
    CONSTRAINT matches_user_one_id_fkey FOREIGN KEY (user_one_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT matches_user_two_id_fkey FOREIGN KEY (user_two_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 3.8 CONVERSATIONS (Messaging Room)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.9 CONVERSATION MEMBERS (Room Participants & Read State)
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_favorite BOOLEAN DEFAULT FALSE NOT NULL,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_conversation_member UNIQUE (conversation_id, user_id),
    CONSTRAINT conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
    CONSTRAINT conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 3.10 MESSAGES (Thread Messages)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT,
    content TEXT, -- Backward compatibility alias
    message_type TEXT DEFAULT 'text' NOT NULL CHECK (message_type IN ('text', 'image', 'system')),
    media_url TEXT,
    image_path TEXT,
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT chk_message_has_content CHECK (body IS NOT NULL OR content IS NOT NULL OR media_url IS NOT NULL OR image_path IS NOT NULL)
);

-- 3.11 NOTIFICATIONS (User Notifications Center)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('message', 'match', 'like', 'view', 'verification', 'community', 'system')),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3.12 USER SETTINGS (Account Preferences)
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light' NOT NULL CHECK (theme IN ('light', 'dark', 'system')),
    font_size INT DEFAULT 100 NOT NULL CHECK (font_size BETWEEN 90 AND 120),
    reduce_motion BOOLEAN DEFAULT FALSE NOT NULL,
    email_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    push_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    sms_notifications BOOLEAN DEFAULT FALSE NOT NULL,
    marketing_notifications BOOLEAN DEFAULT FALSE NOT NULL,
    message_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    match_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.13 COMMUNITY POSTS (Discussion Feed)
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (LENGTH(TRIM(body)) > 0),
    post_type TEXT DEFAULT 'discussion' NOT NULL CHECK (post_type IN ('story', 'tip', 'astrology', 'poll', 'profile', 'discussion')),
    media JSONB DEFAULT '[]'::jsonb NOT NULL,
    topic_tags TEXT[] DEFAULT '{}',
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT community_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 3.14 POST REACTIONS (Likes on Community Posts)
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_post_reaction UNIQUE (post_id, user_id)
);

-- 3.15 ROLES (RBAC Definitions)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL CHECK (name IN ('admin', 'moderator', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Seed default application roles
INSERT INTO public.roles (name) VALUES ('admin'), ('moderator'), ('member')
ON CONFLICT (name) DO NOTHING;

-- 3.16 USER ROLES (User RBAC Mappings)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_user_roles UNIQUE (user_id, role_id)
);

-- 3.17 REPORTS (Moderation Flagging Queue)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_id UUID NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('profile', 'message', 'content')),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'resolved', 'escalated', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.18 CONTACT MESSAGES (Support Submissions)
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    subject TEXT,
    message TEXT NOT NULL CHECK (LENGTH(TRIM(message)) >= 10),
    status TEXT DEFAULT 'new' NOT NULL CHECK (status IN ('new', 'read', 'replied', 'in_progress', 'resolved', 'closed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---------------------------------------------------------------------
-- 4. SECURE PRIVACY VIEW (COLUMN-LEVEL PRIVACY ENFORCEMENT)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.discoverable_profiles AS
SELECT 
    p.id,
    p.full_name,
    p.username,
    CASE WHEN p.hide_age AND p.id <> auth.uid() AND NOT public.is_admin() THEN NULL ELSE p.date_of_birth END AS date_of_birth,
    p.gender,
    p.height,
    p.weight,
    p.religion,
    p.caste,
    p.manglik_status,
    CASE WHEN p.hide_profession AND p.id <> auth.uid() AND NOT public.is_admin() THEN NULL ELSE p.profession END AS profession,
    p.education,
    p.income,
    p.languages,
    p.bio,
    p.interests,
    p.hobbies,
    p.personality_traits,
    p.smoking,
    p.drinking,
    p.food_preference,
    p.fitness,
    p.pets,
    p.looking_for,
    p.marriage_timeline,
    p.family_type,
    p.values_text,
    p.expectations,
    CASE WHEN p.hide_city AND p.id <> auth.uid() AND NOT public.is_admin() THEN NULL ELSE p.city END AS city,
    CASE WHEN p.hide_city AND p.id <> auth.uid() AND NOT public.is_admin() THEN NULL ELSE p.state END AS state,
    p.is_verified,
    CASE WHEN p.hide_online_status AND p.id <> auth.uid() AND NOT public.is_admin() THEN FALSE ELSE p.is_online END AS is_online,
    CASE WHEN p.hide_last_seen AND p.id <> auth.uid() AND NOT public.is_admin() THEN NULL ELSE p.last_active_at END AS last_active_at,
    p.avatar_url,
    p.cover_url,
    p.created_at,
    p.updated_at
FROM public.profiles p
WHERE p.account_status = 'active'
  AND (p.private_profile = FALSE OR p.id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------
-- 5. ATTACH UPDATED_AT TRIGGERS TO TABLES
-- ---------------------------------------------------------------------
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_partner_preferences_updated_at BEFORE UPDATE ON public.partner_preferences FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_community_posts_updated_at BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_contact_messages_updated_at BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 6. INDEXES (QUERY OPTIMIZATION)
-- ---------------------------------------------------------------------
-- Profile discovery & filter indexes
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_religion ON public.profiles(religion);
CREATE INDEX IF NOT EXISTS idx_profiles_manglik_status ON public.profiles(manglik_status);
CREATE INDEX IF NOT EXISTS idx_profiles_city_state ON public.profiles(city, state);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status) WHERE account_status = 'active';

-- Media indexes
CREATE INDEX IF NOT EXISTS idx_profile_media_profile_id ON public.profile_media(profile_id, media_type);

-- Social & Match indexes
CREATE INDEX IF NOT EXISTS idx_profile_likes_user ON public.profile_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_likes_profile ON public.profile_likes(profile_id);
CREATE INDEX IF NOT EXISTS idx_saved_profiles_user ON public.saved_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_match_actions_user_action ON public.match_actions(user_id, action);
CREATE INDEX IF NOT EXISTS idx_matches_user_one ON public.matches(user_one_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_two ON public.matches(user_two_id);

-- Messaging indexes
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);

-- Community indexes
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);

-- Support & Moderation indexes
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- ---------------------------------------------------------------------
-- 7. RPC FUNCTIONS (SECURE & IDEMPOTENT)
-- ---------------------------------------------------------------------

-- Atomic conversation lookup or creation for 1-on-1 chats
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    current_uid UUID;
    existing_conv_id UUID;
    new_conv_id UUID;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF current_uid = other_user_id THEN
        RAISE EXCEPTION 'Cannot start a conversation with yourself';
    END IF;

    -- Verify target user exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_user_id) THEN
        RAISE EXCEPTION 'Target member does not exist';
    END IF;

    -- Look for an existing mutual conversation
    SELECT cm1.conversation_id INTO existing_conv_id
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = current_uid AND cm2.user_id = other_user_id
    LIMIT 1;

    IF existing_conv_id IS NOT NULL THEN
        RETURN existing_conv_id;
    END IF;

    -- Create new conversation
    INSERT INTO public.conversations (created_at, updated_at)
    VALUES (TIMEZONE('utc'::text, NOW()), TIMEZONE('utc'::text, NOW()))
    RETURNING id INTO new_conv_id;

    -- Insert members
    INSERT INTO public.conversation_members (conversation_id, user_id, joined_at)
    VALUES 
        (new_conv_id, current_uid, TIMEZONE('utc'::text, NOW())),
        (new_conv_id, other_user_id, TIMEZONE('utc'::text, NOW()));

    RETURN new_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 8.1 PROFILES POLICIES
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
    FOR SELECT TO authenticated
    USING (account_status = 'active' OR id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin());

-- 8.2 PARTNER PREFERENCES POLICIES
CREATE POLICY "Preferences viewable by authenticated users" ON public.partner_preferences
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Users manage own partner preferences" ON public.partner_preferences
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- 8.3 PROFILE MEDIA POLICIES
CREATE POLICY "Media viewable by authenticated users" ON public.profile_media
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Users manage own profile media" ON public.profile_media
    FOR ALL TO authenticated USING (profile_id = auth.uid());

-- 8.4 SOCIAL POLICIES (Likes, Saved, Actions)
CREATE POLICY "Users manage own profile likes" ON public.profile_likes
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users view likes directed to them" ON public.profile_likes
    FOR SELECT TO authenticated USING (profile_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Users manage own saved profiles" ON public.saved_profiles
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users manage own match actions" ON public.match_actions
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- 8.5 MATCHES POLICIES
CREATE POLICY "Users view own matches" ON public.matches
    FOR SELECT TO authenticated
    USING (user_one_id = auth.uid() OR user_two_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users manage own matches" ON public.matches
    FOR ALL TO authenticated
    USING (user_one_id = auth.uid() OR user_two_id = auth.uid());

-- 8.6 CONVERSATION & MESSAGING POLICIES (ADVERSARIALLY HARDENED)
CREATE POLICY "Users view joined conversations" ON public.conversations
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = conversations.id AND user_id = auth.uid()));

CREATE POLICY "Users view conversation members" ON public.conversation_members
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()));

-- Restrict conversation_members UPDATE and DELETE to owner
CREATE POLICY "Users update own conversation member state" ON public.conversation_members
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users leave conversations" ON public.conversation_members
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Prevent arbitrary room joining via REST INSERT. Must use get_or_create_conversation RPC function.
CREATE POLICY "Prevent direct conversation_members insertion" ON public.conversation_members
    FOR INSERT TO authenticated WITH CHECK (FALSE);

CREATE POLICY "Users view messages in active conversations" ON public.messages
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));

CREATE POLICY "Users send messages to active conversations" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));

CREATE POLICY "Users update/delete own sent messages" ON public.messages
    FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- 8.7 NOTIFICATIONS POLICIES
CREATE POLICY "Users view and update own notifications" ON public.notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications read state" ON public.notifications
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications" ON public.notifications
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 8.8 USER SETTINGS POLICIES
CREATE POLICY "Users manage own settings" ON public.user_settings
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- 8.9 COMMUNITY POLICIES
CREATE POLICY "Posts viewable by authenticated users" ON public.community_posts
    FOR SELECT TO authenticated USING (is_published = TRUE OR author_id = auth.uid() OR public.is_admin());

CREATE POLICY "Authors manage own posts" ON public.community_posts
    FOR ALL TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Users manage own post reactions" ON public.post_reactions
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- 8.10 ROLES & MODERATION POLICIES
CREATE POLICY "Roles viewable by authenticated" ON public.roles
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "User roles viewable by owner or admin" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins manage user roles" ON public.user_roles
    FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Users create reports" ON public.reports
    FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins manage reports" ON public.reports
    FOR ALL TO authenticated USING (public.is_admin());

-- 8.11 CONTACT MESSAGES POLICIES (Public Submission + Admin Management)
CREATE POLICY "Anyone can submit contact message" ON public.contact_messages
    FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "Admins manage contact messages" ON public.contact_messages
    FOR ALL TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------
-- 9. REALTIME PUBLICATION
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages;

-- ---------------------------------------------------------------------
-- 10. SUPABASE STORAGE BUCKET DOCUMENTATION & SECURE RLS POLICIES
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', false) ON CONFLICT (id) DO NOTHING;

-- Storage RLS for profile-images
CREATE POLICY "Profile images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');
CREATE POLICY "Users can upload own profile images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update/delete own profile images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can remove own profile images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS for chat-media (Securely restricted to room participants)
CREATE POLICY "Chat media accessible to conversation members" ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'chat-media' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id::text = (storage.foldername(name))[2]
              AND cm.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can upload chat media to joined conversations" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id::text = (storage.foldername(name))[2]
          AND cm.user_id = auth.uid()
    )
);

-- =====================================================================
-- END OF CANONICAL SCHEMA FILE
-- =====================================================================
