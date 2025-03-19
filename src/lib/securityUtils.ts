import { supabase, secureDb } from "./supabaseClient";

/**
 * Enhanced security utility functions for the application
 * Designed to prevent browser devtools manipulation and support high user load
 */

// Security constants
const TOKEN_EXPIRY = 3600 * 1000; // 1 hour in milliseconds
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Track failed authentication attempts
const failedAttempts: Record<string, { count: number; lastAttempt: number }> =
  {};

// Secure storage with encryption for client-side data
export class SecureStorage {
  private static readonly PREFIX = "app_secure_";

  // Use SubtleCrypto API for encryption/decryption
  private static async encrypt(data: string): Promise<string> {
    try {
      // In a production app, you would use a proper key management system
      // This is a simplified example using a derived key from a constant
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(window.location.host + navigator.userAgent),
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await crypto.subtle.importKey(
        "raw",
        keyMaterial,
        { name: "AES-GCM" },
        false,
        ["encrypt"],
      );

      const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(data),
      );

      // Combine IV and encrypted data for storage
      const result = new Uint8Array(iv.length + encryptedData.byteLength);
      result.set(iv, 0);
      result.set(new Uint8Array(encryptedData), iv.length);

      return btoa(String.fromCharCode(...new Uint8Array(result)));
    } catch (error) {
      console.error("Encryption error:", error);
      // Fallback to base64 encoding if encryption fails
      return btoa(data);
    }
  }

  private static async decrypt(encryptedData: string): Promise<string> {
    try {
      const binaryData = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0),
      );

      // Extract IV and encrypted content
      const iv = binaryData.slice(0, 12);
      const data = binaryData.slice(12);

      const keyMaterial = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(window.location.host + navigator.userAgent),
      );

      const key = await crypto.subtle.importKey(
        "raw",
        keyMaterial,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data,
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error("Decryption error:", error);
      // Attempt to decode as base64 if decryption fails
      try {
        return atob(encryptedData);
      } catch {
        return ""; // Return empty string if all fails
      }
    }
  }

  static async setItem(key: string, value: any): Promise<void> {
    try {
      const encryptedValue = await this.encrypt(JSON.stringify(value));
      localStorage.setItem(this.PREFIX + key, encryptedValue);
    } catch (error) {
      console.error(`Error storing secure data for key ${key}:`, error);
    }
  }

  static async getItem<T>(
    key: string,
    defaultValue: T = null as unknown as T,
  ): Promise<T> {
    try {
      const encryptedValue = localStorage.getItem(this.PREFIX + key);
      if (!encryptedValue) return defaultValue;

      const decryptedValue = await this.decrypt(encryptedValue);
      return JSON.parse(decryptedValue) as T;
    } catch (error) {
      console.error(`Error retrieving secure data for key ${key}:`, error);
      return defaultValue;
    }
  }

  static removeItem(key: string): void {
    localStorage.removeItem(this.PREFIX + key);
  }

  static clear(): void {
    // Only clear items with our prefix
    Object.keys(localStorage)
      .filter((key) => key.startsWith(this.PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  }
}

// Enhanced input sanitization with additional protections
export const sanitizeInput = (input: string): string => {
  if (!input) return "";

  // Basic XSS protection
  let sanitized = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");

  // Additional protections against script injection
  sanitized = sanitized
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .replace(/data:/gi, "")
    .replace(/vbscript:/gi, "");

  return sanitized;
};

// Enhanced session validation with additional security checks
export const validateSession = async () => {
  try {
    // Check for session tampering
    const storedSessionTime = await SecureStorage.getItem<number>(
      "session_established",
      0,
    );
    const currentTime = Date.now();

    // If session is too old, force re-authentication
    if (storedSessionTime && currentTime - storedSessionTime > TOKEN_EXPIRY) {
      await supabase.auth.signOut();
      SecureStorage.clear();
      return { user: null, error: "Session expired" };
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session) return { user: null, error: "No active session" };

    // Verify session with server to prevent session forgery
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      await supabase.auth.signOut();
      SecureStorage.clear();
      return { user: null, error: "Invalid session" };
    }

    // Update session timestamp
    await SecureStorage.setItem("session_established", currentTime);

    // Log session validation for audit
    await logSecurityEvent(session.user.id, "session_validated", {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });

    return { user: session.user, error: null };
  } catch (error) {
    console.error("Session validation error:", error);
    // Clear potentially corrupted session data
    await supabase.auth.signOut();
    SecureStorage.clear();
    return { user: null, error: "Session validation failed" };
  }
};

