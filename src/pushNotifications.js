import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
} from "firebase/messaging";
import { app, auth, db } from "./firebase.js";

const DEVICE_ID_KEY = "abide-sync-device-id";
const LOCAL_PUSH_TOKEN_KEY = "abide-fcm-device-token-local";
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

function getDeviceId({ create = true } = {}) {
  let id = localStorage.getItem(DEVICE_ID_KEY);

  if (!id && create) {
    id = `device_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }

  return id || "";
}

export async function getBackgroundPushStatus() {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return {
      supported: false,
      permission: "unsupported",
      registered: false,
    };
  }

  const supported = await isSupported().catch(() => false);

  return {
    supported,
    permission: Notification.permission,
    registered: Boolean(
      localStorage.getItem(LOCAL_PUSH_TOKEN_KEY)
    ),
  };
}

export async function enableBackgroundPush() {
  if (!auth.currentUser) {
    throw new Error("Sign in to Abide before enabling notifications.");
  }

  if (!VAPID_KEY) {
    throw new Error(
      "This Abide build is missing its Web Push configuration."
    );
  }

  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    throw new Error(
      "Background notifications are not supported on this device."
    );
  }

  const supported = await isSupported();

  if (!supported) {
    throw new Error(
      "Firebase Web Push is not supported on this device."
    );
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for Abide in your device settings."
        : "Notification permission was not granted."
    );
  }

  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error(
      "Abide could not register this device for background notifications."
    );
  }

  const deviceId = getDeviceId();

  await setDoc(
    doc(
      db,
      "users",
      auth.currentUser.uid,
      "pushDevices",
      deviceId
    ),
    {
      token,
      deviceId,
      enabled: true,
      platform: navigator.platform || "",
      userAgent: navigator.userAgent || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  localStorage.setItem(LOCAL_PUSH_TOKEN_KEY, token);

  return {
    token,
    deviceId,
    permission: "granted",
  };
}

export async function disableBackgroundPush() {
  const user = auth.currentUser;
  const deviceId = getDeviceId({ create: false });

  if (user && deviceId) {
    await deleteDoc(
      doc(db, "users", user.uid, "pushDevices", deviceId)
    ).catch(() => {});
  }

  try {
    if (await isSupported()) {
      await deleteToken(getMessaging(app));
    }
  } catch {}

  localStorage.removeItem(LOCAL_PUSH_TOKEN_KEY);
}
