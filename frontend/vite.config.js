import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    const isAbsoluteHttpUrl = /^https?:\/\//i.test(apiBaseUrl);
    if (
      !isAbsoluteHttpUrl
      && (
        !apiBaseUrl.startsWith("/")
        || apiBaseUrl.startsWith("//")
        || apiBaseUrl.includes("?")
        || apiBaseUrl.includes("#")
      )
    ) {
      throw new Error("VITE_API_BASE_URL must be an absolute URL or root-relative path.");
    }
    if (
      isAbsoluteHttpUrl
      && command === "build"
      && /^http:\/\//i.test(apiBaseUrl)
    ) {
      throw new Error("VITE_API_BASE_URL must use HTTPS in production builds.");
    }
    if (isAbsoluteHttpUrl) {
      let parsedApiBaseUrl;
      try {
        parsedApiBaseUrl = new URL(apiBaseUrl);
      } catch {
        throw new Error("VITE_API_BASE_URL must be a valid absolute HTTP(S) URL.");
      }
      if (
        parsedApiBaseUrl.username
        || parsedApiBaseUrl.password
        || parsedApiBaseUrl.search
        || parsedApiBaseUrl.hash
      ) {
        throw new Error("VITE_API_BASE_URL must not contain credentials, query, or fragment.");
      }
    }
  }

  return {
    plugins: [react()],
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
