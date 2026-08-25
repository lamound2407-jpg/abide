import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase.js";

const DEVICE_ID_KEY = "abide-sync-device-id";
const SYNC_COLLECTION = "syncState";
const FRESH_ACCOUNT_KEY = "abide-fresh-account-creation";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function shouldSyncKey(key) {
  if (!key?.startsWith("abide-")) return false;
  if (key === DEVICE_ID_KEY) return false;
  if (key.includes("scratch")) return false;
  if (key.includes("notification-fired")) return false;
  if (key.includes("migration")) return false;
  return true;
}

function localSyncSnapshot() {
  const result = new Map();
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!shouldSyncKey(key)) continue;
    result.set(key, localStorage.getItem(key));
  }
  return result;
}

function clearSyncedLocalState() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (shouldSyncKey(key)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

function docIdForKey(key) {
  return encodeURIComponent(key);
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "That email/password combination did not work.";
  if (code === "auth/email-already-in-use") return "An Abide account already exists with that email. Choose Sign In instead.";
  if (code === "auth/weak-password") return "Use a password with at least 6 characters.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/operation-not-allowed") return "Email/Password sign-in is not enabled in Firebase yet.";
  if (code === "auth/network-request-failed") return "Abide could not reach Firebase. Check your internet connection.";
  return error?.message || "Abide could not sign in.";
}

function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const firebaseConfigured = Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!firebaseConfigured) {
      setError("Firebase environment values are missing from this build.");
      return;
    }
    if (!email.trim() || !password || busy) return;

    setBusy(true);
    setError("");
    try {
      if (mode === "create") {
        sessionStorage.setItem(FRESH_ACCOUNT_KEY, "1");

        try {
          await createUserWithEmailAndPassword(auth, email.trim(), password);
        } catch (err) {
          sessionStorage.removeItem(FRESH_ACCOUNT_KEY);
          throw err;
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0B0F19",
      color: "#F7F6F1",
      display: "grid",
      placeItems: "center",
      padding: 20,
      fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif',
    }}>
      <div style={{
        width: "min(100%, 420px)",
        maxWidth: "420px",
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#141A28",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 24,
        padding: 22,
        boxShadow: "0 30px 90px rgba(0,0,0,.45)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <img src="/abide-logo.png" alt="Abide" style={{ width: 48, height: 48, borderRadius: 14 }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>ABIDE</div>
            <div style={{ fontSize: 12.5, color: "#8E97A8", marginTop: 2 }}>One account. Every device.</div>
          </div>
        </div>

        <div style={{ display: "flex", width: "100%", minWidth: 0, overflow: "hidden", background: "rgba(255,255,255,.055)", borderRadius: 11, padding: 3, marginBottom: 16 }}>
          {[["signin", "Sign In"], ["create", "Create Account"]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setMode(id); setError(""); }}
              style={{
                flex: "1 1 0", minWidth: 0, border: 0, borderRadius: 9, padding: "9px 7px", cursor: "pointer",
                background: mode === id ? "#2A3245" : "transparent",
                color: mode === id ? "#F7F6F1" : "#8E97A8",
                font: "inherit", fontSize: 12.5, fontWeight: 700,
                lineHeight: 1.2, whiteSpace: "normal", overflowWrap: "anywhere",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: "#6E7686", marginBottom: 6 }}>Email</label>
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.055)", color: "#F7F6F1", borderRadius: 11, padding: "12px 13px", font: "inherit", fontSize: 14, outline: "none" }}
          />

          <label style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: "#6E7686", margin: "14px 0 6px" }}>Password</label>
          <input
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.055)", color: "#F7F6F1", borderRadius: 11, padding: "12px 13px", font: "inherit", fontSize: 14, outline: "none" }}
          />

          {error && <div style={{ color: "#E68080", fontSize: 12.5, lineHeight: 1.45, marginTop: 12 }}>{error}</div>}

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            style={{ width: "100%", marginTop: 16, border: 0, borderRadius: 12, padding: "12px 14px", cursor: busy ? "default" : "pointer", background: "#E8B45C", color: "#14100A", font: "inherit", fontSize: 14, fontWeight: 800, opacity: busy || !email.trim() || !password ? .55 : 1 }}
          >
            {busy ? "Connecting…" : mode === "create" ? "Create Abide Account" : "Sign In to Abide"}
          </button>
        </form>

        <div style={{ marginTop: 14, fontSize: 11.5, lineHeight: 1.5, color: "#6E7686" }}>
          {mode === "create"
            ? "A new Abide account starts clean and private. Your data syncs only with devices signed into this account."
            : "Sign in to restore this account’s Abide data and keep it synced across your devices."}
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ message = "Syncing Abide…" }) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0B0F19",
      color: "#F7F6F1",
      display: "grid",
      placeItems: "center",
      fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif',
    }}>
      <div style={{ textAlign: "center" }}>
        <img src="/abide-logo.png" alt="" style={{ width: 54, height: 54, borderRadius: 15, marginBottom: 12 }} />
        <div style={{ fontSize: 13, color: "#8E97A8" }}>{message}</div>
      </div>
    </div>
  );
}

