self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = {
        data: {
          body: event.data ? event.data.text() : "",
        },
      };
    } catch {
      payload = {};
    }
  }

  const data = payload.data || {};
  const notification = payload.notification || {};

  const title =
    notification.title ||
    data.title ||
    "Abide";

  const body =
    notification.body ||
    data.body ||
    "You have an Abide reminder.";

  const url =
    data.url ||
    notification.click_action ||
    "/";

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      ...data,
      url,
    },
    tag:
      data.tag ||
      payload.messageId ||
      undefined,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            if ("navigate" in client) {
              client.navigate(targetUrl).catch(() => {});
            }
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
  );
});
