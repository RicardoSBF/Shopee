import {
  SecureStorage,
  generateCsrfToken,
  validateCsrfToken,
} from "./securityUtils";

/**
 * CSRF Protection middleware for API requests
 * This helps prevent Cross-Site Request Forgery attacks
 */

// Initialize CSRF protection
export const initCsrfProtection = async (): Promise<void> => {
  // Generate initial CSRF token
  const token = await generateCsrfToken();

  // Add CSRF token to all fetch requests
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Only add CSRF token to same-origin requests that modify state
    if (typeof input === "string" && input.startsWith(window.location.origin)) {
      const method = init?.method?.toUpperCase() || "GET";
      if (method !== "GET" && method !== "HEAD") {
        // Get the current token
        const csrfData = await SecureStorage.getItem<{ token: string }>(
          "csrf_token",
        );
        const csrfToken = csrfData?.token || token;

        // Add CSRF token to headers
        init = init || {};
        init.headers = {
          ...init.headers,
          "X-CSRF-Token": csrfToken,
        };
      }
    }

    return originalFetch(input, init);
  };
};

// Validate CSRF token in requests
export const validateCsrfRequest = async (
  request: Request,
): Promise<boolean> => {
  // Skip validation for safe methods
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return true;
  }

  // Get token from request header
  const csrfToken = request.headers.get("X-CSRF-Token");
  if (!csrfToken) {
    console.error("CSRF token missing from request");
    return false;
  }

  // Validate the token
  return await validateCsrfToken(csrfToken);
};

// Add CSRF token to forms
export const addCsrfToForm = async (form: HTMLFormElement): Promise<void> => {
  // Get current token
  const csrfData = await SecureStorage.getItem<{ token: string }>("csrf_token");
  if (!csrfData?.token) {
    await generateCsrfToken();
    const newData = await SecureStorage.getItem<{ token: string }>(
      "csrf_token",
    );
    if (!newData?.token) {
      console.error("Failed to generate CSRF token for form");
      return;
    }

    // Add hidden input with CSRF token
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "csrf_token";
    input.value = newData.token;
    form.appendChild(input);
  } else {
    // Add hidden input with CSRF token
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "csrf_token";
    input.value = csrfData.token;
    form.appendChild(input);
  }
};
