import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ONESIGNAL_URL = "https://onesignal.com/api/v1/notifications";

serve(async (req) => {
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

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );
    const { data: caller } = await sb.auth.getUser();
    if (!caller?.user) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await sb
      .from("profiles")
      .select("rol")
      .eq("id", caller.user.id)
      .single();
    if (!profile || String(profile.rol).toLowerCase() !== "admin") {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      headings,
      contents,
      include_external_user_ids,
    } = body as {
      headings?: Record<string, string>;
      contents?: Record<string, string>;
      include_external_user_ids?: string[];
    };

    if (!Array.isArray(include_external_user_ids) || include_external_user_ids.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, body: { recipients: 0 }, message: "No hay usuarios seleccionados." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolver el OneSignal App ID EXACTAMENTE como el móvil: primero la tabla
    // `app_config` (key 'onesignal_app_id') y, si no existe, el valor por defecto
    // hardcodeado. Así el admin envía a la MISMA app donde el móvil registra los
    // dispositivos (si usáramos el secret ONESIGNAL_APP_ID podríamos apuntar a otra app).
    let appId = "d4b458c5-4f94-4352-9d9c-47242d04b61a";
    try {
      const { data: cfg } = await sb
        .from("app_config")
        .select("value")
        .eq("key", "onesignal_app_id")
        .maybeSingle();
      if (cfg?.value) appId = String(cfg.value);
    } catch {
      // app_config puede no existir aún; usar el fallback
    }
    const apiKey = Deno.env.get("ONESIGNAL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "OneSignal no configurado (API key)" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      app_id: appId,
      headings: headings ?? { en: "TrueEnglish" },
      contents: contents ?? { en: "" },
      include_external_user_ids,
      target_channel: "push",
    };

    const auth = "Basic " + btoa(apiKey + ":");

    try {
      const res = await fetch(ONESIGNAL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: "OneSignal error", detail: json }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const recipients = (json && json.recipients) ?? 0;

      // Diagnóstico cuando no hay destinatarios: consultar OneSignal para
      // saber si existen dispositivos y cuántos tienen external_user_id seteado.
      let diagnostic: Record<string, unknown> | undefined;
      if (recipients === 0) {
        try {
          const playersRes = await fetch(
            `https://onesignal.com/api/v1/players?app_id=${appId}&limit=100`,
            { method: "GET", headers: { Authorization: auth } }
          );
          const playersJson = await playersRes.json().catch(() => null);
          const players = (playersJson && playersJson.players) || [];
          const withExt = players.filter((p: any) => p && p.external_user_id).length;
          diagnostic = {
            app_id: appId,
            total_devices: playersJson?.total_count ?? players.length,
            devices_with_external_user_id: withExt,
            requested_ids: include_external_user_ids,
          };
        } catch (e) {
          diagnostic = { error: String(e) };
        }
      }

      return new Response(
        JSON.stringify({ ok: true, body: { recipients, diagnostic } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: String(e) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
