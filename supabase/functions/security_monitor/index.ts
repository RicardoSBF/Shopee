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
    const { action, data } = await req.json();

    if (!action) {
      throw new Error("Action is required");
    }

    let result;

    // Perform different security monitoring actions
    switch (action) {
      case "check_suspicious_activity":
        // Check for suspicious login patterns
        const { userId, ipAddress, userAgent } = data;

        if (!userId) {
          throw new Error("User ID is required");
        }

        // Get recent login history for this user
        const { data: loginHistory, error: loginError } = await supabaseAdmin
          .from("security_audit")
          .select("*")
          .eq("user_id", userId)
          .eq("event_type", "successful_login")
          .order("created_at", { ascending: false })
          .limit(10);

        if (loginError) throw loginError;

        // Check for suspicious patterns
        const suspiciousActivity = analyzeLoginPatterns(
          loginHistory,
          ipAddress,
          userAgent,
        );

        result = { suspiciousActivity };
        break;

      case "analyze_failed_logins":
        // Analyze failed login attempts for potential brute force attacks
        const { timeWindow } = data;
        const windowMinutes = timeWindow || 60; // Default to 60 minutes

        // Get recent failed login attempts
        const { data: failedLogins, error: failedError } = await supabaseAdmin
          .from("security_audit")
          .select("*")
          .eq("event_type", "failed_login_attempt")
          .gte(
            "created_at",
            new Date(Date.now() - windowMinutes * 60 * 1000).toISOString(),
          )
          .order("created_at", { ascending: false });

        if (failedError) throw failedError;

        // Analyze for potential attacks
        const attackAnalysis = analyzeFailedLogins(failedLogins);

        result = { attackAnalysis };
        break;

      case "check_account_status":
        // Check if an account is locked or has security issues
        const { userIdToCheck } = data;

        if (!userIdToCheck) {
          throw new Error("User ID is required");
        }

        // Get user data
        const { data: userData, error: userError } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", userIdToCheck)
          .single();

        if (userError) throw userError;

        // Get recent security events for this user
        const { data: securityEvents, error: eventsError } = await supabaseAdmin
          .from("security_audit")
          .select("*")
          .eq("user_id", userIdToCheck)
          .order("created_at", { ascending: false })
          .limit(20);

        if (eventsError) throw eventsError;

        // Determine account status
        const accountStatus = determineAccountStatus(userData, securityEvents);

        result = { accountStatus };
        break;

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
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

// Helper function to analyze login patterns for suspicious activity
function analyzeLoginPatterns(
  loginHistory: any[],
  currentIp: string,
  currentUserAgent: string,
) {
  if (!loginHistory || loginHistory.length === 0) {
    return { isSuspicious: false, reason: "No login history available" };
  }

  const suspiciousIndicators = [];

  // Check for logins from multiple countries in a short time
  const uniqueIps = new Set(
    loginHistory.map((login) => login.details?.ipAddress),
  );
  if (uniqueIps.size > 2 && loginHistory.length >= 3) {
    suspiciousIndicators.push("Multiple IP addresses used recently");
  }

  // Check for rapid location changes
  for (let i = 1; i < loginHistory.length; i++) {
    const currentLogin = loginHistory[i - 1];
    const previousLogin = loginHistory[i];

    const currentTime = new Date(currentLogin.created_at).getTime();
    const previousTime = new Date(previousLogin.created_at).getTime();

    // If logins are less than 1 hour apart but from different IPs
    if (
      currentTime - previousTime < 3600000 && // 1 hour in milliseconds
      currentLogin.details?.ipAddress !== previousLogin.details?.ipAddress
    ) {
      suspiciousIndicators.push("Rapid location change detected");
      break;
    }
  }

  // Check for unusual user agent changes
  const uniqueUserAgents = new Set(
    loginHistory.map((login) => login.details?.userAgent),
  );
  if (uniqueUserAgents.size > 3 && loginHistory.length >= 4) {
    suspiciousIndicators.push("Multiple user agents detected");
  }

  // Check for unusual login times
  const unusualTimes = loginHistory.filter((login) => {
    const loginHour = new Date(login.created_at).getHours();
    return loginHour >= 0 && loginHour <= 5; // Between midnight and 5 AM
  });

  if (unusualTimes.length > 2) {
    suspiciousIndicators.push("Unusual login times detected");
  }

  return {
    isSuspicious: suspiciousIndicators.length > 0,
    indicators: suspiciousIndicators,
    severity: suspiciousIndicators.length > 2 ? "high" : "medium",
  };
}

// Helper function to analyze failed logins for potential attacks
function analyzeFailedLogins(failedLogins: any[]) {
  if (!failedLogins || failedLogins.length === 0) {
    return {
      potentialAttack: false,
      reason: "No failed logins in the time window",
    };
  }

  // Group failed logins by IP address
  const ipCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  failedLogins.forEach((login) => {
    const ip = login.details?.ipAddress || "unknown";
    const user = login.details?.identifier || "unknown";

    ipCounts[ip] = (ipCounts[ip] || 0) + 1;
    userCounts[user] = (userCounts[user] || 0) + 1;
  });

  // Check for potential brute force attacks
  const suspiciousIps = Object.entries(ipCounts)
    .filter(([ip, count]) => count >= 5)
    .map(([ip, count]) => ({ ip, count }));

  const targetedUsers = Object.entries(userCounts)
    .filter(([user, count]) => count >= 3)
    .map(([user, count]) => ({ user, count }));

  return {
    potentialAttack: suspiciousIps.length > 0 || targetedUsers.length > 0,
    suspiciousIps,
    targetedUsers,
    severity: suspiciousIps.some((ip) => ip.count >= 10) ? "high" : "medium",
    totalFailedAttempts: failedLogins.length,
  };
}

// Helper function to determine account security status
function determineAccountStatus(userData: any, securityEvents: any[]) {
  if (!userData) {
    return { status: "unknown", reason: "User data not found" };
  }

  const issues = [];

  // Check for account lockout
  const isLocked = userData.is_locked || false;
  if (isLocked) {
    issues.push("Account is locked");
  }

  // Check for recent password resets
  const recentPasswordResets = securityEvents.filter(
    (event) =>
      event.event_type === "password_reset_successful" &&
      new Date(event.created_at).getTime() >
        Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days
  );

  if (recentPasswordResets.length > 0) {
    issues.push(
      `Recent password reset (${recentPasswordResets.length} in the last 7 days)`,
    );
  }

  // Check for failed login attempts
  const recentFailedLogins = securityEvents.filter(
    (event) =>
      event.event_type === "failed_login_attempt" &&
      new Date(event.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000, // 24 hours
  );

  if (recentFailedLogins.length >= 5) {
    issues.push(
      `High number of failed login attempts (${recentFailedLogins.length} in the last 24 hours)`,
    );
  }

  // Determine overall status
  let status = "secure";
  if (issues.length > 0) {
    status = issues.some((issue) => issue.includes("locked"))
      ? "locked"
      : "at_risk";
  }

  return {
    status,
    issues,
    lastLogin: securityEvents.find(
      (event) => event.event_type === "successful_login",
    )?.created_at,
    failedLoginCount24h: recentFailedLogins.length,
  };
}
