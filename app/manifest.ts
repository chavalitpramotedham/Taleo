import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taleo: picture books you make together",
    short_name: "Taleo",
    description: "By parents, for parents: watercolour picture books you make with your little one.",
    id: "/",
    // Straight to the bookshelf (a signed-out visitor is sent on to the
    // welcome page): one hop fewer on every launch from the icon.
    start_url: "/home",
    scope: "/",
    lang: "en",
    dir: "ltr",
    categories: ["education", "kids", "books", "entertainment"],
    display: "standalone",
    background_color: "#f3ecdc",
    theme_color: "#f3ecdc",
    icons: [
      { src: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Press and hold the icon: straight to a new story, or the library.
    shortcuts: [
      { name: "Begin a story", short_name: "New story", url: "/create", icons: [{ src: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" }] },
      { name: "Library", url: "/store", icons: [{ src: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
