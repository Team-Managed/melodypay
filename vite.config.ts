import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    cors: true,
    hmr: {
      host: "engaged-griffon-crucial.ngrok-free.app",
      protocol: "wss",
      clientPort: 443,
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
    cors: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "MelodyPay",
        short_name: "MelodyPay",
        description: "Sound-based Monad transactions",
        theme_color: "#7c3aed",
        background_color: "#0f0f0f",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,json,png,ico}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\./,
            handler: "CacheFirst",
          },
        ],
      },
    }),
  ],
});
