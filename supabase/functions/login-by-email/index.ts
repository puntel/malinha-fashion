import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Credentials": "true",
};

const INTERNAL_PASSWORD = "MalinhaStore#2026!Internal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) throw new Error("Email is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Supabase edge function env vars not configured: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY.");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user exists
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) throw listErr;

    const user = users?.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      return new Response(JSON.stringify({ error: "E-mail não cadastrado no sistema." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set internal password for the user
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password: INTERNAL_PASSWORD,
    });
    if (updateErr) throw updateErr;

    // Sign in with the internal password using a regular client
    const regularClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInErr } = await regularClient.auth.signInWithPassword({
      email: user.email!,
      password: INTERNAL_PASSWORD,
    });
    if (signInErr) throw signInErr;

    return new Response(JSON.stringify({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
