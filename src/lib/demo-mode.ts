/**
 * Demo mode keeps data in server memory, per browser cookie. That's fine on a developer's
 * machine, but not on a public server: anyone could fill its memory, and data vanishes on
 * restart. So outside development it is off unless ALLOW_PUBLIC_DEMO=1 is set on purpose.
 */
export function supabaseEnvSet() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function demoAllowed() {
  if (supabaseEnvSet()) return false;
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_PUBLIC_DEMO === "1";
}
