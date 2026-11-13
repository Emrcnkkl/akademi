import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://akademi-swart-iota.vercel.app",
  build: { format: "file" },          // /koclar → koclar.html (Vercel cleanUrls ile /koclar olarak açılır)
  prefetch: { prefetchAll: true, defaultStrategy: "viewport" }, // ekrandaki tüm linklerin sayfaları önceden indirilir → geçiş anında
});