// Enhanced admin status check with caching for performance
export const checkAdminStatus = async (userId: string) => {
  try {
    if (!userId) return { isAdmin: false, error: "No user ID provided" };

    // Check cached admin status first (with short TTL for security)
    const cachedStatus = await SecureStorage.getItem<{
      isAdmin: boolean;
      timestamp: number;
    }>(`admin_status_${userId}`);
    const currentTime = Date.now();

    if (cachedStatus && currentTime - cachedStatus.timestamp < 5 * 60 * 1000) {
      // 5 minute cache
      return { isAdmin: cachedStatus.isAdmin, error: null };
    }

    // Use secure database access
    const { data, error } = await secureDb
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (error) throw error;

    const isAdmin = data?.is_admin || false;

    // Cache the result
    await SecureStorage.setItem(`admin_status_${userId}`, {
      isAdmin,
      timestamp: currentTime,
    });

    return { isAdmin, error: null };
  } catch (error) {
    console.error("Admin check error:", error);
    return { isAdmin: false, error: "Failed to verify admin status" };
  }
};

// Enhanced security event logging with server-side audit
export const logSecurityEvent = async (
  userId: string,
  eventType: string,
  details: any,
) => {
  try {
    // Don't log sensitive information
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.accessToken;
    delete sanitizedDetails.refreshToken;

    // Add contextual information
    sanitizedDetails.userAgent = navigator.userAgent;
    sanitizedDetails.timestamp = new Date().toISOString();
    sanitizedDetails.clientTimestamp = Date.now();

    // Generate a unique event ID
    const eventId = crypto.randomUUID();

    // Log locally for debugging
    console.log(`Security event [${eventId}]: ${eventType}`, {
      userId,
      ...sanitizedDetails,
    });

    // Send to server-side audit log via edge function
    await supabase.functions
      .invoke("supabase-functions-audit-login", {
        body: {
          userId,
          eventType,
          details: sanitizedDetails,
          eventId,
        },
      })
      .catch((err) => {
        // Fallback to local storage if server logging fails
        const securityLogs = JSON.parse(
          localStorage.getItem("security_audit_logs") || "[]",
        );
        securityLogs.push({
          eventId,
          userId,
          eventType,
          details: sanitizedDetails,
          timestamp: new Date().toISOString(),
          pending: true,
        });
        // Keep only the last 100 logs to prevent storage overflow
        if (securityLogs.length > 100) securityLogs.shift();
        localStorage.setItem(
          "security_audit_logs",
          JSON.stringify(securityLogs),
        );
      });
  } catch (error) {
    console.error("Error logging security event:", error);
  }
};

// Enhanced data validation with schema validation
export const validateApiData = (data: any, schema: any) => {
  try {
    // Basic validation
    if (!data) return { isValid: false, error: "No data provided" };

    // Check required fields from schema
    for (const field of schema.required || []) {
      if (data[field] === undefined || data[field] === null) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }

    // Type validation
    if (schema.properties) {
      for (const [field, propSchema] of Object.entries(schema.properties)) {
        if (data[field] !== undefined && data[field] !== null) {
          // @ts-ignore - dynamic property access
          const type = propSchema.type;
          if (type && typeof data[field] !== type) {
            return {
              isValid: false,
              error: `Field ${field} should be of type ${type}, got ${typeof data[field]}`,
            };
          }

          // @ts-ignore - dynamic property access
          const pattern = propSchema.pattern;
          if (pattern && typeof data[field] === "string") {
            const regex = new RegExp(pattern);
            if (!regex.test(data[field])) {
              return {
                isValid: false,
                error: `Field ${field} does not match required pattern`,
              };
            }
          }
        }
      }
    }

    return { isValid: true, error: null };
  } catch (error) {
    console.error("Data validation error:", error);
    return { isValid: false, error: "Validation failed" };
  }
};

