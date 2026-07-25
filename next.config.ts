import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 defaults to `{ pathname: '**', search: '' }`, which rejects
    // cache-busted local URLs like `/images/catalog/foo.jpg?v=w2`.
    // Omit `search` on catalog/uploads so any `?v=` (or similar) is allowed.
    localPatterns: [
      { pathname: "/images/**" },
      { pathname: "/uploads/**" },
      { pathname: "/**", search: "" },
    ],
  },
};

export default nextConfig;
