import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  ArrowLeft,
  Lock,
  LockKeyhole,
  NotebookPen,
  Plus,
  Settings,
  StickyNote,
  Trash2,
} from "lucide-react";
import { auth, db } from "./firebase.js";
import WorkspaceEditor from "./blockWorkspace/WorkspaceEditor.jsx";
import {
  decryptVaultJson,
  deriveVaultKey,
  encryptVaultJson,
  makeVaultVerifier,
  randomSalt,
  verifyVaultKey,
} from "./vaultCrypto.js";

const EMPTY_BLOCKS = [{
  id: "vault_block_1",
  type: "text",
  text: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
}];

function currentUid() {
  return auth.currentUser?.uid || "";
}

function metaRef() {
  return doc(
    db,
    "users",
    currentUid(),
    "privateVaultMeta",
    "config"
  );
}

function entriesRef() {
  return collection(
    db,
    "users",
    currentUid(),
    "privateVaultEntries"
  );
}

function entryRef(id) {
  return doc(
    db,
    "users",
    currentUid(),
    "privateVaultEntries",
    id
  );
}

function freshEntry(type) {
  const now = Date.now();
  return {
    id: `vault_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    title:
      type === "journal"
        ? new Date().toLocaleDateString([], {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "Untitled private note",
    blocks: [{
      ...EMPTY_BLOCKS[0],
      id: `vault_block_${now}_${Math.random().toString(36).slice(2, 7)}`,
    }],
    createdAt: now,
    updatedAt: now,
  };
}

export default function PrivateVault() {
  const [meta, setMeta] = useState(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [vaultKey, setVaultKey] = useState(null);
  const [locked, setLocked] = useState(true);
  const [screen, setScreen] = useState("journal");
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);

  const timerRef = useRef(null);

  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId) || null,
    [entries, selectedId]
  );

  const visibleEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.type === screen)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [entries, screen]
  );

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        lockVault();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (locked) return;
    resetAutoLock();

    const activity = () => resetAutoLock();
    window.addEventListener("pointerdown", activity, true);
    window.addEventListener("keydown", activity, true);

    return () => {
      window.removeEventListener("pointerdown", activity, true);
      window.removeEventListener("keydown", activity, true);
      clearTimeout(timerRef.current);
    };
  }, [locked, autoLockMinutes]);

  async function loadMeta() {
    if (!currentUid()) return;
    const snap = await getDoc(metaRef());
    if (snap.exists()) {
      const data = snap.data();
      setMeta(data);
      setAutoLockMinutes(Number(data.autoLockMinutes || 15));
    }
    setMetaLoaded(true);
  }

  function resetAutoLock() {
    clearTimeout(timerRef.current);
    if (locked || autoLockMinutes <= 0) return;
    timerRef.current = setTimeout(
      lockVault,
      autoLockMinutes * 60 * 1000
    );
  }

  function lockVault() {
    clearTimeout(timerRef.current);
    setVaultKey(null);
    setEntries([]);
    setSelectedId("");
    setPassphrase("");
    setLocked(true);
  }

  async function createVault(event) {
    event.preventDefault();
    setMessage("");

    if (passphrase.length < 10) {
      setMessage("Use a passphrase of at least 10 characters.");
      return;
    }

    if (passphrase !== setupConfirm) {
      setMessage("The passphrases do not match.");
      return;
    }

    setBusy(true);

    try {
      const salt = randomSalt();
      const nextKey = await deriveVaultKey(passphrase, salt);
      const verifier = await makeVaultVerifier(nextKey);

      const nextMeta = {
        version: 1,
        salt,
        verifier,
        autoLockMinutes: 15,
        updatedAt: Date.now(),
      };

      await setDoc(metaRef(), nextMeta);

      setMeta(nextMeta);
      setVaultKey(nextKey);
      setLocked(false);
      setPassphrase("");
      setSetupConfirm("");
      await loadEntries(nextKey);
    } catch (error) {
      console.error(error);
      setMessage("The Private Vault could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function unlockVault(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const nextKey = await deriveVaultKey(passphrase, meta.salt);
      const valid = await verifyVaultKey(nextKey, meta.verifier);

      if (!valid) {
        setMessage("Incorrect Vault passphrase.");
        return;
      }

      setVaultKey(nextKey);
      setLocked(false);
      setPassphrase("");
      await loadEntries(nextKey);
    } catch {
      setMessage("Incorrect Vault passphrase.");
    } finally {
      setBusy(false);
    }
  }

  async function loadEntries(activeKey = vaultKey) {
    if (!activeKey) return;

    const snap = await getDocs(entriesRef());
    const decrypted = [];

    for (const item of snap.docs) {
      try {
        const value = await decryptVaultJson(
          activeKey,
          item.data().payload
        );
        decrypted.push({ ...value, id: item.id });
      } catch (error) {
        console.error("Could not decrypt private vault entry", item.id, error);
      }
    }

    setEntries(decrypted);
  }

  async function persistEntry(entry) {
    if (!vaultKey) return;

    const payload = await encryptVaultJson(vaultKey, entry);

    await setDoc(entryRef(entry.id), {
      version: 1,
      typeHint: entry.type,
      payload,
      updatedAt: Date.now(),
    });

    setEntries((current) => {
      const exists = current.some((item) => item.id === entry.id);
      return exists
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...current];
    });
  }

  async function addEntry(type) {
    const entry = freshEntry(type);
    await persistEntry(entry);
    setScreen(type);
    setSelectedId(entry.id);
  }

  async function removeEntry(entry) {
    if (!window.confirm("Delete this private entry? This cannot be undone.")) {
      return;
    }

    await deleteDoc(entryRef(entry.id));
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setSelectedId("");
  }

  async function changePassphrase(event) {
    event.preventDefault();
    setMessage("");

    if (newPass.length < 10) {
      setMessage("Use a new passphrase of at least 10 characters.");
      return;
    }

    if (newPass !== confirmPass) {
      setMessage("The new passphrases do not match.");
      return;
    }

    setBusy(true);

    try {
      const oldKey = await deriveVaultKey(currentPass, meta.salt);
      const valid = await verifyVaultKey(oldKey, meta.verifier);

      if (!valid) {
        setMessage("Your current passphrase is incorrect.");
        return;
      }

      const snap = await getDocs(entriesRef());
      const decrypted = [];

      for (const item of snap.docs) {
        decrypted.push({
          id: item.id,
          value: await decryptVaultJson(
            oldKey,
            item.data().payload
          ),
        });
      }

      const nextSalt = randomSalt();
      const nextKey = await deriveVaultKey(newPass, nextSalt);
      const nextVerifier = await makeVaultVerifier(nextKey);

      const batch = writeBatch(db);

      for (const item of decrypted) {
        const payload = await encryptVaultJson(nextKey, item.value);
        batch.set(entryRef(item.id), {
          version: 1,
          typeHint: item.value.type,
          payload,
          updatedAt: Date.now(),
        });
      }

      const nextMeta = {
        ...meta,
        salt: nextSalt,
        verifier: nextVerifier,
        updatedAt: Date.now(),
      };

      batch.set(metaRef(), nextMeta);
      await batch.commit();

      setMeta(nextMeta);
      setVaultKey(nextKey);
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      setMessage("Vault passphrase changed.");
    } catch (error) {
      console.error(error);
      setMessage("The passphrase could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAutoLock(value) {
    const minutes = Number(value);
    setAutoLockMinutes(minutes);

    const nextMeta = {
      ...meta,
      autoLockMinutes: minutes,
      updatedAt: Date.now(),
    };

    setMeta(nextMeta);
    await setDoc(metaRef(), nextMeta);
  }

  if (!metaLoaded) {
    return <section className="vault-shell">Loading Private Vault…</section>;
  }

  if (!meta) {
    return (
      <section className="vault-shell">
        <div className="vault-card vault-auth-card">
          <LockKeyhole size={30} />
          <h2>Create Private Vault</h2>
          <p>
            Private Journal and Private Notes are encrypted on this device
            before they are stored in Firebase.
          </p>

          <form onSubmit={createVault}>
            <input
              className="input-line"
              type="password"
              autoComplete="new-password"
              placeholder="Create Vault passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />

            <input
              className="input-line"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm Vault passphrase"
              value={setupConfirm}
              onChange={(e) => setSetupConfirm(e.target.value)}
            />

            {message && <div className="vault-message">{message}</div>}

            <button className="btn-primary" type="submit" disabled={busy}>
              Create Private Vault
            </button>
          </form>

          <small>
            Important: Abide cannot recover a lost Vault passphrase.
          </small>
        </div>
      </section>
    );
  }

  if (locked) {
    return (
      <section className="vault-shell">
        <div className="vault-card vault-auth-card">
          <Lock size={30} />
          <h2>Private Vault</h2>
          <p>
            Enter your Vault passphrase to open your private journal entries
            and notes.
          </p>

          <form onSubmit={unlockVault}>
            <input
              className="input-line"
              type="password"
              autoComplete="current-password"
              placeholder="Vault passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
            />

            {message && <div className="vault-message">{message}</div>}

            <button className="btn-primary" type="submit" disabled={busy}>
              Unlock Vault
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (selected) {
    return (
      <section className="vault-shell">
        <div className="vault-topbar">
          <button
            type="button"
            className="vault-icon-button"
            onClick={() => setSelectedId("")}
          >
            <ArrowLeft size={17} />
          </button>

          <div className="vault-topbar-copy">
            <span>
              {selected.type === "journal"
                ? "Private Journal"
                : "Private Note"}
            </span>
            <small>Encrypted</small>
          </div>

          <button
            type="button"
            className="vault-danger-button"
            onClick={() => removeEntry(selected)}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <input
          className="vault-title-input"
          value={selected.title}
          onChange={(event) => {
            const next = {
              ...selected,
              title: event.target.value,
              updatedAt: Date.now(),
            };
            setEntries((current) =>
              current.map((item) => (item.id === next.id ? next : item))
            );
          }}
          onBlur={(event) => {
            persistEntry({
              ...selected,
              title: event.currentTarget.value,
              updatedAt: Date.now(),
            });
          }}
          placeholder={
            selected.type === "journal"
              ? "Journal entry"
              : "Private note"
          }
        />

        <WorkspaceEditor
          key={selected.id}
          initialBlocks={selected.blocks || EMPTY_BLOCKS}
          onChange={(blocks) => {
            const next = {
              ...selected,
              blocks,
              updatedAt: Date.now(),
            };

            setEntries((current) =>
              current.map((item) => (item.id === next.id ? next : item))
            );

            window.clearTimeout(window.__abideVaultSaveTimer);
            window.__abideVaultSaveTimer = window.setTimeout(
              () => persistEntry(next),
              700
            );
          }}
          placeholder="Start writing privately…"
        />
      </section>
    );
  }

  return (
    <section className="vault-shell">
      <div className="vault-header">
        <div>
          <div className="vault-eyebrow">
            <Lock size={13} />
            ENCRYPTED
          </div>
          <h1>Private Vault</h1>
        </div>

        <button
          type="button"
          className="vault-lock-button"
          onClick={lockVault}
        >
          <Lock size={14} />
          Lock
        </button>
      </div>

      <div className="vault-tabs">
        <button
          className={screen === "journal" ? "active" : ""}
          onClick={() => setScreen("journal")}
        >
          <NotebookPen size={15} />
          Journal
        </button>

        <button
          className={screen === "note" ? "active" : ""}
          onClick={() => setScreen("note")}
        >
          <StickyNote size={15} />
          Notes
        </button>

        <button
          className={screen === "settings" ? "active" : ""}
          onClick={() => setScreen("settings")}
        >
          <Settings size={15} />
          Settings
        </button>
      </div>

      {screen === "settings" ? (
        <div className="vault-settings">
          <div className="vault-card">
            <h3>Change Vault Passphrase</h3>
            <p>
              Changing it re-encrypts every Private Journal entry and Private
              Note with the new passphrase.
            </p>

            <form onSubmit={changePassphrase}>
              <input
                className="input-line"
                type="password"
                placeholder="Current passphrase"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
              />
              <input
                className="input-line"
                type="password"
                placeholder="New passphrase"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
              <input
                className="input-line"
                type="password"
                placeholder="Confirm new passphrase"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
              />

              <button className="btn-primary" type="submit" disabled={busy}>
                Change Passphrase
              </button>
            </form>

            {message && <div className="vault-message">{message}</div>}
          </div>

          <div className="vault-card">
            <h3>Auto-lock</h3>

            <select
              className="input-line"
              value={autoLockMinutes}
              onChange={(e) => saveAutoLock(e.target.value)}
            >
              <option value={1}>After 1 minute</option>
              <option value={5}>After 5 minutes</option>
              <option value={15}>After 15 minutes</option>
              <option value={30}>After 30 minutes</option>
              <option value={60}>After 1 hour</option>
            </select>

            <button
              type="button"
              className="vault-lock-button"
              onClick={lockVault}
            >
              Lock Vault Now
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="vault-new-button"
            onClick={() => addEntry(screen)}
          >
            <Plus size={16} />
            {screen === "journal"
              ? "New Private Journal Entry"
              : "New Private Note"}
          </button>

          <div className="vault-list">
            {visibleEntries.length ? (
              visibleEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="vault-entry-row"
                  onClick={() => setSelectedId(entry.id)}
                >
                  <div>
                    <strong>{entry.title || "Private Entry"}</strong>
                    <small>
                      {new Date(
                        entry.updatedAt || entry.createdAt
                      ).toLocaleString()}
                    </small>
                  </div>

                  <Lock size={14} />
                </button>
              ))
            ) : (
              <div className="vault-empty">
                <LockKeyhole size={28} />
                <strong>
                  No private{" "}
                  {screen === "journal" ? "journal entries" : "notes"} yet
                </strong>
                <span>
                  Create one and Abide will encrypt it before storing it.
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
