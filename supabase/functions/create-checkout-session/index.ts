import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@14.22.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { malinha_id } = await req.json();

    if (!malinha_id) {
      throw new Error("malinha_id is required");
    }

    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch malinha and products
    const { data: malinha, error: malinhaError } = await supabase
      .from('malinhas')
      .select('*, malinha_products(*)')
      .eq('id', malinha_id)
      .single();

    if (malinhaError || !malinha) {
      throw new Error("Malinha not found");
    }

    // Filter only accepted or edited products for the checkout
    const productsToCharge = malinha.malinha_products.filter(
      (p: any) => p.status === 'accepted' || p.status === 'edited'
    );

    if (productsToCharge.length === 0) {
      throw new Error("Nenhuma peça aceita para gerar cobrança.");
    }

    // Create line items for Stripe
    const lineItems = productsToCharge.map((p: any) => ({
      price_data: {
        currency: 'brl',
        product_data: {
          name: `Ref: ${p.code}`,
          description: `Tamanho: ${p.size}`,
          images: p.photo_url ? [p.photo_url] : [],
        },
        unit_amount: Math.round(Number(p.price) * 100), // Stripe uses cents
      },
      quantity: p.quantity,
    }));

    // Create Checkout Session
    const origin = req.headers.get("origin") || "http://localhost:8080";
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'boleto'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/malinha/${malinha_id}?payment=success`,
      cancel_url: `${origin}/malinha/${malinha_id}?payment=cancel`,
      client_reference_id: malinha_id,
      customer_email: malinha.client_email || undefined,
      metadata: {
        malinha_id: malinha_id,
        client_name: malinha.client_name,
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
