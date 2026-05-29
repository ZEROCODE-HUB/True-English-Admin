import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@0.7.0/mod.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el llamador sea admin (rol='admin').
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: caller } = await sb.auth.getUser();
    if (!caller?.user) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: callerProfile } = await sb.from("profiles").select("rol").eq("id", caller.user.id).single();
    if (!callerProfile || String(callerProfile.rol).toLowerCase() !== "admin") {
      return new Response(JSON.stringify({ error: "FORBIDDEN", details: "Solo administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expected shape:
    // {
    //   smtp: { host, port, username, password, secure? },
    //   mail: { from, to, subject, html?, text? }
    // }

    const { smtp, mail } = body as any;
    if (!smtp || !mail) {
      return new Response(JSON.stringify({ error: "Missing 'smtp' or 'mail' in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { host, port, username, password, secure } = smtp;
    const { from, to, subject, html, text } = mail;

    if (!host || !port || !username || !password) {
      return new Response(JSON.stringify({ error: "Missing smtp credentials (host, port, username, password)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!from || !to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "Missing mail fields (from, to, subject and html/text)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new SmtpClient();

    // If port is 465 or secure=true -> use TLS, otherwise use STARTTLS (port 587)
    const useTls = secure === true || Number(port) === 465;

    await client.connect({
      hostname: host,
      port: Number(port),
      username,
      password,
      tls: useTls,
    });

    await client.send({
      from,
      to,
      subject,
      content: text ?? "",
      html,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-smtp-dynamic error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
