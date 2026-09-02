const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToB64(bytes) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function b64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function randomSalt(size = 16) {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(size)));
}

export async function deriveVaultKey(passphrase, saltB64) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: b64ToBytes(saltB64),
      iterations: 310000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVaultJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext
    )
  );

  return {
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(ciphertext),
  };
}

export async function decryptVaultJson(key, encrypted) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: b64ToBytes(encrypted.iv),
    },
    key,
    b64ToBytes(encrypted.ciphertext)
  );

  return JSON.parse(decoder.decode(plaintext));
}

export async function makeVaultVerifier(key) {
  return encryptVaultJson(key, {
    purpose: "abide-private-vault",
    version: 1,
  });
}

export async function verifyVaultKey(key, verifier) {
  try {
    const value = await decryptVaultJson(key, verifier);
    return (
      value?.purpose === "abide-private-vault" &&
      value?.version === 1
    );
  } catch {
    return false;
  }
}
