import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMP_PASSWORD_FALLBACK = "A1b2c3";

function generateTemporaryPassword() {
  try {
    const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    return `Ml#${random}A1`;
  } catch {
    return TEMP_PASSWORD_FALLBACK;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    // Check caller role
    const { data: callerRoles, error: rolesErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    if (rolesErr) throw rolesErr;
    
    const roles = (callerRoles || []).map((r: any) => r.role);
    const isMaster = roles.includes("master");
    const isLoja = roles.includes("loja");

    if (action === "create_loja") {
      if (!isMaster) throw new Error("Forbidden: not master");
      const { loja_name, loja_phone, loja_cnpj, owner_email, owner_password, owner_name } = body;
      const temporaryPassword = owner_password?.trim() || generateTemporaryPassword();

      const { data: newUser, error: userErr } = await adminClient.auth.admin.createUser({
        email: owner_email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: owner_name },
      });
      if (userErr) throw userErr;

      const userId = newUser.user.id;
      const { error: roleInsertErr } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: "loja" });
      if (roleInsertErr) throw roleInsertErr;

      const { data: loja, error: lojaErr } = await adminClient
        .from("lojas")
        .insert({ name: loja_name, phone: loja_phone || null, cnpj: loja_cnpj || null, created_by: userId })
        .select("id")
        .single();
      if (lojaErr) throw lojaErr;

      const { error: memberInsertErr } = await adminClient
        .from("loja_members")
        .insert({ user_id: userId, loja_id: loja.id });
      if (memberInsertErr) throw memberInsertErr;

      return new Response(JSON.stringify({ success: true, loja_id: loja.id, user_id: userId, temporary_password: temporaryPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_vendedora") {
      // Both master and loja can create vendedoras
      if (!isMaster && !isLoja) throw new Error("Forbidden: requires master or loja role");

      const { email, password, full_name, phone, loja_id } = body;

      // If loja, verify they belong to this loja
      if (isLoja && !isMaster) {
        const { data: membership } = await adminClient
          .from("loja_members")
          .select("id")
          .eq("user_id", caller.id)
          .eq("loja_id", loja_id)
          .maybeSingle();
        if (!membership) throw new Error("Forbidden: you don't belong to this loja");
      }

      const temporaryPassword = password?.trim() || generateTemporaryPassword();

      const { data: newUser, error: userErr } = await adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (userErr) throw userErr;

      const userId = newUser.user.id;
      await adminClient.from("user_roles").insert({ user_id: userId, role: "vendedora" });
      if (phone) {
        await adminClient.from("profiles").update({ phone }).eq("user_id", userId);
      }
      await adminClient.from("vendedoras").insert({ user_id: userId, loja_id });

      return new Response(JSON.stringify({ success: true, user_id: userId, temporary_password: temporaryPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      if (!isMaster) throw new Error("Forbidden: not master");
      const { user_email, new_password } = body;
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const target = users?.find((u: any) => u.email === user_email);
      if (!target) throw new Error("User not found");
      const { error } = await adminClient.auth.admin.updateUserById(target.id, { password: new_password });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
