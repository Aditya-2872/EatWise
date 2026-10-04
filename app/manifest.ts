import type { MetadataRoute } from "next";

/**
 * Web App Manifest (spec §23) — served at /manifest.webmanifest.
 * Required for installability: icons, theme color, display mode, start URL.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EatWise — AI Nutrition Intelligence",
    short_name: "EatWise",
    description:
      "Log food by photo, barcode or search. EatWise understands what you ate, tracks your nutrition, and recommends your next meal.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#065f46",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
