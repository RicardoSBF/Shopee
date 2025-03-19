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
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get("SUPABASE_URL") ?? "",
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      // Create client with Auth context of the user that called the function.
      // This way your row-level-security (RLS) policies are applied.
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get the user's ID from the auth token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 401,
      });
    }

    // Validate request data
    const { action, data } = await req.json();

    if (!action) {
      throw new Error("Action is required");
    }

    let result;

    // Perform different actions based on the request
    switch (action) {
      case "get_sensitive_data":
        // Example of retrieving sensitive data with additional checks
        const { table, id } = data;

        // Validate inputs to prevent SQL injection
        if (
          !table ||
          ![
            "users",
            "driver_verification",
            "availability",
            "route_assignments",
          ].includes(table)
        ) {
          throw new Error("Invalid table specified");
        }

        if (!id || typeof id !== "string") {
          throw new Error("Invalid ID format");
        }

        // Get data with service role to bypass RLS for admin functions
        result = await supabaseClient
          .from(table)
          .select("*")
          .eq("id", id)
          .single();

        // Additional security check - only return if it's the user's own data or they're an admin
        const { data: userData } = await supabaseClient
          .from("users")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        const isAdmin = userData?.is_admin || false;
        const isOwnData =
          result.data?.user_id === user.id ||
          result.data?.id === user.id ||
          result.data?.driver_id === user.id;

        if (!isAdmin && !isOwnData) {
          throw new Error("Unauthorized access to data");
        }

        break;

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify({ data: result.data }), {
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
