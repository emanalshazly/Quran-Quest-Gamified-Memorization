-- Quran Quest Database Schema
-- PostgreSQL + Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Parent Accounts)
-- Linked 1:1 to Supabase Auth (auth.users). Passwords are managed by
-- Supabase Auth, so there is no password column here.
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'family')),
    subscription_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Auto-create a public.users row whenever a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Kids Profiles Table
CREATE TABLE kids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(50) DEFAULT 'default_avatar.png',
    date_of_birth DATE,
    level INTEGER DEFAULT 1,
    total_points INTEGER DEFAULT 0,
    streak_count INTEGER DEFAULT 0,
    last_activity_date DATE,
    preferred_reciter VARCHAR(50) DEFAULT 'minshawi',
    language_preference VARCHAR(10) DEFAULT 'ar' CHECK (language_preference IN ('ar', 'en')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- PostgreSQL does not allow subqueries in CHECK constraints, so the
-- per-subscription kid limit (free=1, pro=3, family=5) is enforced
-- with a trigger instead.
CREATE OR REPLACE FUNCTION enforce_kids_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_tier VARCHAR(20);
    v_count INTEGER;
    v_limit INTEGER;
BEGIN
    SELECT subscription_tier INTO v_tier FROM users WHERE id = NEW.user_id;

    v_limit := CASE v_tier
        WHEN 'family' THEN 5
        WHEN 'pro' THEN 3
        ELSE 1
    END;

    SELECT COUNT(*) INTO v_count FROM kids WHERE user_id = NEW.user_id;

    IF v_count >= v_limit THEN
        RAISE EXCEPTION 'Kid profile limit reached for % tier (max %)', COALESCE(v_tier, 'free'), v_limit
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_kids_limit_trigger
BEFORE INSERT ON kids
FOR EACH ROW EXECUTE FUNCTION enforce_kids_limit();

-- Surahs Table
CREATE TABLE surahs (
    id SERIAL PRIMARY KEY,
    surah_number INTEGER UNIQUE NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    verses_count INTEGER NOT NULL,
    revelation_type VARCHAR(10) CHECK (revelation_type IN ('makki', 'madani')),
    description_ar TEXT,
    description_en TEXT,
    virtue_ar TEXT,
    virtue_en TEXT,
    juz_number INTEGER,
    audio_url_minshawi VARCHAR(255),
    audio_url_abdulbasit VARCHAR(255),
    audio_url_maher VARCHAR(255),
    is_free BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Verses Table
CREATE TABLE verses (
    id SERIAL PRIMARY KEY,
    surah_id INTEGER NOT NULL REFERENCES surahs(id) ON DELETE CASCADE,
    verse_number INTEGER NOT NULL,
    text_ar TEXT NOT NULL,
    text_transliteration TEXT,
    text_translation_en TEXT,
    -- Basmala shown before verse 1 (all surahs except 1 and 9); not part of the verse itself
    bismillah_prefix TEXT,
    audio_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (surah_id, verse_number)
);

-- Memorized Verses Table (for Spaced Repetition)
CREATE TABLE memorized_verses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    verse_id INTEGER NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
    memorized_at TIMESTAMP DEFAULT NOW(),
    next_review_date TIMESTAMP NOT NULL,
    ease_factor DECIMAL(3, 2) DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    repetition_count INTEGER DEFAULT 0,
    last_review_date TIMESTAMP,
    last_review_quality INTEGER CHECK (last_review_quality BETWEEN 0 AND 5),
    mastery_level VARCHAR(20) DEFAULT 'beginner' CHECK (mastery_level IN ('beginner', 'intermediate', 'advanced', 'master')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (kid_id, verse_id)
);

-- Recordings Table (Voice Recordings)
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    verse_id INTEGER NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
    audio_url VARCHAR(255) NOT NULL,
    duration_seconds INTEGER,
    accuracy_score DECIMAL(5, 2) CHECK (accuracy_score BETWEEN 0 AND 100),
    tajweed_score DECIMAL(5, 2) CHECK (tajweed_score BETWEEN 0 AND 100),
    pronunciation_score DECIMAL(5, 2) CHECK (pronunciation_score BETWEEN 0 AND 100),
    errors_detected JSONB,
    feedback_ar TEXT,
    feedback_en TEXT,
    recorded_at TIMESTAMP DEFAULT NOW(),
    analysis_completed_at TIMESTAMP,
    is_passed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Badges Table
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    badge_name VARCHAR(100) NOT NULL,
    badge_type VARCHAR(50) NOT NULL,
    badge_icon VARCHAR(100),
    description_ar TEXT,
    description_en TEXT,
    earned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (kid_id, badge_name)
);

-- Daily Challenges Table
CREATE TABLE daily_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    challenge_date DATE DEFAULT CURRENT_DATE,
    challenge_type VARCHAR(50) NOT NULL,
    challenge_description_ar TEXT,
    challenge_description_en TEXT,
    target_value INTEGER NOT NULL,
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    reward_points INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (kid_id, challenge_date)
);

