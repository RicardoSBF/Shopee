import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";

// Import security and performance utilities
import { initSecurityMonitoring } from "./lib/securityUtils";
import { initCsrfProtection } from "./lib/csrfProtection";
import { initSecurityHeaders } from "./lib/securityHeaders";
import { initPerformanceMonitoring } from "./lib/performanceOptimization";

import { TempoDevtools } from "tempo-devtools";
TempoDevtools.init();

// Initialize security and performance monitoring
initSecurityHeaders();
initSecurityMonitoring();
initCsrfProtection();
initPerformanceMonitoring();

// Add global error boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Application error:", error, errorInfo);
    // In production, you would send this to your error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Algo deu errado
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Ocorreu um erro inesperado. Por favor, tente novamente.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const basename = import.meta.env.BASE_URL;

// Create a lazy-loaded app wrapper to improve initial load performance
const LazyApp = React.lazy(() => import("./App.tsx"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <BrowserRouter basename={basename}>
          <React.Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
              </div>
            }
          >
            <LazyApp className="relative" />
          </React.Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
