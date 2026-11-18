// 온라인이면 항상 최신 파일을 받고, 오프라인이면 저장해둔 파일을 씁니다.
// 파일을 추가하면 FILES 목록에도 넣어주세요.
const CACHE = 'jlpt-v3';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'data/n5.js', 'data/n4.js', 'data/n3.js', 'data/n2.js', 'data/n1.js', 'data/ex_n5.js', 'data/ex_n4.js', 'data/ex_n3.js', 'data/ex_n2.js', 'data/ex_n1.js', 'data/t600.js', 'data/t700.js', 'data/t800.js', 'data/t900.js', 'data/ex_t600.js', 'data/ex_t700.js', 'data/ex_t800.js', 'data/ex_t900.js', 'manifest.json', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // no-cache: 브라우저 HTTP 캐시를 거치지 않고 서버에 최신 파일인지 확인
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
