import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Vite config for Abide.
// The PWA plugin is what makes "Add to Home Screen" on iPhone/iPad behave
// like a real installed app (own icon, no Safari chrome, offline shell).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Abide",
        short_name: "Abide",
        description: "Tasks, goals, calendar, journal, and scratchbook in one calm place.",
        theme_color: "#0B0F19",
        background_color: "#0B0F19",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
