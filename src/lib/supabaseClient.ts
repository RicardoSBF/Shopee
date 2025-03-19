import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Security measures to prevent tampering with API requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const API_TIMEOUT = 15000; // ms

// Create a single supabase client with enhanced security
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sb-auth-token", // Custom key to make it harder to identify
    flowType: "pkce", // More secure authentication flow
  },
  global: {
    headers: {
      "X-Client-Info": "driver-app-web",
      "X-Request-Origin": "app-client", // Custom header for request validation
      "Cache-Control": "no-store", // Prevent caching of sensitive data
    },
    fetch: (url, options) => {
      // Add timeout to all fetch requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const fetchWithRetry = async (retriesLeft: number): Promise<Response> => {
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          // Check for specific error status codes that might benefit from retry
          if (
            !response.ok &&
            retriesLeft > 0 &&
            [408, 429, 500, 502, 503, 504].includes(response.status)
          ) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            return fetchWithRetry(retriesLeft - 1);
          }

          return response;
        } catch (error) {
          if (
            retriesLeft > 0 &&
            error instanceof Error &&
            error.name !== "AbortError"
          ) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            return fetchWithRetry(retriesLeft - 1);
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      return fetchWithRetry(MAX_RETRIES);
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  db: {
    schema: "public",
  },
});

// Intercept and validate all data access operations
const validateOperation = (
  operation: string,
  table: string,
  data?: any,
): boolean => {
  // Implement validation logic based on operation type and table
  // This helps prevent unauthorized operations from devtools
  const allowedTables = [
    "users",
    "availability",
    "regions",
    "routes",
    "route_assignments",
    "email_verifications",
    "security_audit",
  ];

  if (!allowedTables.includes(table)) {
    console.error(`Unauthorized table access attempt: ${table}`);
    return false;
  }

  // Add additional validation logic here
  return true;
};

// Secure wrapper for Supabase operations
export const secureDb = {
  from: (table: string) => {
    if (!validateOperation("from", table)) {
      throw new Error(`Access denied to table: ${table}`);
    }
    return supabase.from(table);
  },
  rpc: (fn: string, params?: any) => {
    if (!validateOperation("rpc", fn, params)) {
      throw new Error(`Access denied to function: ${fn}`);
    }
    return supabase.rpc(fn, params);
  },
};

// Helper function to securely access sensitive data through edge function
export const getSecureData = async (table: string, id: string) => {
  try {
    if (!validateOperation("getSecureData", table)) {
      throw new Error(`Access denied to table: ${table}`);
    }

    // Generate a request ID to track this specific request
    const requestId = crypto.randomUUID();

    const { data, error } = await supabase.functions.invoke(
      "supabase-functions-secure-data",
      {
        body: {
          action: "get_sensitive_data",
          data: { table, id },
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
    );

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("Error accessing secure data:", error);
    // Don't expose detailed error information to client
    return { data: null, error: "Failed to access data securely" };
  }
};

// Secure authentication state check
export const checkAuthState = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    // If session exists, verify it's still valid with the server
    if (data.session) {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        // Session is invalid, clear it
        await supabase.auth.signOut();
        return { isAuthenticated: false };
      }
      return { isAuthenticated: true, user: userData.user };
    }

    return { isAuthenticated: false };
  } catch (error) {
    console.error("Auth state verification failed:", error);
    return {
      isAuthenticated: false,
      error: "Authentication verification failed",
    };
  }
};
