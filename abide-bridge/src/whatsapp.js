import "dotenv/config";
import crypto from "node:crypto";

export function normalizePhone(value) {
  return String(value || "")
    .replace(/\D/g, "");
}

export function actorForPhone(phone) {
  const normalized =
    normalizePhone(phone);

  const tyler =
    normalizePhone(
      process.env
        .TYLER_WHATSAPP_E164
    );

  const elizabeth =
    normalizePhone(
      process.env
        .ELIZABETH_WHATSAPP_E164
    );

  if (
    tyler &&
    normalized === tyler
  ) {
    return "tyler";
  }

  if (
    elizabeth &&
    normalized ===
      elizabeth
  ) {
    return "elizabeth";
  }

  return null;
}

export function verifyMetaSignature({
  rawBody,
  signature
}) {
  const secret =
    process.env.META_APP_SECRET;

  if (!secret) {
    return false;
  }

  if (
    !signature ||
    !signature.startsWith(
      "sha256="
    )
  ) {
    return false;
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(rawBody)
      .digest("hex");

  const actualBuffer =
    Buffer.from(signature);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    actualBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    actualBuffer,
    expectedBuffer
  );
}

export function extractTextMessages(
  payload
) {
  const results = [];

  for (
    const entry of
      payload?.entry || []
  ) {
    for (
      const change of
        entry?.changes || []
    ) {
      const value =
        change?.value;

      for (
        const message of
          value?.messages || []
      ) {
        results.push({
          id: message.id,
          from: message.from,
          type: message.type,
          text:
            message.type ===
            "text"
              ? message.text
                  ?.body || ""
              : ""
        });
      }
    }
  }

  return results;
}

export async function sendWhatsAppText({
  to,
  body
}) {
  const version =
    process.env
      .META_GRAPH_VERSION;

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID;

  const token =
    process.env
      .WHATSAPP_ACCESS_TOKEN;

  if (
    !version ||
    !phoneNumberId ||
    !token
  ) {
    throw new Error(
      "WhatsApp credentials are incomplete."
    );
  }

  const response =
    await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          recipient_type:
            "individual",
          to:
            normalizePhone(to),
          type: "text",
          text: {
            preview_url: false,
            body
          }
        })
      }
    );

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `WhatsApp send failed (${response.status}): ${detail}`
    );
  }

  return response.json();
}
