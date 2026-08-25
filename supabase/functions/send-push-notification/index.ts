import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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

    // Verificar que el llamador sea admin
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
    const { data: callerProfile } = await sb
      .from("profiles")
      .select("rol")
      .eq("id", caller.user.id)
      .single();
    if (!callerProfile || String(callerProfile.rol).toLowerCase() !== "admin") {
      return new Response(
        JSON.stringify({ error: "FORBIDDEN", details: "Solo administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Shape esperada: { userIds: string[], title?: string, body: string }
    const { userIds, title, body: message } = body as {
      userIds?: string[];
      title?: string;
      body?: string;
    };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Response(JSON.stringify({ error: "Missing 'userIds' in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!message || !String(message).trim()) {
      return new Response(JSON.stringify({ error: "Missing 'body' in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recolectar tokens de push de los usuarios seleccionados.
    // Se consulta la tabla `push_tokens` (un usuario puede tener varios dispositivos)
    // y, como respaldo, la columna `expo_push_token` de `profiles`.
    const tokens = new Set<string>();

    try {
      const { data: tokenRows } = await sb
        .from("push_tokens")
        .select("token")
        .in("profile_id", userIds);
      (tokenRows || []).forEach((r: any) => {
        if (r?.token) tokens.add(String(r.token));
      });
    } catch (e) {
      console.warn("push_tokens query failed (tabla puede no existir):", e);
    }

    try {
      const { data: profileRows } = await sb
        .from("profiles")
        .select("expo_push_token")
        .in("id", userIds);
      (profileRows || []).forEach((r: any) => {
        if (r?.expo_push_token) tokens.add(String(r.expo_push_token));
      });
    } catch (e) {
      console.warn("profiles.expo_push_token query failed:", e);
    }

    const tokenList = Array.from(tokens).filter((t) => t.startsWith("ExponentPushToken["));
    const total = tokenList.length;

    if (total === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          total: 0,
          message: "No se encontraron dispositivos con token de push registrado.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enviar en lotes de máximo 100 tokens por petición a Expo
    let sent = 0;
    const chunks = Math.ceil(total / 100);
    for (let i = 0; i < chunks; i++) {
      const slice = tokenList.slice(i * 100, (i + 1) * 100);
      const messages = slice.map((to) => ({
        to,
        title: title || "TrueEnglish",
        body: message,
        sound: "default",
        _displayInForeground: true,
      }));
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
          },
          body: JSON.stringify(messages),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("Expo push error:", json);
          continue;
        }
        const receipts = Array.isArray(json) ? json : json?.data ?? [];
        receipts.forEach((r: any) => {
          if (!r?.status || r.status === "ok" || r.status === "sent") sent++;
        });
      } catch (e) {
        console.error("Expo push request failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, total }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
