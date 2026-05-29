// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js";

// You can hardcode your project values here if you do not want to use env/secrets.
// WARNING: embedding service role keys in source is insecure. Prefer using
// Supabase secrets or environment variables. Replace the placeholders below
// with your actual values only in a safe/private environment.
const SUPABASE_URL = "https://vymijjuxxrpxtrxjnoky.supabase.co"; // e.g. https://xyz.supabase.co
const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bWlqanV4eHJweHRyeGpub2t5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyNjQ0NiwiZXhwIjoyMDc4NjAyNDQ2fQ.mltiEWa0iO14SmfipjHNyYnTOFf532f68zdgdEu1dxA"; // your service_role key

// If you set this to `true` the function will include the (masked) service
// key in error responses for debugging. Keep it false in production.
const SHOW_KEYS_IN_ERRORS = false;

function maskKey(key: string) {
  if (!key) return '';
  if (key.length <= 8) return '********';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

Deno.serve(async (req: Request) => {
  // CORS headers for browser callers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  } as Record<string, string>;

  // Reply to preflight immediately
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Fail fast with a helpful message if values are not set
  if (!SUPABASE_URL || !SERVICE_ROLE || SUPABASE_URL.startsWith('REPLACE_WITH') || SERVICE_ROLE.startsWith('REPLACE_WITH')) {
    const details: Record<string, unknown> = { message: 'Missing or placeholder SUPABASE_URL or SERVICE_ROLE in function source' };
    if (SHOW_KEYS_IN_ERRORS) details.service_role = maskKey(SERVICE_ROLE);
    return new Response(JSON.stringify({ error: 'CONFIG_INVALID', details }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // create admin client here after validating config
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  console.info('admin client created (masked service role)', { service_role_masked: maskKey(SERVICE_ROLE) });
  try {
    console.info('delete-user invoked', { url: req.url, method: req.method, supabase_url: SUPABASE_URL, service_role_masked: maskKey(SERVICE_ROLE) });
    // Log headers (mask Authorization)
    try {
      const hdrs = Object.fromEntries(req.headers);
      if (hdrs.authorization) hdrs.authorization = hdrs.authorization.slice(0, 6) + '...';
      console.info('request headers', hdrs);
    } catch (e) {
      console.info('could not serialize headers', String(e));
    }
    // Try to get userId from JSON body; if body empty or non-json, fall back to query param
    let payload: any = {};
    const rawText = await req.text();
    console.info('raw body length', rawText?.length ?? 0);
    if (rawText && rawText.trim().length > 0) {
      try {
        payload = JSON.parse(rawText);
        console.info('parsed payload', payload);
      } catch (parseErr) {
        console.error('Failed to parse JSON body', parseErr, 'rawTextPreview=', rawText.slice(0, 200));
        return new Response(JSON.stringify({ error: 'INVALID_JSON', details: String(parseErr), rawBody: rawText.slice(0, 200) }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // support query param: /?userId=...
    const url = new URL(req.url);
    try {
      const qp = Object.fromEntries(url.searchParams.entries());
      console.info('query params', qp);
    } catch (e) {
      console.info('could not read query params', String(e));
    }
    const userId = payload?.userId ?? url.searchParams.get('userId') ?? undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'MISSING_USER_ID', details: 'Provide userId in JSON body or ?userId=query param' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const authHeader = req.headers.get("authorization");
    console.info('authorization header present', Boolean(authHeader));
    if (!authHeader) return new Response(JSON.stringify({ error: 'UNAUTHENTICATED', details: 'Authorization header missing' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const token = authHeader.replace("Bearer ", "");
    console.info('caller token masked', token ? (token.length > 8 ? token.slice(0, 4) + '...' + token.slice(-4) : '***') : null);

    // Create a client that forwards the caller token so we can identify the invoker
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.error('auth.getUser failed', userErr);
      return new Response(JSON.stringify({ error: 'INVALID_TOKEN', details: userErr?.message ?? String(userErr) }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const callerId = userData.user.id;
    console.info('caller id from token', callerId);

    // Verificar que el llamador sea admin (rol='admin').
    const { data: callerProfile } = await admin.from('profiles').select('rol').eq('id', callerId).single();
    if (!callerProfile || String(callerProfile.rol).toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ error: 'FORBIDDEN', details: 'Solo administradores pueden eliminar usuarios' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Deletion flow with rollback: delete profile row first, then delete auth user.
    console.info('🧭 starting deletion flow', { userId });

    // fetch existing profile to allow rollback if needed
    let existingProfile: any = null;
    try {
      const { data: profileRow, error: fetchErr } = await admin.from('profiles').select('*').eq('id', userId).single();
      if (fetchErr) {
        console.info('⚠️ profile fetch before delete returned error (may not exist)', { fetchErr: fetchErr.message ?? String(fetchErr) });
      } else {
        existingProfile = profileRow;
        console.info('📦 fetched existing profile for backup', { id: existingProfile?.id, tipo: existingProfile?.tipo });
        // Prevent deleting users that themselves are admins (rol='admin')
        if (String(existingProfile?.rol ?? '').toLowerCase() === 'admin') {
          console.warn('⛔ deletion blocked: target user is admin', { userId });
          return new Response(JSON.stringify({ error: 'CANNOT_DELETE_ADMIN', details: 'No se puede eliminar usuarios con rol admin' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }
    } catch (e) {
      console.error('⚠️ exception fetching existing profile for backup', String(e));
    }

    // Delete profile first
    try {
      console.info('🗑️ attempting to delete profile row', { userId });
      const { data: delProfileData, error: delProfileErr } = await admin.from('profiles').delete().eq('id', userId);
      if (delProfileErr) {
        console.error('❌ failed to delete profile row', delProfileErr);
        return new Response(JSON.stringify({ error: 'DB_DELETE_FAILED', details: delProfileErr.message ?? String(delProfileErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      console.info('✅ profile row deleted', { deletedCount: Array.isArray(delProfileData) ? delProfileData.length : delProfileData ? 1 : 0 });
    } catch (e) {
      console.error('❌ exception while deleting profile row', String(e));
      return new Response(JSON.stringify({ error: 'DB_DELETE_EXCEPTION', details: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Now delete user in Auth
    try {
      console.info('🔒 attempting to delete user in Auth', { userId });
      const { error: delAuthErr } = await admin.auth.admin.deleteUser(userId);
      if (delAuthErr) {
        console.error('❌ failed to delete user in Auth', delAuthErr);
        // rollback: try to restore profile row if we have it
        if (existingProfile) {
          try {
            console.info('♻️ attempting rollback: restore profile row', { id: existingProfile.id });
            const { error: reinsertErr } = await admin.from('profiles').insert(existingProfile);
            if (reinsertErr) {
              console.error('⚠️ rollback failed to restore profile', reinsertErr);
              return new Response(JSON.stringify({ error: 'AUTH_DELETE_FAILED_ROLLBACK_FAILED', details: delAuthErr.message ?? String(delAuthErr), rollbackError: String(reinsertErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
            }
            console.info('♻️ rollback succeeded: profile restored', { id: existingProfile.id });
            return new Response(JSON.stringify({ error: 'AUTH_DELETE_FAILED_ROLLED_BACK', details: delAuthErr.message ?? String(delAuthErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          } catch (reinErr) {
            console.error('⚠️ exception during rollback', String(reinErr));
            return new Response(JSON.stringify({ error: 'AUTH_DELETE_FAILED_ROLLBACK_EXCEPTION', details: delAuthErr.message ?? String(delAuthErr), rollbackException: String(reinErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          }
        }
        return new Response(JSON.stringify({ error: 'AUTH_DELETE_FAILED', details: delAuthErr.message ?? String(delAuthErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      console.info('✅ deleted user from Auth', { userId });
    } catch (e) {
      console.error('❌ exception when deleting user in Auth', String(e));
      // attempt rollback
      if (existingProfile) {
        try {
          console.info('♻️ attempting rollback after exception', { id: existingProfile.id });
          const { error: reinErr } = await admin.from('profiles').insert(existingProfile);
          if (reinErr) {
            console.error('⚠️ rollback failed', reinErr);
            return new Response(JSON.stringify({ error: 'AUTH_DELETE_EXCEPTION_ROLLBACK_FAILED', details: String(e), rollbackError: String(reinErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          }
          console.info('♻️ rollback succeeded after exception', { id: existingProfile.id });
          return new Response(JSON.stringify({ error: 'AUTH_DELETE_EXCEPTION_ROLLED_BACK', details: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        } catch (reinErr) {
          console.error('⚠️ exception during rollback after auth exception', String(reinErr));
          return new Response(JSON.stringify({ error: 'AUTH_DELETE_EXCEPTION_ROLLBACK_EXCEPTION', details: String(e), rollbackException: String(reinErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }
      return new Response(JSON.stringify({ error: 'AUTH_DELETE_EXCEPTION', details: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