-- Leaderboard Table
CREATE TABLE leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    weekly_points INTEGER DEFAULT 0,
    monthly_points INTEGER DEFAULT 0,
    global_rank INTEGER,
    family_rank INTEGER,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE (kid_id)
);

-- Battle Mode Challenges
CREATE TABLE battle_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenger_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    verse_id INTEGER NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
    winner_id UUID REFERENCES kids(id),
    challenger_score DECIMAL(5, 2),
    opponent_score DECIMAL(5, 2),
    challenger_time_seconds INTEGER,
    opponent_time_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Points History Table
CREATE TABLE points_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    activity_description TEXT,
    -- TEXT, not UUID: references can be verse ids (integers) or battle/recording UUIDs
    reference_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Parent Goals Table
CREATE TABLE parent_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL,
    goal_description TEXT,
    target_value INTEGER NOT NULL,
    current_progress INTEGER DEFAULT 0,
    deadline DATE,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    kid_id UUID REFERENCES kids(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title_ar VARCHAR(255),
    title_en VARCHAR(255),
    message_ar TEXT,
    message_en TEXT,
    is_read BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX idx_kids_user_id ON kids(user_id);
CREATE INDEX idx_verses_surah_id ON verses(surah_id);
CREATE INDEX idx_memorized_verses_kid_id ON memorized_verses(kid_id);
CREATE INDEX idx_memorized_verses_next_review ON memorized_verses(next_review_date);
CREATE INDEX idx_recordings_kid_id ON recordings(kid_id);
CREATE INDEX idx_badges_kid_id ON badges(kid_id);
CREATE INDEX idx_daily_challenges_kid_date ON daily_challenges(kid_id, challenge_date);
CREATE INDEX idx_leaderboard_points ON leaderboard(total_points DESC);
CREATE INDEX idx_points_history_kid_id ON points_history(kid_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for);

-- Create Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Updated At Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kids_updated_at BEFORE UPDATE ON kids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memorized_verses_updated_at BEFORE UPDATE ON memorized_verses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Sample Surahs Data (First 10 Surahs for testing)
INSERT INTO surahs (surah_number, name_ar, name_en, verses_count, revelation_type, juz_number, is_free, virtue_ar, virtue_en) VALUES
(1, 'الفاتحة', 'Al-Fatihah', 7, 'makki', 1, true, 'أعظم سورة في القرآن، وهي ركن من أركان الصلاة', 'The greatest surah in the Quran and a pillar of prayer'),
(112, 'الإخلاص', 'Al-Ikhlas', 4, 'makki', 30, true, 'تعدل ثلث القرآن', 'Equivalent to one-third of the Quran'),
(113, 'الفلق', 'Al-Falaq', 5, 'makki', 30, true, 'سورة من المعوذات للحماية من الشر', 'One of the protective surahs from evil'),
(114, 'الناس', 'An-Nas', 6, 'makki', 30, true, 'سورة من المعوذات للحماية من وسوسة الشيطان', 'Protection from the whispers of Satan'),
(110, 'النصر', 'An-Nasr', 3, 'madani', 30, false, 'آخر سورة نزلت كاملة', 'The last complete surah revealed'),
(111, 'المسد', 'Al-Masad', 5, 'makki', 30, false, 'سورة في ذم أبي لهب', 'About the condemnation of Abu Lahab'),
(109, 'الكافرون', 'Al-Kafirun', 6, 'makki', 30, false, 'سورة في البراءة من الشرك', 'Declaration of freedom from polytheism'),
(108, 'الكوثر', 'Al-Kawthar', 3, 'makki', 30, false, 'أقصر سور القرآن', 'The shortest surah in the Quran'),
(107, 'الماعون', 'Al-Maun', 7, 'makki', 30, false, 'سورة في ذم المرائين', 'About the condemnation of the hypocrites'),
(106, 'قريش', 'Quraysh', 4, 'makki', 30, false, 'سورة في نعمة الأمن والرزق', 'About the blessings of security and provision');

-- Function to calculate next review date using SM-2 Algorithm
CREATE OR REPLACE FUNCTION calculate_next_review(
    p_quality INTEGER,
    p_ease_factor DECIMAL,
    p_interval_days INTEGER,
    p_repetition_count INTEGER
) RETURNS TABLE(
    new_ease_factor DECIMAL,
    new_interval_days INTEGER,
    new_repetition_count INTEGER,
    next_review_date TIMESTAMP
) AS $$
DECLARE
    v_ease_factor DECIMAL;
    v_interval INTEGER;
    v_repetition INTEGER;
BEGIN
    -- SM-2 Algorithm Implementation
    -- Quality: 0-5 (0=complete blackout, 5=perfect response)

    -- Calculate new ease factor
    v_ease_factor := p_ease_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));

    IF v_ease_factor < 1.3 THEN
        v_ease_factor := 1.3;
    END IF;

    -- Calculate new interval and repetition
    IF p_quality < 3 THEN
        -- Failed recall - start over
        v_interval := 0;
        v_repetition := 0;
    ELSE
        v_repetition := p_repetition_count + 1;

        IF v_repetition = 1 THEN
            v_interval := 1;
        ELSIF v_repetition = 2 THEN
            v_interval := 6;
        ELSE
            v_interval := ROUND(p_interval_days * v_ease_factor);
        END IF;
    END IF;

    RETURN QUERY SELECT
        v_ease_factor,
        v_interval,
        v_repetition,
        (NOW() + INTERVAL '1 day' * v_interval)::TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Atomic points increment (avoids read-modify-write races) that also
