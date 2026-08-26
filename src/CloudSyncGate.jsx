import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
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
  if (code === "auth/popup-closed-by-user") return "Google sign-in was closed before it finished.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow popups for Abide and try again.";
  if (code === "auth/unauthorized-domain") return "This Abide web address is not authorized for Google sign-in yet.";
  if (code === "auth/account-exists-with-different-credential") return "An Abide account already exists with this email using another sign-in method. Sign in that way first.";
  return error?.message || "Abide could not sign in.";
}

function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const firebaseConfigured = Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID
  );

  const continueWithGoogle = async () => {
    if (!firebaseConfigured || busy) {
      if (!firebaseConfigured) {
        setError("Firebase environment values are missing from this build.");
      }
      return;
    }

    setBusy(true);
    setError("");

    // Start from a clean local Abide state. Existing Google-authenticated
    // accounts will immediately restore their own state from Firestore.
    sessionStorage.setItem(FRESH_ACCOUNT_KEY, "1");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (err) {
      sessionStorage.removeItem(FRESH_ACCOUNT_KEY);
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const continueWithMicrosoft = async () => {
    if (!firebaseConfigured || busy) {
      if (!firebaseConfigured) {
        setError("Firebase environment values are missing from this build.");
      }
      return;
    }

    setBusy(true);
    setError("");

    // Provider sign-in always starts from a clean local state so data from
    // one Abide account can never leak into another account on this device.
    sessionStorage.setItem(FRESH_ACCOUNT_KEY, "1");

    try {
      const provider = new OAuthProvider("microsoft.com");
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (err) {
      sessionStorage.removeItem(FRESH_ACCOUNT_KEY);
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

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
      padding: 16,
      boxSizing: "border-box",
      fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif',
    }}>
      <div style={{
        width: "min(100%, 420px)",
        maxWidth: "420px",
        maxHeight: "calc(100dvh - 32px)",
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: "auto",
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
            <div style={{ fontSize: 12.5, color: "#8E97A8", marginTop: 2, lineHeight: 1.4 }}>Sign in once. Keep Abide with you.</div>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={continueWithGoogle}
          style={{
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            border: "1px solid rgba(255,255,255,.12)",
            background: "#F7F6F1",
            color: "#20242D",
            borderRadius: 12,
            padding: "11px 13px",
            font: "inherit",
            fontSize: 13.5,
            fontWeight: 750,
            lineHeight: 1.25,
            textAlign: "center",
            whiteSpace: "normal",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? .6 : 1,
          }}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            style={{ display: "block", flexShrink: 0 }}
          >
            <path
              fill="#4285F4"
              d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.877 2.684-6.614Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A8.999 8.999 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.961H.956A8.997 8.997 0 0 0 0 9c0 1.452.347 2.827.956 4.039l3.007-2.333Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A8.999 8.999 0 0 0 .956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58Z"
            />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={continueWithMicrosoft}
          style={{
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginTop: 10,
            border: "1px solid rgba(255,255,255,.12)",
            background: "#F7F6F1",
            color: "#20242D",
            borderRadius: 12,
            padding: "11px 13px",
            font: "inherit",
            fontSize: 13.5,
            fontWeight: 750,
            lineHeight: 1.25,
            textAlign: "center",
            whiteSpace: "normal",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? .6 : 1,
          }}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            style={{ display: "block", flexShrink: 0 }}
          >
            <rect x="0" y="0" width="8" height="8" fill="#F25022" />
            <rect x="10" y="0" width="8" height="8" fill="#7FBA00" />
            <rect x="0" y="10" width="8" height="8" fill="#00A4EF" />
            <rect x="10" y="10" width="8" height="8" fill="#FFB900" />
          </svg>
          Continue with Microsoft
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "15px 0",
            color: "#6E7686",
            fontSize: 10.5,
            fontWeight: 750,
            letterSpacing: .5,
            textTransform: "uppercase",
          }}
        >
          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,.08)" }} />
          Or continue with email
          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,.08)" }} />
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

          <div style={{ position: "relative", width: "100%", minWidth: 0 }}>
            <input
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,.09)",
                background: "rgba(255,255,255,.055)",
                color: "#F7F6F1",
                borderRadius: 11,
                padding: "12px 68px 12px 13px",
                font: "inherit",
                fontSize: 14,
                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: 0,
                background: "transparent",
                color: "#E8B45C",
                font: "inherit",
                fontSize: 11.5,
                fontWeight: 750,
                padding: "6px 4px",
                cursor: "pointer",
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && <div style={{ color: "#E68080", fontSize: 12.5, lineHeight: 1.45, marginTop: 12 }}>{error}</div>}

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            style={{ width: "100%", marginTop: 16, border: 0, borderRadius: 12, padding: "12px 14px", cursor: busy ? "default" : "pointer", background: "#E8B45C", color: "#14100A", font: "inherit", fontSize: 14, fontWeight: 800, opacity: busy || !email.trim() || !password ? .55 : 1 }}
          >
            {busy ? "Connecting…" : mode === "create" ? "Create Abide Account" : "Sign In to Abide"}
          </button>
        </form>

        <div style={{ marginTop: 14, padding: "0 2px", fontSize: 11.5, lineHeight: 1.5, color: "#6E7686", overflowWrap: "anywhere" }}>
          {mode === "create"
            ? "Create a private Abide account. It starts clean, and only devices signed into this account can sync its data."
            : "Sign in to open your existing Abide account and keep your data synced across your devices."}
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

    // Calendar OAuth credentials are session-only and must never carry
    // from one Abide account into another account on the same browser.
    try {
      sessionStorage.removeItem("abideGoogleCalendarAccounts");
      sessionStorage.removeItem("abideGoogleCalendarToken");
      sessionStorage.removeItem("abideMicrosoftCalendarAccounts");

      // MSAL stores Microsoft authorization state in sessionStorage.
      // Remove only MSAL-owned keys so another Abide user cannot inherit
      // the previous user's Microsoft calendar authorization.
      const microsoftSessionKeys = [];

      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("msal.")) {
          microsoftSessionKeys.push(key);
        }
      }

      microsoftSessionKeys.forEach((key) => {
        sessionStorage.removeItem(key);
      });
    } catch {}

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
