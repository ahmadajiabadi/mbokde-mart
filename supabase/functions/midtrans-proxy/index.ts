import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const isProd = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
    const serverKey = isProd 
      ? Deno.env.get("MIDTRANS_SERVER_KEY_PROD") || "" 
      : Deno.env.get("MIDTRANS_SERVER_KEY_SANDBOX") || "";

    const body = await req.json();

    const url = isProd 
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authString = btoa(serverKey + ":");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: body.order_id,
          gross_amount: body.gross_amount
        },
        credit_card: { secure: true },
        customer_details: {
          first_name: body.first_name,
          phone: body.phone
        },
        enabled_payments: body.enabled_payments
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})