// Rate limiting for authentication attempts
export const checkRateLimit = (identifier: string): boolean => {
  const currentTime = Date.now();

  // Clean up old entries
  Object.keys(failedAttempts).forEach((key) => {
    if (currentTime - failedAttempts[key].lastAttempt > LOCKOUT_DURATION) {
      delete failedAttempts[key];
    }
  });

  // Check if the identifier is currently locked out
  if (failedAttempts[identifier]) {
    const { count, lastAttempt } = failedAttempts[identifier];

    if (count >= MAX_FAILED_ATTEMPTS) {
      const timeElapsed = currentTime - lastAttempt;
      if (timeElapsed < LOCKOUT_DURATION) {
        // Still in lockout period
        return false;
      }
      // Lockout period expired, reset counter
      delete failedAttempts[identifier];
    }
  }

  return true;
};

// Record a failed authentication attempt
export const recordFailedAttempt = (identifier: string): void => {
  const currentTime = Date.now();

  if (!failedAttempts[identifier]) {
    failedAttempts[identifier] = { count: 1, lastAttempt: currentTime };
  } else {
    failedAttempts[identifier].count += 1;
    failedAttempts[identifier].lastAttempt = currentTime;
  }

  // Log the failed attempt
  logSecurityEvent("unknown", "failed_authentication_attempt", {
    identifier: identifier.substring(0, 3) + "***", // Mask most of the identifier
    attemptCount: failedAttempts[identifier].count,
    timestamp: new Date(currentTime).toISOString(),
  });
};

// Reset failed attempts counter after successful authentication
export const resetFailedAttempts = (identifier: string): void => {
  delete failedAttempts[identifier];
};

// Generate a secure CSRF token
export const generateCsrfToken = async (): Promise<string> => {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await SecureStorage.setItem("csrf_token", {
    token,
    timestamp: Date.now(),
  });
  return token;
};

// Validate a CSRF token
export const validateCsrfToken = async (token: string): Promise<boolean> => {
  const storedData = await SecureStorage.getItem<{
    token: string;
    timestamp: number;
  }>("csrf_token");
  if (!storedData || !storedData.token) return false;

  // Check if token matches and is not expired (10 minute validity)
  const isValid =
    storedData.token === token &&
    Date.now() - storedData.timestamp < 10 * 60 * 1000;

  // Generate a new token after validation for added security
  if (isValid) {
    await generateCsrfToken();
  }

  return isValid;
};

// Detect potential tampering with the application
export const detectTampering = (): boolean => {
  try {
    // Check for devtools
    const devtoolsOpen =
      window.outerWidth - window.innerWidth > 160 ||
      window.outerHeight - window.innerHeight > 160;

    // Check if running in an iframe
    const inIframe = window !== window.top;

    // Check for browser extensions that might be tampering
    const hasExtensions =
      !!document.documentElement.getAttribute("data-extension");

    if (devtoolsOpen || inIframe || hasExtensions) {
      logSecurityEvent("unknown", "potential_tampering_detected", {
        devtoolsOpen,
        inIframe,
        hasExtensions,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in tampering detection:", error);
    return false;
  }
};

// Initialize security monitoring
export const initSecurityMonitoring = (): void => {
  // Check for tampering periodically
  setInterval(() => {
    detectTampering();
  }, 5000);

  // Sync pending security logs
  const syncPendingLogs = async () => {
    try {
      const pendingLogs = JSON.parse(
        localStorage.getItem("security_audit_logs") || "[]",
      );
      if (pendingLogs.length === 0) return;

      // Try to send pending logs
      for (const log of pendingLogs) {
        await supabase.functions.invoke("supabase-functions-audit-login", {
          body: {
            userId: log.userId,
            eventType: log.eventType,
            details: log.details,
            eventId: log.eventId,
          },
        });
      }

      // Clear pending logs if successful
      localStorage.removeItem("security_audit_logs");
    } catch (error) {
      console.error("Failed to sync pending security logs:", error);
    }
  };

  // Try to sync logs on startup and periodically
  syncPendingLogs();
  setInterval(syncPendingLogs, 5 * 60 * 1000); // Every 5 minutes
};