export default function CloudSyncGate({ children }) {
  const [user, setUser] = useState(undefined);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState("");
  const lastValuesRef = useRef(new Map());
  const reloadTimerRef = useRef(null);
  const deviceId = useMemo(() => (typeof window !== "undefined" ? getDeviceId() : "server"), []);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser || null);
    setReady(false);
    setSyncError("");
  }), []);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;
    let unsubscribe = () => {};
    let pollTimer = null;
    const stateCollection = collection(db, "users", user.uid, SYNC_COLLECTION);

    const initialize = async () => {
      try {
        const remoteSnap = await getDocs(stateCollection);
        if (cancelled) return;

        const remote = new Map();
        remoteSnap.forEach((snap) => {
          const data = snap.data();
          if (data?.key && shouldSyncKey(data.key) && typeof data.value === "string") {
            remote.set(data.key, data.value);
          }
        });

        const freshAccountCreation =
          sessionStorage.getItem(FRESH_ACCOUNT_KEY) === "1";

        if (freshAccountCreation) {
          clearSyncedLocalState();
          sessionStorage.removeItem(FRESH_ACCOUNT_KEY);
        }

        const local = localSyncSnapshot();
        const writes = [];

        remote.forEach((value, key) => {
          if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
        });

        local.forEach((value, key) => {
          if (remote.has(key)) return;
          writes.push(setDoc(
            doc(db, "users", user.uid, SYNC_COLLECTION, docIdForKey(key)),
            { key, value, deviceId, updatedAt: serverTimestamp() }
          ));
        });

        if (writes.length) await Promise.all(writes);
        if (cancelled) return;

        lastValuesRef.current = localSyncSnapshot();
        setReady(true);

        unsubscribe = onSnapshot(
          stateCollection,
          { includeMetadataChanges: true },
          (snapshot) => {
            if (cancelled) return;
            let changed = false;

            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") return;

              const data = change.doc.data();
              if (!data?.key || !shouldSyncKey(data.key) || typeof data.value !== "string") return;
              if (data.deviceId === deviceId || change.doc.metadata.hasPendingWrites) return;
              if (localStorage.getItem(data.key) === data.value) return;

              localStorage.setItem(data.key, data.value);
              lastValuesRef.current.set(data.key, data.value);
              changed = true;
            });

            if (changed) {
              window.clearTimeout(reloadTimerRef.current);
              reloadTimerRef.current = window.setTimeout(() => window.location.reload(), 350);
            }
          },
          (error) => setSyncError(error?.message || "Realtime sync stopped.")
        );

        pollTimer = window.setInterval(() => {
          const current = localSyncSnapshot();
          current.forEach((value, key) => {
            if (lastValuesRef.current.get(key) === value) return;
            lastValuesRef.current.set(key, value);

            setDoc(
              doc(db, "users", user.uid, SYNC_COLLECTION, docIdForKey(key)),
              { key, value, deviceId, updatedAt: serverTimestamp() }
            ).catch((error) => setSyncError(error?.message || "A change could not sync."));
          });
        }, 900);
      } catch (error) {
        if (!cancelled) {
          setSyncError(error?.message || "Abide could not connect to Firestore.");
          setReady(true);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
      unsubscribe();
      if (pollTimer) window.clearInterval(pollTimer);
      window.clearTimeout(reloadTimerRef.current);
    };
  }, [user, deviceId]);

  const handleSignOut = async () => {
    clearSyncedLocalState();
    await signOut(auth);
    window.location.reload();
  };

  if (user === undefined) return <LoadingScreen message="Opening Abide…" />;
  if (!user) return <AuthScreen />;
  if (!ready) return <LoadingScreen />;

  if (!React.isValidElement(children)) return children;

  return React.cloneElement(children, {
    accountSync: {
      email: user.email || "",
      syncError,
      signOut: handleSignOut,
    },
  });
}
