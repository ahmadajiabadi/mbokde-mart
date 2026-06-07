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
    const apiKey = Deno.env.get("BITESHIP_API_KEY") || "";
    const body = await req.json();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // 1. ACTION: RESOLVE GOOGLE MAPS LINK
    if (action === "resolve") {
      const gmapsUrl = body.url;
      const resolveRes = await fetch(gmapsUrl, { method: "HEAD", redirect: "follow" });
      const resolvedUrl = resolveRes.url;
      
      let lat = null, lng = null;
      const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const match = resolvedUrl.match(regex);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }
      return new Response(JSON.stringify({ success: !!lat, latitude: lat, longitude: lng, resolvedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. ACTION: GET SHIPPING RATES FROM BITESHIP API
    const response = await fetch("https://api.biteship.com/v1/rates/couriers", {
      method: "POST",
      headers: {
        "Authorization": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})
