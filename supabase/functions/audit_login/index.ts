// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/manual/examples/supabase-functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseAdmin = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get("SUPABASE_URL") ?? "",
      // Supabase API SERVICE ROLE KEY - env var exported by default.
      // WARNING: SERVICE ROLE KEY has admin privileges and should only be used in secure server environments!
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get request data
    const { userId, eventType, details } = await req.json();

    if (!eventType) {
      throw new Error("Event type is required");
    }

    // Log the security event
    const { data, error } = await supabaseAdmin.rpc("log_security_event", {
      p_user_id: userId,
      p_event_type: eventType,
      p_details: details || {},
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 400,
    });
  }
});
