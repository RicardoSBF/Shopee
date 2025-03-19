import path from "path";
import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { tempo } from "tempo-devtools/dist/vite";
import { visualizer } from "rollup-plugin-visualizer";

const conditionalPlugins: [string, Record<string, any>][] = [];

// @ts-ignore
if (process.env.TEMPO === "true") {
  conditionalPlugins.push(["tempo-devtools/swc", {}]);
}

// https://vitejs.dev/config/
export default defineConfig({
  base:
    process.env.NODE_ENV === "development"
      ? "/"
      : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"],
    // Optimize dependencies that change infrequently
    include: [
      "@supabase/supabase-js",
      "date-fns",
      "framer-motion",
      "react-router-dom",
      "lucide-react",
      "clsx",
      "tailwind-merge",
    ],
    // Force exclude problematic dependencies
    exclude: ["@swc/core"],
  },
  plugins: [
    react({
      plugins: conditionalPlugins,
    }),
    tempo(),
    // Split vendor chunks for better caching
    splitVendorChunkPlugin(),
    // Visualize bundle size in stats.html (only in build)
    process.env.ANALYZE === "true" &&
      visualizer({
        filename: "stats.html",
        gzipSize: true,
        brotliSize: true,
      }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize build for production
    target: "es2015",
    outDir: "dist",
    assetsDir: "assets",
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 1000,
    // Minify output
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        drop_debugger: true,
      },
    },
    // Generate sourcemaps for production (helps with error tracking)
    sourcemap: true,
    // Split chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Create separate chunks for major dependencies
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("react") || id.includes("react-dom"))
              return "vendor-react";
            if (id.includes("lucide")) return "vendor-lucide";
            if (id.includes("date-fns")) return "vendor-date-fns";
            if (id.includes("framer-motion")) return "vendor-framer";
            return "vendor"; // all other dependencies
          }
        },
      },
    },
  },
  server: {
    // @ts-ignore
    allowedHosts: true,
    // Optimize for development
    hmr: {
      overlay: true,
    },
    // Increase timeout for slow networks
    timeout: 120000,
    // Optimize watch options
    watch: {
      usePolling: false,
      interval: 1000,
    },
  },
  preview: {
    // Configure preview server
    port: 4173,
    strictPort: false,
    // Add security headers
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' https://api.tempolabs.ai https://storage.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://images.unsplash.com https://api.dicebear.com https://*.googleusercontent.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tempolabs.ai; frame-src 'self' https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests",
    },
  },
});