-- recalculates the kid's level from the running total.
CREATE OR REPLACE FUNCTION increment_kid_points(p_kid_id UUID, p_points INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
    v_level INTEGER;
BEGIN
    UPDATE kids
    SET total_points = GREATEST(0, total_points + p_points)
    WHERE id = p_kid_id
    RETURNING total_points INTO v_total;

    IF v_total IS NULL THEN
        RAISE EXCEPTION 'Kid % not found', p_kid_id;
    END IF;

    -- Level thresholds (level 1 at 0 points, then 100, 250, 500, ...)
    v_level := CASE
        WHEN v_total >= 35000 THEN 20
        WHEN v_total >= 30000 THEN 19
        WHEN v_total >= 25000 THEN 18
        WHEN v_total >= 21000 THEN 17
        WHEN v_total >= 18000 THEN 16
        WHEN v_total >= 15000 THEN 15
        WHEN v_total >= 12500 THEN 14
        WHEN v_total >= 10000 THEN 13
        WHEN v_total >= 8000  THEN 12
        WHEN v_total >= 6500  THEN 11
        WHEN v_total >= 5000  THEN 10
        WHEN v_total >= 4000  THEN 9
        WHEN v_total >= 3000  THEN 8
        WHEN v_total >= 2000  THEN 7
        WHEN v_total >= 1500  THEN 6
        WHEN v_total >= 1000  THEN 5
        WHEN v_total >= 500   THEN 4
        WHEN v_total >= 250   THEN 3
        WHEN v_total >= 100   THEN 2
        ELSE 1
    END;

    UPDATE kids SET level = v_level WHERE id = p_kid_id AND level <> v_level;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Function to update leaderboard
CREATE OR REPLACE FUNCTION update_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert leaderboard entry
    INSERT INTO leaderboard (kid_id, user_id, total_points, last_updated)
    SELECT k.id, k.user_id, k.total_points, NOW()
    FROM kids k
    WHERE k.id = NEW.id
    ON CONFLICT (kid_id) DO UPDATE
    SET total_points = EXCLUDED.total_points,
        last_updated = NOW();

    -- Update ranks (global)
    WITH ranked_kids AS (
        SELECT kid_id, ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
        FROM leaderboard
    )
    UPDATE leaderboard l
    SET global_rank = r.rank
    FROM ranked_kids r
    WHERE l.kid_id = r.kid_id;

    -- Update family ranks
    WITH family_ranked AS (
        SELECT l.kid_id,
               ROW_NUMBER() OVER (PARTITION BY l.user_id ORDER BY l.total_points DESC) as rank
        FROM leaderboard l
    )
    UPDATE leaderboard l
    SET family_rank = fr.rank
    FROM family_ranked fr
    WHERE l.kid_id = fr.kid_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update leaderboard when kids table is updated
CREATE TRIGGER update_leaderboard_trigger
AFTER UPDATE OF total_points ON kids
FOR EACH ROW
EXECUTE FUNCTION update_leaderboard();

-- Row Level Security (RLS) Policies for Supabase
--
-- NOTE: the backend API uses the service-role key, which bypasses RLS and
-- enforces ownership in code. These policies protect direct access from the
-- mobile app (anon key) and any other client.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorized_verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own data"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- RLS Policies for kids
CREATE POLICY "Users can view their own kids"
    ON kids FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own kids"
    ON kids FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kids"
    ON kids FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own kids"
    ON kids FOR DELETE
    USING (auth.uid() = user_id);

-- Helper predicate used by the kid-owned tables below:
--   kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid())

