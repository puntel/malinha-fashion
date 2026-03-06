import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is using service role key (internal calls)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (!caller) throw new Error("Unauthorized");

      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "master")
        .maybeSingle();
      if (!roleData) throw new Error("Forbidden: not master");
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create_loja") {
      const { loja_name, loja_phone, loja_cnpj, owner_email, owner_password, owner_name } = body;

      // Create auth user for loja owner
      const { data: newUser, error: userErr } = await adminClient.auth.admin.createUser({
        email: owner_email,
        password: owner_password,
        email_confirm: true,
        user_metadata: { full_name: owner_name },
      });
      if (userErr) throw userErr;

      const userId = newUser.user.id;

      // Assign role
      await adminClient.from("user_roles").insert({ user_id: userId, role: "loja" });

      // Create loja
      const { data: loja, error: lojaErr } = await adminClient
        .from("lojas")
        .insert({ name: loja_name, phone: loja_phone || null, cnpj: loja_cnpj || null, created_by: userId })
        .select("id")
        .single();
      if (lojaErr) throw lojaErr;

      // Add as loja member
      await adminClient.from("loja_members").insert({ user_id: userId, loja_id: loja.id });

      return new Response(JSON.stringify({ success: true, loja_id: loja.id, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_vendedora") {
      const { email, password, full_name, phone, loja_id } = body;

      // Create auth user
      const { data: newUser, error: userErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (userErr) throw userErr;

      const userId = newUser.user.id;

      // Assign role
      await adminClient.from("user_roles").insert({ user_id: userId, role: "vendedora" });

      // Update profile phone
      if (phone) {
        await adminClient.from("profiles").update({ phone }).eq("user_id", userId);
      }

      // Create vendedora record
      await adminClient.from("vendedoras").insert({ user_id: userId, loja_id });

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { user_email, new_password } = body;
      const { data: users } = await adminClient.auth.admin.listUsers();
      const target = users?.users?.find((u: any) => u.email === user_email);
      if (!target) throw new Error("User not found");
      const { error } = await adminClient.auth.admin.updateUserById(target.id, { password: new_password });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
