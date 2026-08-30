/* 计划 Plan - Service Worker：HTML 网络优先（保证更新可达），静态资源缓存优先 */
var CACHE = "planapp-v7";
var ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

/* 关屏推送：收到推送即弹系统通知 */
self.addEventListener("push", function (e) {
  var data = {};
  try { data = e.data.json(); } catch (err) {
    try { data = { t: "计划提醒", b: (e.data && e.data.text()) || "" }; } catch (e2) {}
  }
  e.waitUntil(self.registration.showNotification(data.t || "计划提醒", {
    body: data.b || "",
    tag: data.tag || "plan-reminder",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: "./" }
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.registration.scope) === 0) return list[i].focus();
      }
      return self.clients.openWindow("./");
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  // 页面导航：网络优先，离线时回退缓存
  if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
          return res;
        })
        .catch(function () { return caches.match("./index.html"); })
    );
    return;
  }

  // 静态资源：缓存优先
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
