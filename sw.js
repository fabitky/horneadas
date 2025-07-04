const CACHE_NAME = "horneadas";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        ".",
        "index.html",
        "script.js",
        "style.css",
        "manifest.json",
        "icon-192.png",
        "logo.png"
      ])
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
