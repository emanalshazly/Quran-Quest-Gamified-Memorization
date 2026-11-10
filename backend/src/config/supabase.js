const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)');
}

if (!supabaseServiceKey) {
    console.warn(
        '⚠️  SUPABASE_SERVICE_KEY is not set. Falling back to the anon key for DB ' +
        'operations — RLS will block most server-side queries. Set the service key in .env.'
    );
}

// Auth client (anon key) — used only for Supabase Auth operations
// (signUp, signInWithPassword, getUser, resetPasswordForEmail).
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
});

// DB client (service-role key) — bypasses RLS. All ownership checks are
// enforced in route/middleware code. Never expose this key to clients.
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: { persistSession: false }
});

module.exports = {
    supabase,        // DB operations (service role)
    supabaseAuth,    // Auth operations (anon key)
    supabaseAdmin: supabase // backwards-compatible alias
};
