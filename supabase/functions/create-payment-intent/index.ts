// @ts-nocheck
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const { email, name } = bodyText ? JSON.parse(bodyText) : { email: "", name: "" };

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY não foi configurada nos Secrets da Edge Function");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1. Cria um Customer
    const customer = await stripe.customers.create({
      email: email || undefined,
      name: name || undefined,
    });

    // 2. Cria uma Assinatura (Subscription) recorrente de R$ 29,90
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Assinatura BagSync Mensal' },
          unit_amount: 2990, // R$ 29,90
          recurring: { interval: 'month' }
        }
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    return new Response(
      JSON.stringify({ clientSecret: subscription.latest_invoice.payment_intent.client_secret }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
