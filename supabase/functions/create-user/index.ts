// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js";

// IMPORTANT: prefer using secrets via supabase CLI: supabase secrets set SUPABASE_SERVICE_ROLE="..."
// For quick testing you can hardcode, but don't commit the service key.
const SUPABASE_URL = "https://vymijjuxxrpxtrxjnoky.supabase.co";
const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bWlqanV4eHJweHRyeGpub2t5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyNjQ0NiwiZXhwIjoyMDc4NjAyNDQ2fQ.mltiEWa0iO14SmfipjHNyYnTOFf532f68zdgdEu1dxA";

const SHOW_KEYS_IN_ERRORS = false;
function maskKey(k: string) { if (!k) return ''; return k.length > 8 ? k.slice(0, 4) + '...' + k.slice(-4) : '********'; }

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (!SUPABASE_URL || !SERVICE_ROLE || SUPABASE_URL.startsWith('REPLACE_WITH') || SERVICE_ROLE.startsWith('REPLACE_WITH')) {
    const details: any = { message: 'Missing config' };
    if (SHOW_KEYS_IN_ERRORS) details.service_role = maskKey(SERVICE_ROLE);
    return new Response(JSON.stringify({ error: 'CONFIG_INVALID', details }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    // Verificar que el llamador sea admin (rol='admin').
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    const callerToken = authHeader.replace('Bearer ', '');
    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) return new Response(JSON.stringify({ error: 'INVALID_TOKEN' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    const { data: callerProfile } = await admin.from('profiles').select('rol').eq('id', callerData.user.id).single();
    if (!callerProfile || String(callerProfile.rol).toLowerCase() !== 'admin') return new Response(JSON.stringify({ error: 'FORBIDDEN', details: 'Solo administradores' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } });

    const text = await req.text();
    if (!text) return new Response(JSON.stringify({ error: 'MISSING_BODY' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
    let body: any;
    try { body = JSON.parse(text); } catch (e) { return new Response(JSON.stringify({ error: 'INVALID_JSON', details: String(e) }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }); }

    const {
      email, password, name, last_name, phone, birth_date, nivel_actual, status, tipo, rol, code, id: forcedId
    } = body;

    if (!email || !password) return new Response(JSON.stringify({ error: 'MISSING_FIELDS', details: 'email and password required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

    // Create auth user with admin client; this will NOT create a session for the admin or the new user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: String(email),
      password: String(password),
      email_confirm: true,
      // you can add user_metadata here
    } as any);
    if (createErr) return new Response(JSON.stringify({ error: 'AUTH_CREATE_FAILED', details: createErr.message ?? String(createErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });

    const newUserId = created?.user?.id;
    if (!newUserId) return new Response(JSON.stringify({ error: 'NO_USER_ID', details: created }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });

    // Insert profile row (use provided forcedId if present, else newUserId)
    const profileObj: Record<string, any> = {
      id: forcedId ?? newUserId,
      email,
      name: name ?? null,
      last_name: last_name ?? null,
      phone: phone ?? null,
      birth_date: birth_date ?? null,
      nivel_actual: nivel_actual ?? null,
      status: status ?? 'activo',
      tipo: (tipo ?? 'Alumno'),
      rol: (rol ?? 'usuario'),
      code: code ?? null,
    };

    const { data: profileData, error: profileErr } = await admin.from('profiles').upsert(profileObj, { onConflict: 'id' });
    if (profileErr) {
      // attempt to rollback auth user
      try { await admin.auth.admin.deleteUser(newUserId); } catch (e) { }
      return new Response(JSON.stringify({ error: 'PROFILE_CREATE_FAILED', details: profileErr.message ?? String(profileErr) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    return new Response(JSON.stringify({ ok: true, userId: newUserId }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
});
