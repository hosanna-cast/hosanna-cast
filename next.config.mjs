/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Bibles : générées au build, elles ne changent presque jamais → 1 jour en cache, puis rafraîchies en arrière-plan
        source: "/bible/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        // les fichiers de /public ne sont sinon pas mis en cache par le navigateur
        source: "/:logo(logo.png|logo-96.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }],
      },
    ];
  },
};
export default nextConfig;
