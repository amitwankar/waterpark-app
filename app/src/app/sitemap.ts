import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aquaworld.com";
  const now = new Date();

  return [
    "",
    "/about",
    "/rides",
    "/packages",
    "/offers",
    "/gallery",
    "/contact",
    "/inquiry",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));
}
