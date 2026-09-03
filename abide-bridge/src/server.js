import "dotenv/config";
import express from "express";
import {
  interpretMessage
} from "./interpreter.js";
import {
  routeAction
} from "./actionRouter.js";
import {
  actorForPhone,
  extractTextMessages,
  sendWhatsAppText,
  verifyMetaSignature
} from "./whatsapp.js";

const app = express();
const port =
  Number(process.env.PORT) ||
  8787;

/*
 * Prototype session memory.
 * This will move to Firestore before
 * we depend on it in production.
 */
const sessions =
  new Map();

const processedIds =
  new Set();

function getHistory(phone) {
  return (
    sessions.get(phone) || []
  );
}

function addHistory(
  phone,
  item
) {
  const next = [
    ...getHistory(phone),
    item
  ].slice(-8);

  sessions.set(
    phone,
    next
  );
}

function clearHistory(phone) {
  sessions.delete(phone);
}

app.get(
  "/health",
  (_req, res) => {
    res.json({
      ok: true,
      service:
        "abide-message-bridge",
      phase: "2B"
    });
  }
);

app.get(
  "/whatsapp/webhook",
  (req, res) => {
    const mode =
      req.query["hub.mode"];

    const token =
      req.query[
        "hub.verify_token"
      ];

    const challenge =
      req.query[
        "hub.challenge"
      ];

    if (
      mode ===
        "subscribe" &&
      token &&
      token ===
        process.env
          .WHATSAPP_VERIFY_TOKEN
    ) {
      return res
        .status(200)
        .send(challenge);
    }

    return res.sendStatus(403);
  }
);

app.post(
  "/whatsapp/webhook",

  express.raw({
    type: "application/json",
    limit: "1mb"
  }),

  async (req, res) => {
    try {
      const rawBody =
        Buffer.isBuffer(
          req.body
        )
          ? req.body
          : Buffer.from(
              req.body || ""
            );

      const signature =
        req.get(
          "x-hub-signature-256"
        );

      if (
        !verifyMetaSignature({
          rawBody,
          signature
        })
      ) {
        console.warn(
          "Rejected WhatsApp webhook: bad signature"
        );

        return res
          .sendStatus(401);
      }

      const payload =
        JSON.parse(
          rawBody.toString(
            "utf8"
          )
        );

      const messages =
        extractTextMessages(
          payload
        );

      /*
       * Acknowledge valid webhooks.
       * For this two-person prototype we process
       * sequentially before returning.
       */
      for (
        const message of messages
      ) {
        if (
          processedIds.has(
            message.id
          )
        ) {
          continue;
        }

        processedIds.add(
          message.id
        );

        /*
         * Keep prototype memory bounded.
         */
        if (
          processedIds.size >
          1000
        ) {
          processedIds.clear();
          processedIds.add(
            message.id
          );
        }

        const actor =
          actorForPhone(
            message.from
          );

        if (!actor) {
          console.warn(
            "Ignoring message from non-allowlisted number"
          );
          continue;
        }

        if (
          message.type !==
          "text"
        ) {
          await sendWhatsAppText({
            to: message.from,
            body:
              "For now, send me a text message. Photos and voice notes come later."
          });

          continue;
        }

        const history =
          getHistory(
            message.from
          );

        const action =
          await interpretMessage({
            sender: actor,
            text:
              message.text,
            history
          });

        addHistory(
          message.from,
          {
            role: "user",
            text:
              message.text
          }
        );

        addHistory(
          message.from,
          {
            role: "abide",
            structured:
              action
          }
        );

        const result =
          await routeAction({
            action,
            actor,
            originalMessage:
              message.text,
            source:
              "whatsapp"
          });

        await sendWhatsAppText({
          to: message.from,
          body:
            result.reply
        });

        if (
          result.complete
        ) {
          clearHistory(
            message.from
          );
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error(
        "WhatsApp webhook error:",
        error
      );

      /*
       * Return 200 so a malformed prototype message
       * does not create a retry storm.
       */
      return res.sendStatus(200);
    }
  }
);

app.listen(
  port,
  () => {
    console.log(
      `Abide Message Bridge running on http://localhost:${port}`
    );

    console.log(
      "Phase 1 is dry-run: no Abide data is modified."
    );
  }
);
