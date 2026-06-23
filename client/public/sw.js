// Service Worker Cache Version. Kesh versiyasini yangilash uchun ushbu konstantani o'zgartiring.
// Bu foydalanuvchilar brauzerida keshni tozalashni va yangi fayllarni yuklashni ta'minlaydi.
const CACHE_VERSION = "v3";
const CACHE_NAME = `maktab-jadval-${CACHE_VERSION}`;

// Install: skip waiting immediately to activate new SW right away
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate: wipe ALL old caches so fresh JS is always loaded
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Faqat http/https so'rovlarini qayta ishlash (chrome-extension va ws-larni chetlab o'tish)
  if (!url.protocol.startsWith("http")) return;

  // Faqat o'z originimizga bo'lgan so'rovlarni boshqarish (Vite HMR porti 24678 va boshqalarni chetlab o'tish)
  if (url.origin !== self.location.origin) return;

  // API requests: network-only
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ message: "Internet aloqasi yo'q" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Network-first (always get latest), fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Faqat GET so'rovlarini va muvaffaqiyatli javoblarni keshga saqlash
        if (
          event.request.method === "GET" && 
          res && res.status === 200 && 
          res.type === "basic" // Faqat o'z domenimizdagi fayllar uchun
        ) {
          const clone = res.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone))
            .catch((err) => console.warn("Cache put error:", err));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response("Keshda mavjud emas va internet aloqasi yo'q", {
          status: 504,
          statusText: "Gateway Timeout"
        });
      })
  );
});
