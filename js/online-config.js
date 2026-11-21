// Online features (sign-in, cloud save, rooms) stay OFF until both values are filled in.
// Both are PUBLIC by design (Supabase "Project URL" and "anon public" key): security comes from the
// Row Level Security policies in backend/supabase/schema.sql. Never put the service_role key here.
export const ONLINE = {
  supabaseUrl: '',      // e.g. 'https://abcd1234.supabase.co'
  supabaseAnonKey: '',  // Settings → API → Project API keys → anon public
};
