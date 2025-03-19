/**
 * Security headers implementation for client-side
 *
 * Note: For a production application, these headers should be set server-side.
 * This client-side implementation provides a fallback for development and
 * environments where server configuration is limited.
 */

// Apply Content Security Policy
export const applyCSP = (): void => {
  // Create meta tag for CSP
  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";

  // Define CSP directives
  const cspDirectives = [
    // Default to self
    "default-src 'self'",
    // Scripts from self and specific CDNs
    "script-src 'self' https://api.tempolabs.ai https://storage.googleapis.com",
    // Styles from self and specific CDNs
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Images from self and specific sources
    "img-src 'self' data: https://images.unsplash.com https://api.dicebear.com https://*.googleusercontent.com",
    // Fonts from self and Google Fonts
    "font-src 'self' https://fonts.gstatic.com",
    // Connect to self and Supabase
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tempolabs.ai",
    // Frame sources
    "frame-src 'self' https://www.google.com https://maps.google.com",
    // Object sources
    "object-src 'none'",
    // Base URI restriction
    "base-uri 'self'",
    // Form targets
    "form-action 'self'",
    // Frame ancestors
    "frame-ancestors 'self'",
    // Upgrade insecure requests
    "upgrade-insecure-requests",
  ];

  meta.content = cspDirectives.join("; ");
  document.head.appendChild(meta);
};

// Apply additional security headers via meta tags
export const applySecurityHeaders = (): void => {
  // X-Content-Type-Options
  const xContentTypeOptions = document.createElement("meta");
  xContentTypeOptions.httpEquiv = "X-Content-Type-Options";
  xContentTypeOptions.content = "nosniff";
  document.head.appendChild(xContentTypeOptions);

  // X-Frame-Options
  const xFrameOptions = document.createElement("meta");
  xFrameOptions.httpEquiv = "X-Frame-Options";
  xFrameOptions.content = "DENY";
  document.head.appendChild(xFrameOptions);

  // X-XSS-Protection
  const xXssProtection = document.createElement("meta");
  xXssProtection.httpEquiv = "X-XSS-Protection";
  xXssProtection.content = "1; mode=block";
  document.head.appendChild(xXssProtection);

  // Referrer-Policy
  const referrerPolicy = document.createElement("meta");
  referrerPolicy.name = "referrer";
  referrerPolicy.content = "strict-origin-when-cross-origin";
  document.head.appendChild(referrerPolicy);

  // Permissions-Policy
  const permissionsPolicy = document.createElement("meta");
  permissionsPolicy.httpEquiv = "Permissions-Policy";
  permissionsPolicy.content =
    "camera=(), microphone=(), geolocation=(self), interest-cohort=()";
  document.head.appendChild(permissionsPolicy);
};

// Initialize all security headers
export const initSecurityHeaders = (): void => {
  // Only apply in browser environment
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    applyCSP();
    applySecurityHeaders();
  }
};
