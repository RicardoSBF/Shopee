// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Get route data from request
    const routeData = await req.json();

    // Get Supabase credentials from request headers
    const supabaseUrl = req.headers.get("x-supabase-url");
    const supabaseKey = req.headers.get("x-supabase-anon-key");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not found in request headers");
      return new Response(
        JSON.stringify({
          success: true,
          useLocalStorage: true,
          data: routeData,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert route data
    const { data, error } = await supabase
      .from("routes")
      .insert([routeData])
      .select();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in import_routes function:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        useLocalStorage: true,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