-- RLS for memorized_verses
CREATE POLICY "Parents manage their kids' memorized verses"
    ON memorized_verses FOR ALL
    USING (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()))
    WITH CHECK (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()));

-- RLS for recordings
CREATE POLICY "Parents manage their kids' recordings"
    ON recordings FOR ALL
    USING (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()))
    WITH CHECK (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()));

-- RLS for badges (read-only for clients; awarded by the backend)
CREATE POLICY "Parents view their kids' badges"
    ON badges FOR SELECT
    USING (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()));

-- RLS for daily_challenges
CREATE POLICY "Parents manage their kids' daily challenges"
    ON daily_challenges FOR ALL
    USING (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()))
    WITH CHECK (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()));

-- RLS for points_history (read-only for clients)
CREATE POLICY "Parents view their kids' points history"
    ON points_history FOR SELECT
    USING (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()));

-- RLS for notifications
CREATE POLICY "Users manage their own notifications"
    ON notifications FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS for leaderboard: family rows only. The global leaderboard is served
-- by the backend in anonymized form to avoid exposing other children's data.
CREATE POLICY "Parents view their own family leaderboard"
    ON leaderboard FOR SELECT
    USING (auth.uid() = user_id);

-- RLS for battle_challenges (only battles involving the family's kids)
CREATE POLICY "Parents view their kids' battles"
    ON battle_challenges FOR SELECT
    USING (
        challenger_id IN (SELECT id FROM kids WHERE user_id = auth.uid())
        OR opponent_id IN (SELECT id FROM kids WHERE user_id = auth.uid())
    );

-- RLS for parent_goals
CREATE POLICY "Parents manage their kids' goals"
    ON parent_goals FOR ALL
    USING (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()))
    WITH CHECK (kid_id IN (SELECT id FROM kids WHERE user_id = auth.uid()));

-- Surahs and Verses are public (read-only)
ALTER TABLE surahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Surahs are viewable by everyone"
    ON surahs FOR SELECT
    USING (true);

CREATE POLICY "Verses are viewable by everyone"
    ON verses FOR SELECT
    USING (true);
