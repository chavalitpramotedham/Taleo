import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Noomi: picture books you make together",
    short_name: "Noomi",
    description: "By parents, for parents: watercolour picture books you make with your little one.",
    id: "/",
    start_url: "/",
    lang: "en",
    dir: "ltr",
    categories: ["education", "kids", "books", "entertainment"],
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
