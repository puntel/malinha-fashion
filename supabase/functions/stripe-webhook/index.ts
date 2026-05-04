// @ts-nocheck
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY não configurada.");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BagSync <pagamentos@resend.dev>",
        to,
        subject,
        html,
      }),
    });
    
    if (!res.ok) {
      console.error("Erro no Resend:", await res.text());
    }
  } catch (error) {
    console.error("Erro ao tentar enviar email via Resend:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("Stripe-Signature");
    
    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      throw new Error("Missing stripe signature or webhook secret");
    }

    const bodyText = await req.text();
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        bodyText,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`⚠️  Webhook signature verification failed.`, err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Processar os eventos do Stripe
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const malinha_id = session.metadata?.malinha_id || session.client_reference_id;
        
        if (malinha_id) {
          console.log(`Finalizando malinha ${malinha_id} via Webhook`);
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          
          if (supabaseUrl && serviceRoleKey) {
            const adminClient = createClient(supabaseUrl, serviceRoleKey);
            
            // Buscar detalhes da malinha
            const { data: malinha } = await adminClient
              .from('malinhas')
              .select('*, malinha_products(*)')
              .eq('id', malinha_id)
              .single();
              
            if (malinha && malinha.status !== 'Finalizada') {
              const soldProducts = malinha.malinha_products.filter(p => p.status === 'accepted' || p.status === 'edited');
              
              // Pegar loja_id
              let lojaId = null;
              if (malinha.vendedora_id) {
                const { data: vendedora } = await adminClient
                  .from('vendedoras')
                  .select('loja_id')
                  .eq('user_id', malinha.vendedora_id)
                  .maybeSingle();
                if (vendedora) lojaId = vendedora.loja_id;
              }
              
              // Inserir Vendas
              if (soldProducts.length > 0) {
                const salesPayload = soldProducts.map(p => ({
                  product_name: p.code,
                  internal_code: p.code,
                  quantity: p.quantity,
                  value: Number(p.price) * p.quantity,
                  discount: 0,
                  payment_method: 'Stripe',
                  category: 'Consignado',
                  vendedora_id: malinha.vendedora_id,
                  loja_id: lojaId,
                  cliente_id: null,
                  malinha_id: malinha.id,
                }));
                
                await adminClient.from('sales').insert(salesPayload);
              }
              
              // Atualizar status para Finalizada
              await adminClient.from('malinhas').update({ status: 'Finalizada' }).eq('id', malinha.id);
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const email = paymentIntent.receipt_email;
        const amount = (paymentIntent.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        if (email) {
          await sendEmail(
            email,
            "Pagamento Aprovado - BagSync",
            `
              <h1>Pagamento Aprovado!</h1>
              <p>Recebemos o seu pagamento no valor de <strong>${amount}</strong>.</p>
              <p>Sua assinatura foi processada com sucesso e a sua conta já está ativa.</p>
              <br/>
              <p>Abraços,<br/>Equipe BagSync</p>
            `
          );
        }
        break;
      }
      
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const email = paymentIntent.receipt_email;
        const errorMsg = paymentIntent.last_payment_error?.message || "Erro desconhecido";
        
        if (email) {
          await sendEmail(
            email,
            "Aviso: Problema com seu Pagamento - BagSync",
            `
              <h1>Pagamento Recusado</h1>
              <p>Houve um problema ao processar o seu cartão de crédito.</p>
              <p><strong>Motivo:</strong> ${errorMsg}</p>
              <p>Por favor, acesse o sistema novamente e tente atualizar sua forma de pagamento ou usar um cartão diferente.</p>
              <br/>
              <p>Abraços,<br/>Equipe BagSync</p>
            `
          );
        }
        break;
      }

      default:
        console.log(`Evento não tratado: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
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
