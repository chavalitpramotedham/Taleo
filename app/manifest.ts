import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taleo: picture books you make together",
    short_name: "Taleo",
    description: "By parents, for parents: watercolour picture books you make with your little one.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ecdc",
    theme_color: "#f3ecdc",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
