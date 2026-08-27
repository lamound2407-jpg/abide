const crypto = require("crypto");

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

const { initializeApp } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");

const { DateTime } = require("luxon");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();
const adminAuth = getAuth();

const TASK_STATE_KEY = "abide-tasks";
const EVENT_STATE_KEY = "abide-calendar-events";
const PREF_STATE_KEY = "abide-notification-prefs";
const INLINE_REMINDER_STATE_KEY = "abide-inline-reminders";

const DEFAULT_TIMEZONE = "America/Chicago";

const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar";

const GOOGLE_CALENDAR_OAUTH_SECRET =
  "GOOGLE_CALENDAR_OAUTH";

const GOOGLE_CALENDAR_CALLBACK_URL =
  "https://us-central1-abide-809d9.cloudfunctions.net/googleCalendarOAuthCallback";

const ABIDE_APP_URL =
  "https://abide-809d9.web.app";

const GOOGLE_OAUTH_STATE_TTL_MS =
  10 * 60 * 1000;


/*
 * Scheduler runs every minute.
 *
 * Firestore currently stores Abide's task array as JSON inside:
 *
 * users/{uid}/syncState/{document}
 *   key: "abide-tasks"
 *   value: "[...]"
 *
 * Push devices live at:
 *
 * users/{uid}/pushDevices/{deviceId}
 *
 * This function bridges those two existing systems.
 */

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function reminderOffsetMinutes(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text || text === "none") return null;
  if (text === "at time") return 0;

  let match = text.match(/(\d+)\s*(?:min|minute)/);
  if (match) return Number(match[1]);

  match = text.match(/(\d+)\s*(?:hour|hr)/);
  if (match) return Number(match[1]) * 60;

  match = text.match(/(\d+)\s*day/);
  if (match) return Number(match[1]) * 1440;

  return null;
}

function taskDueMoment(task, timezone) {
  if (!task?.dueDate || !task?.dueTime) return null;

  const moment = DateTime.fromISO(
    `${task.dueDate}T${task.dueTime}`,
    { zone: timezone }
  );

  return moment.isValid ? moment : null;
}

function parseDisplayEventTime(dateKey, timeLabel, timezone) {
  if (
    !dateKey ||
    !timeLabel ||
    /all\s*day/i.test(String(timeLabel))
  ) {
    return null;
  }

  const formats = [
    "yyyy-MM-dd h:mm a",
    "yyyy-MM-dd h a",
    "yyyy-MM-dd H:mm",
  ];

  for (const format of formats) {
    const parsed = DateTime.fromFormat(
      `${dateKey} ${timeLabel}`,
      format,
      {
        zone: timezone,
        locale: "en-US",
      }
    );

    if (parsed.isValid) {
      return parsed;
    }
  }

  return null;
}

function eventStartMoment(event, timezone) {
  if (!event) return null;

  const start = event.start || {};

  // Google all-day events use start.date rather than dateTime.
  if (start.date && !start.dateTime) {
    return null;
  }

  if (start.dateTime) {
    const raw = String(start.dateTime);

    const hasOffset =
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);

    let parsed;

    if (hasOffset) {
      parsed = DateTime.fromISO(raw, {
        setZone: true,
      });

      if (parsed.isValid && validTimezone(timezone)) {
        parsed = parsed.setZone(timezone);
      }
    } else {
      const zone =
        validTimezone(start.timeZone)
          ? start.timeZone
          : timezone;

      parsed = DateTime.fromISO(raw, {
        zone,
      });
    }

    if (parsed?.isValid) {
      return parsed;
    }
  }

  // Native Abide events use the synced date + display-time label.
  return parseDisplayEventTime(
    event.date,
    event.time,
    timezone
  );
}

function reminderMoment(task, timezone) {
  if (!task || !task.reminder || task.reminder === "None") {
    return null;
  }

  if (task.reminder === "Custom") {
    if (!task.reminderAt) return null;

    const moment = DateTime.fromISO(String(task.reminderAt), {
      zone: timezone,
      setZone: true,
    });

    return moment.isValid ? moment : null;
  }

  const offsetMinutes = reminderOffsetMinutes(task.reminder);

  if (offsetMinutes == null) return null;
  if (!task.dueDate) return null;

  const dueTime = task.dueTime || "09:00";

  const due = DateTime.fromISO(
    `${task.dueDate}T${dueTime}`,
    {
      zone: timezone,
    }
  );

  if (!due.isValid) return null;

  return due.minus({ minutes: offsetMinutes });
}

function deliveryId(taskId, moment, kind = "reminder") {
  return crypto
    .createHash("sha256")
    .update(`${String(taskId)}|${kind}|${moment.toUTC().toISO()}`)
    .digest("hex");
}

function naturalReminderLead(value) {
  const minutes = reminderOffsetMinutes(value);

  if (value === "At time" || minutes === 0) {
    return "Due now";
  }

  if (minutes == null) {
    return "Reminder";
  }

  if (minutes < 60) {
    return `Due in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  if (minutes < 1440 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `Due in ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `Due in ${days} day${days === 1 ? "" : "s"}`;
  }

  return "Upcoming reminder";
}

function dueDescription(task, timezone) {
  if (!task.dueDate) return "";

  const dueTime = task.dueTime || "09:00";

  const due = DateTime.fromISO(
    `${task.dueDate}T${dueTime}`,
    { zone: timezone }
  );

  if (!due.isValid) return "";

  const now = DateTime.now().setZone(timezone);
  const tomorrow = now.plus({ days: 1 });

  let dateText;

  if (due.hasSame(now, "day")) {
    dateText = "today";
  } else if (due.hasSame(tomorrow, "day")) {
    dateText = "tomorrow";
  } else {
    dateText = `on ${due.toFormat("MMM d")}`;
  }

  if (task.dueTime) {
    return `${dateText.charAt(0).toUpperCase()}${dateText.slice(1)} at ${due.toFormat("h:mm a")}`;
  }

  return `${dateText.charAt(0).toUpperCase()}${dateText.slice(1)}`;
}

function notificationBody(task, moment, timezone) {
  const dueText = dueDescription(task, timezone);

  if (task.reminder === "Custom") {
    return dueText
      ? `Due ${dueText.charAt(0).toLowerCase()}${dueText.slice(1)}`
      : "It's time for this reminder.";
  }

  const lead = naturalReminderLead(task.reminder);

  if (!dueText) {
    return lead;
  }

  return `${lead} · ${dueText}`;
}

function validTimezone(value) {
  if (!value) return false;

  try {
    return Boolean(
      DateTime.now()
        .setZone(value)
        .isValid
    );
  } catch {
    return false;
  }
}

async function claimDelivery(uid, task, moment, kind = "reminder") {
  const id = deliveryId(task.id, moment, kind);

  const ref = db
    .collection("users")
    .doc(uid)
    .collection("reminderDeliveries")
    .doc(id);

  const now = Date.now();
  let claimed = false;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (snapshot.exists) {
      const data = snapshot.data();

      if (data.status === "sent") {
        return;
      }

      const claimedAtMs =
        data.claimedAt?.toMillis?.() ||
        data.claimedAtMs ||
        0;

      // If another invocation claimed this in the last 5 minutes,
      // let that invocation finish instead of sending twice.
      if (
        data.status === "sending" &&
        claimedAtMs &&
        now - claimedAtMs < 5 * 60 * 1000
      ) {
        return;
      }
    }

    transaction.set(
      ref,
      {
        taskId: String(task.id),
        reminderAt: moment.toUTC().toISO(),
        status: "sending",
        claimedAt: FieldValue.serverTimestamp(),
        claimedAtMs: now,
        attempts: FieldValue.increment(1),
      },
      { merge: true }
    );

    claimed = true;
  });

  return {
    claimed,
    ref,
  };
}

async function markDeliverySent(ref, result) {
  await ref.set(
    {
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      successCount: result.successCount || 0,
      failureCount: result.failureCount || 0,
      lastError: FieldValue.delete(),
    },
    { merge: true }
  );
}

async function markDeliveryFailed(ref, message) {
  await ref.set(
    {
      status: "failed",
      failedAt: FieldValue.serverTimestamp(),
      lastError: String(message || "Push delivery failed"),
    },
    { merge: true }
  );
}

async function cleanInvalidTokens(deviceDocs, responses) {
  const deletions = [];

  responses.forEach((response, index) => {
    if (response.success) return;

    const code = response.error?.code || "";

    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      const deviceDoc = deviceDocs[index];

      if (deviceDoc) {
        deletions.push(deviceDoc.ref.delete());
      }
    }
  });

  if (deletions.length) {
    await Promise.allSettled(deletions);
  }
}


function googleOAuthConfig() {
  const raw =
    process.env.GOOGLE_CALENDAR_OAUTH || "";

  let config;

  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(
      "GOOGLE_CALENDAR_OAUTH secret is not valid JSON."
    );
  }

  if (
    !config?.clientId ||
    !config?.clientSecret
  ) {
    throw new Error(
      "Google OAuth client ID or secret is missing."
    );
  }

  return config;
}

function googlePrivateAccountRef(uid, accountId) {
  return db
    .collection("privateGoogleCalendarTokens")
    .doc(String(uid))
    .collection("accounts")
    .doc(encodeURIComponent(String(accountId)));
}

function googleOAuthStateRef(state) {
  return db
    .collection("privateGoogleCalendarOAuthStates")
    .doc(String(state));
}

function setAbideCors(req, res) {
  const origin = req.get("origin") || "";

  if (
    origin === ABIDE_APP_URL ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
  ) {
    res.set(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );

  res.set(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.set(
    "Vary",
    "Origin"
  );
}

async function requireFirebaseUser(req) {
  const authorization =
    String(req.get("authorization") || "");

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error =
      new Error("Firebase authorization required.");

    error.statusCode = 401;
    throw error;
  }

  try {
    return await adminAuth.verifyIdToken(
      match[1]
    );
  } catch {
    const error =
      new Error("Invalid Firebase authorization.");

    error.statusCode = 401;
    throw error;
  }
}

async function exchangeGoogleAuthorizationCode(code) {
  const {
    clientId,
    clientSecret,
  } = googleOAuthConfig();

  const body =
    new URLSearchParams({
      code: String(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri:
        GOOGLE_CALENDAR_CALLBACK_URL,
      grant_type: "authorization_code",
    });

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error_description ||
      json?.error ||
      "Google authorization-code exchange failed."
    );
  }

  return json;
}

async function refreshGoogleAccessToken(
  refreshToken
) {
  const {
    clientId,
    clientSecret,
  } = googleOAuthConfig();

  const body =
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: String(refreshToken),
      grant_type: "refresh_token",
    });

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const json = await response.json();

  if (!response.ok) {
    const error =
      new Error(
        json?.error_description ||
        json?.error ||
        "Google access-token refresh failed."
      );

    error.googleCode =
      json?.error || "";

    throw error;
  }

  return json;
}

async function googlePrimaryAccount(
  accessToken
) {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      "Google connected successfully, but Abide could not read the calendar list."
    );
  }

  const json = await response.json();

  const calendars =
    Array.isArray(json.items)
      ? json.items
      : [];

  const primary =
    calendars.find(
      (calendar) =>
        Boolean(calendar.primary)
    ) ||
    calendars[0];

  if (!primary?.id) {
    throw new Error(
      "Google did not return a primary calendar."
    );
  }

  return {
    accountId: String(primary.id),
    accountLabel:
      String(
        primary.summaryOverride ||
        primary.summary ||
        primary.id
      ),
  };
}

function googleOAuthErrorRedirect(message) {
  const params =
    new URLSearchParams({
      tab: "calendar",
      googleOAuth: "error",
      message:
        String(message || "")
          .slice(0, 300),
    });

  return `${ABIDE_APP_URL}/?${params.toString()}`;
}


/*
 * Starts Google's real web-server OAuth flow.
 *
 * The browser first authenticates to Abide/Firebase.
 * This endpoint creates a one-time state token tied to
 * that Firebase user, then returns Google's authorization URL.
 */
exports.googleCalendarStart = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: [
      GOOGLE_CALENDAR_OAUTH_SECRET,
    ],
  },
  async (req, res) => {
    setAbideCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({
        error: "POST required.",
      });
      return;
    }

    try {
      const user =
        await requireFirebaseUser(req);

      const {
        clientId,
      } = googleOAuthConfig();

      const state =
        crypto.randomBytes(32)
          .toString("hex");

      await googleOAuthStateRef(state).set({
        uid: user.uid,
        createdAt:
          FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
      });

      const params =
        new URLSearchParams({
          client_id: clientId,
          redirect_uri:
            GOOGLE_CALENDAR_CALLBACK_URL,
          response_type: "code",
          scope:
            GOOGLE_CALENDAR_SCOPE,

          // Critical: this tells Google we need a
          // refresh token for unattended access.
          access_type: "offline",

          // Force an explicit consent screen so a
          // refresh token is returned for this upgrade.
          prompt: "consent",

          include_granted_scopes: "true",
          state,
        });

      res.set(
        "Cache-Control",
        "no-store"
      );

      res.json({
        url:
          "https://accounts.google.com/o/oauth2/v2/auth?" +
          params.toString(),
      });
    } catch (error) {
      logger.error(
        "Google Calendar OAuth start failed.",
        error
      );

      res
        .status(error?.statusCode || 500)
        .json({
          error:
            error?.message ||
            "Could not start Google Calendar authorization.",
        });
    }
  }
);


/*
 * Google redirects here after consent.
 *
 * The authorization code is exchanged server-side.
 * The refresh token NEVER enters browser storage.
 */
exports.googleCalendarOAuthCallback =
  onRequest(
    {
      region: "us-central1",
      memory: "256MiB",
      timeoutSeconds: 60,
      secrets: [
        GOOGLE_CALENDAR_OAUTH_SECRET,
      ],
    },
    async (req, res) => {
      try {
        const code =
          String(req.query.code || "");

        const state =
          String(req.query.state || "");

        const providerError =
          String(req.query.error || "");

        if (providerError) {
          res.redirect(
            googleOAuthErrorRedirect(
              `Google authorization was not completed: ${providerError}`
            )
          );
          return;
        }

        if (!code || !state) {
          res.redirect(
            googleOAuthErrorRedirect(
              "Google did not return the required authorization information."
            )
          );
          return;
        }

        const stateRef =
          googleOAuthStateRef(state);

        const stateSnapshot =
          await stateRef.get();

        // State is single-use whether the flow
        // succeeds or fails.
        await stateRef.delete()
          .catch(() => {});

        if (!stateSnapshot.exists) {
          res.redirect(
            googleOAuthErrorRedirect(
              "This Google connection request expired or was already used."
            )
          );
          return;
        }

        const stateData =
          stateSnapshot.data();

        const age =
          Date.now() -
          Number(
            stateData.createdAtMs || 0
          );

        if (
          !stateData.uid ||
          age < 0 ||
          age > GOOGLE_OAUTH_STATE_TTL_MS
        ) {
          res.redirect(
            googleOAuthErrorRedirect(
              "This Google connection request expired. Try connecting again."
            )
          );
          return;
        }

        const tokens =
          await exchangeGoogleAuthorizationCode(
            code
          );

        if (!tokens.access_token) {
          throw new Error(
            "Google did not return an access token."
          );
        }

        const account =
          await googlePrimaryAccount(
            tokens.access_token
          );

        const accountRef =
          googlePrivateAccountRef(
            stateData.uid,
            account.accountId
          );

        const existingSnapshot =
          await accountRef.get();

        const existingRefreshToken =
          existingSnapshot.exists
            ? existingSnapshot.data()
                .refreshToken
            : "";

        const refreshToken =
          tokens.refresh_token ||
          existingRefreshToken;

        if (!refreshToken) {
          throw new Error(
            "Google did not return a refresh token. Reconnect and approve calendar access again."
          );
        }

        await accountRef.set(
          {
            provider: "google",
            accountId:
              account.accountId,
            accountLabel:
              account.accountLabel,

            // Private server-only credential.
            refreshToken,

            scope:
              tokens.scope ||
              GOOGLE_CALENDAR_SCOPE,

            connectedAt:
              existingSnapshot.exists
                ? (
                    existingSnapshot.data()
                      .connectedAt ||
                    FieldValue.serverTimestamp()
                  )
                : FieldValue.serverTimestamp(),

            refreshedAt:
              FieldValue.serverTimestamp(),

            expiresIn:
              Number(
                tokens.expires_in || 0
              ),
          },
          {
            merge: true,
          }
        );

        const params =
          new URLSearchParams({
            tab: "calendar",
            googleOAuth: "connected",
            googleAccountId:
              account.accountId,
          });

        res.redirect(
          `${ABIDE_APP_URL}/?${params.toString()}`
        );
      } catch (error) {
        logger.error(
          "Google Calendar OAuth callback failed.",
          error
        );

        res.redirect(
          googleOAuthErrorRedirect(
            error?.message ||
            "Google Calendar could not be connected."
          )
        );
      }
    }
  );


/*
 * Returns a fresh short-lived access token.
 *
 * The browser never receives the refresh token.
 * Every time an access token expires, Abide can
 * silently call this endpoint and get another one.
 */
exports.googleCalendarToken = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: [
      GOOGLE_CALENDAR_OAUTH_SECRET,
    ],
  },
  async (req, res) => {
    setAbideCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({
        error: "POST required.",
      });
      return;
    }

    try {
      const user =
        await requireFirebaseUser(req);

      const accountId =
        String(
          req.body?.accountId || ""
        );

      if (!accountId) {
        res.status(400).json({
          error:
            "Google account ID required.",
        });
        return;
      }

      const accountRef =
        googlePrivateAccountRef(
          user.uid,
          accountId
        );

      const snapshot =
        await accountRef.get();

      if (!snapshot.exists) {
        res.status(404).json({
          error:
            "This Google account has not completed persistent authorization.",
          reconnectRequired: true,
        });
        return;
      }

      const data =
        snapshot.data();

      if (!data.refreshToken) {
        res.status(409).json({
          error:
            "This Google account does not have a stored refresh token.",
          reconnectRequired: true,
        });
        return;
      }

      try {
        const tokens =
          await refreshGoogleAccessToken(
            data.refreshToken
          );

        await accountRef.set(
          {
            lastAccessTokenRefresh:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        res.set(
          "Cache-Control",
          "no-store"
        );

        res.json({
          accessToken:
            tokens.access_token,
          expiresIn:
            Number(
              tokens.expires_in || 0
            ),
          accountId,
        });
      } catch (refreshError) {
        logger.warn(
          `Google token refresh failed for ${user.uid}/${accountId}.`,
          refreshError
        );

        res.status(401).json({
          error:
            "Google Calendar authorization needs attention.",
          reconnectRequired: true,
        });
      }
    } catch (error) {
      logger.error(
        "Google Calendar token endpoint failed.",
        error
      );

      res
        .status(error?.statusCode || 500)
        .json({
          error:
            error?.message ||
            "Could not refresh Google Calendar access.",
        });
    }
  }
);


/*
 * Explicit disconnect.
 *
 * This best-effort revokes the Google grant and
 * always removes Abide's stored refresh token.
 */
exports.googleCalendarDisconnect =
  onRequest(
    {
      region: "us-central1",
      memory: "256MiB",
      timeoutSeconds: 60,
      secrets: [
        GOOGLE_CALENDAR_OAUTH_SECRET,
      ],
    },
    async (req, res) => {
      setAbideCors(req, res);

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({
          error: "POST required.",
        });
        return;
      }

      try {
        const user =
          await requireFirebaseUser(req);

        const accountId =
          String(
            req.body?.accountId || ""
          );

        if (!accountId) {
          res.status(400).json({
            error:
              "Google account ID required.",
          });
          return;
        }

        const ref =
          googlePrivateAccountRef(
            user.uid,
            accountId
          );

        const snapshot =
          await ref.get();

        if (snapshot.exists) {
          const refreshToken =
            snapshot.data()
              .refreshToken;

          if (refreshToken) {
            try {
              await fetch(
                "https://oauth2.googleapis.com/revoke?" +
                  new URLSearchParams({
                    token:
                      refreshToken,
                  }).toString(),
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/x-www-form-urlencoded",
                  },
                }
              );
            } catch {}
          }

          await ref.delete();
        }

        res.json({
          disconnected: true,
        });
      } catch (error) {
        logger.error(
          "Google Calendar disconnect failed.",
          error
        );

        res
          .status(error?.statusCode || 500)
          .json({
            error:
              error?.message ||
              "Could not disconnect Google Calendar.",
          });
      }
    }
  );


exports.sendTaskReminders = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "UTC",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 120,
    maxInstances: 1,
  },
  async () => {
    const runStarted = DateTime.utc();

    /*
     * Query every synced task-state document.
     * Each matching document belongs to one user.
     */
    const [
      taskStates,
      eventStates,
      inlineReminderStates,
    ] = await Promise.all([
      db
        .collectionGroup("syncState")
        .where("key", "==", TASK_STATE_KEY)
        .get(),

      db
        .collectionGroup("syncState")
        .where("key", "==", EVENT_STATE_KEY)
        .get(),

      db
        .collectionGroup("syncState")
        .where("key", "==", INLINE_REMINDER_STATE_KEY)
        .get(),
    ]);

    logger.info(
      `Reminder scheduler checking ${taskStates.size} task state document(s), ${eventStates.size} event state document(s), and ${inlineReminderStates.size} inline reminder state document(s).`
    );

    let remindersSent = 0;

    for (const taskStateDoc of taskStates.docs) {
      const userRef = taskStateDoc.ref.parent.parent;

      if (!userRef) continue;

      const uid = userRef.id;
      const taskState = taskStateDoc.data();

      const tasks = parseJson(taskState.value, []);

      if (!Array.isArray(tasks) || !tasks.length) {
        continue;
      }

      /*
       * Respect the existing Abide notification preference.
       */
      const prefsRef = taskStateDoc.ref.parent.doc(
        encodeURIComponent(PREF_STATE_KEY)
      );

      const prefsSnapshot = await prefsRef.get();

      if (prefsSnapshot.exists) {
        const prefs = parseJson(
          prefsSnapshot.data().value,
          {}
        );

        if (prefs.tasks === false) {
          continue;
        }
      }

      /*
       * Load enabled devices for this user.
       */
      const devicesSnapshot = await userRef
        .collection("pushDevices")
        .where("enabled", "==", true)
        .get();

      if (devicesSnapshot.empty) {
        continue;
      }

      const enabledDevices = devicesSnapshot.docs.filter(
        (document) => Boolean(document.data().token)
      );

      if (!enabledDevices.length) {
        continue;
      }

      /*
       * Use the registered device timezone.
       *
       * Older device registrations may not have timezone yet, so
       * America/Chicago is the compatibility fallback for this Abide build.
       */
      const timezone =
        enabledDevices
          .map((document) => document.data().timezone)
          .find(validTimezone) ||
        DEFAULT_TIMEZONE;

      /*
       * FCM supports up to 500 registration tokens per multicast call.
       * Abide is far below that today, but keeping the cap makes this safe.
       */
      const deviceDocs = enabledDevices.slice(0, 500);
      const tokens = deviceDocs.map(
        (document) => document.data().token
      );

      for (const task of tasks) {
        if (!task || task.done) continue;

        const dueMoment = taskDueMoment(task, timezone);

        // A task with an explicit due time always gets a due-now
        // notification, even if its reminder is None or earlier.
        if (dueMoment && dueMoment.isValid) {
          const dueMs = dueMoment.toMillis();
          const dueNowMs = Date.now();

          if (
            dueMs <= dueNowMs + 30 * 1000 &&
            dueMs >= dueNowMs - 10 * 60 * 1000
          ) {
            const dueClaim = await claimDelivery(
              uid,
              task,
              dueMoment,
              "due"
            );

            if (dueClaim.claimed) {
              const taskTitle =
                String(task.title || "").trim() ||
                "Task";

              try {
                const dueResult =
                  await messaging.sendEachForMulticast({
                    tokens,

                    data: {
                      title: `Due now: ${taskTitle}`,
                      body: `Scheduled for ${dueMoment.toFormat("h:mm a")}.`,
                      url: `/?tab=reminders&taskId=${encodeURIComponent(String(task.id))}`,
                      tag: `abide-task-due-${String(task.id)}`,
                      taskId: String(task.id),
                    },

                    webpush: {
                      headers: {
                        Urgency: "high",
                      },
                    },
                  });

                await cleanInvalidTokens(
                  deviceDocs,
                  dueResult.responses
                );

                if (dueResult.successCount > 0) {
                  await markDeliverySent(
                    dueClaim.ref,
                    dueResult
                  );

                  remindersSent += 1;

                  logger.info(
                    `Sent due-time notification for task ${task.id} to ${dueResult.successCount} device(s).`
                  );
                } else {
                  const dueError =
                    dueResult.responses.find(
                      (response) => !response.success
                    )?.error?.message ||
                    "FCM returned no successful deliveries.";

                  await markDeliveryFailed(
                    dueClaim.ref,
                    dueError
                  );

                  logger.warn(
                    `Due-time notification for task ${task.id} was not delivered: ${dueError}`
                  );
                }
              } catch (error) {
                await markDeliveryFailed(
                  dueClaim.ref,
                  error?.message
                );

                logger.error(
                  `Due-time delivery failed for ${task.id}.`,
                  error
                );
              }
            }
          }
        }

        if (!task.reminder || task.reminder === "None") continue;

        const moment = reminderMoment(task, timezone);

        if (!moment || !moment.isValid) continue;

        // If the selected reminder lands in the exact same minute as
        // the due time, the due-now notification above is enough.
        if (
          dueMoment &&
          Math.abs(moment.toMillis() - dueMoment.toMillis()) < 60000
        ) {
          continue;
        }

        const reminderMs = moment.toMillis();
        const nowMs = Date.now();

        /*
         * Every-minute scheduler with a 10-minute recovery window.
         *
         * Normal delivery should happen within roughly a minute.
         * If Cloud Scheduler or Functions briefly stalls, the next run
         * can still deliver a reminder up to 10 minutes late.
         *
         * The reminderDeliveries ledger prevents duplicate sends.
         */
        if (reminderMs > nowMs + 30 * 1000) {
          continue;
        }

        if (reminderMs < nowMs - 10 * 60 * 1000) {
          continue;
        }

        const claim = await claimDelivery(
          uid,
          task,
          moment
        );

        if (!claim.claimed) {
          continue;
        }

        const taskTitle =
          String(task.title || "").trim() ||
          "Task";

        const title = `Reminder: ${taskTitle}`;

        const body = notificationBody(
          task,
          moment,
          timezone
        );

        try {
          const result =
            await messaging.sendEachForMulticast({
              tokens,

              /*
               * Data-only Web Push.
               *
               * public/push-handler.js receives this even while the
               * Abide UI is closed and creates the visible notification.
               */
              data: {
                title,
                body,
                url: `/?tab=reminders&taskId=${encodeURIComponent(String(task.id))}`,
                tag: `abide-task-${String(task.id)}`,
                taskId: String(task.id),
              },

              webpush: {
                headers: {
                  Urgency: "high",
                },
              },
            });

          await cleanInvalidTokens(
            deviceDocs,
            result.responses
          );

          if (result.successCount > 0) {
            await markDeliverySent(
              claim.ref,
              result
            );

            remindersSent += 1;

            logger.info(
              `Sent reminder for task ${task.id} to ${result.successCount} device(s).`
            );
          } else {
            const firstError =
              result.responses.find(
                (response) => !response.success
              )?.error?.message ||
              "FCM returned no successful deliveries.";

            await markDeliveryFailed(
              claim.ref,
              firstError
            );

            logger.warn(
              `Reminder for task ${task.id} was not delivered: ${firstError}`
            );
          }
        } catch (error) {
          await markDeliveryFailed(
            claim.ref,
            error?.message
          );

          logger.error(
            `Reminder delivery failed for ${task.id}.`,
            error
          );
        }
      }
    }

    // ---------------------------------------------------------
    // CALENDAR EVENT START NOTIFICATIONS
    // ---------------------------------------------------------

    for (const eventStateDoc of eventStates.docs) {
      const userRef = eventStateDoc.ref.parent.parent;

      if (!userRef) continue;

      const uid = userRef.id;

      const events = parseJson(
        eventStateDoc.data().value,
        []
      );

      if (!Array.isArray(events) || !events.length) {
        continue;
      }

      // Respect the Calendar event alerts preference.
      const prefsRef = eventStateDoc.ref.parent.doc(
        encodeURIComponent(PREF_STATE_KEY)
      );

      const prefsSnapshot = await prefsRef.get();

      if (prefsSnapshot.exists) {
        const prefs = parseJson(
          prefsSnapshot.data().value,
          {}
        );

        if (prefs.calendar === false) {
          continue;
        }
      }

      const devicesSnapshot = await userRef
        .collection("pushDevices")
        .where("enabled", "==", true)
        .get();

      if (devicesSnapshot.empty) {
        continue;
      }

      const enabledDevices = devicesSnapshot.docs.filter(
        (document) => Boolean(document.data().token)
      );

      if (!enabledDevices.length) {
        continue;
      }

      const timezone =
        enabledDevices
          .map((document) => document.data().timezone)
          .find(validTimezone) ||
        DEFAULT_TIMEZONE;

      const deviceDocs = enabledDevices.slice(0, 500);

      const tokens = deviceDocs.map(
        (document) => document.data().token
      );

      for (const event of events) {
        if (!event || !event.id) continue;

        const startMoment = eventStartMoment(
          event,
          timezone
        );

        // All-day events return null and stay quiet.
        if (!startMoment || !startMoment.isValid) {
          continue;
        }

        const startMs = startMoment.toMillis();
        const nowMs = Date.now();

        if (startMs > nowMs + 30 * 1000) {
          continue;
        }

        if (startMs < nowMs - 10 * 60 * 1000) {
          continue;
        }

        const claim = await claimDelivery(
          uid,
          event,
          startMoment,
          "event-start"
        );

        if (!claim.claimed) {
          continue;
        }

        const eventTitle =
          String(event.title || "").trim() ||
          "Event";

        const calendarLabel =
          event.calendarLabel ||
          (
            event.source === "google"
              ? "Google Calendar"
              : event.source === "microsoft"
                ? "Outlook Calendar"
                : "Abide"
          );

        try {
          const result =
            await messaging.sendEachForMulticast({
              tokens,

              data: {
                title: `Starting now: ${eventTitle}`,
                body: `${calendarLabel} event is starting now.`,
                url: `/?tab=calendar&eventId=${encodeURIComponent(
                  String(event.id)
                )}&date=${encodeURIComponent(
                  String(event.date || "")
                )}`,
                tag: `abide-event-start-${String(event.id)}`,
                eventId: String(event.id),
              },

              webpush: {
                headers: {
                  Urgency: "high",
                },
              },
            });

          await cleanInvalidTokens(
            deviceDocs,
            result.responses
          );

          if (result.successCount > 0) {
            await markDeliverySent(
              claim.ref,
              result
            );

            remindersSent += 1;

            logger.info(
              `Sent start-time notification for event ${event.id} to ${result.successCount} device(s).`
            );
          } else {
            const firstError =
              result.responses.find(
                (response) => !response.success
              )?.error?.message ||
              "FCM returned no successful deliveries.";

            await markDeliveryFailed(
              claim.ref,
              firstError
            );

            logger.warn(
              `Start-time notification for event ${event.id} was not delivered: ${firstError}`
            );
          }
        } catch (error) {
          await markDeliveryFailed(
            claim.ref,
            error?.message
          );

          logger.error(
            `Event start-time delivery failed for ${event.id}.`,
            error
          );
        }
      }
    }


    // ---------------------------------------------------------
    // INLINE / EDITOR REMINDERS
    //
    // Created through:
    //   @remind tomorrow at 3pm
    //   /reminder
    //
    // These are synced through the same syncState system as
    // Abide tasks and can therefore use the existing FCM
    // background-delivery infrastructure.
    // ---------------------------------------------------------

    for (const inlineStateDoc of inlineReminderStates.docs) {
      const userRef =
        inlineStateDoc.ref.parent.parent;

      if (!userRef) {
        continue;
      }

      const uid =
        userRef.id;

      const reminders =
        parseJson(
          inlineStateDoc.data().value,
          []
        );

      if (
        !Array.isArray(reminders) ||
        !reminders.length
      ) {
        continue;
      }


      // Inline reminders use Abide's existing task-reminder
      // notification preference.
      const prefsRef =
        inlineStateDoc.ref.parent.doc(
          encodeURIComponent(
            PREF_STATE_KEY
          )
        );

      const prefsSnapshot =
        await prefsRef.get();

      if (prefsSnapshot.exists) {
        const prefs =
          parseJson(
            prefsSnapshot.data().value,
            {}
          );

        if (prefs.tasks === false) {
          continue;
        }
      }


      const devicesSnapshot =
        await userRef
          .collection("pushDevices")
          .where("enabled", "==", true)
          .get();

      if (devicesSnapshot.empty) {
        continue;
      }


      const enabledDevices =
        devicesSnapshot.docs.filter(
          (document) =>
            Boolean(
              document.data().token
            )
        );

      if (!enabledDevices.length) {
        continue;
      }


      const deviceTimezone =
        enabledDevices
          .map(
            (document) =>
              document.data().timezone
          )
          .find(validTimezone) ||
        DEFAULT_TIMEZONE;


      const deviceDocs =
        enabledDevices.slice(
          0,
          500
        );

      const tokens =
        deviceDocs.map(
          (document) =>
            document.data().token
        );


      for (const reminder of reminders) {
        if (
          !reminder ||
          !reminder.id ||
          reminder.disabled ||
          !reminder.fireDateKey ||
          !reminder.fireTime
        ) {
          continue;
        }


        const timezone =
          validTimezone(
            reminder.timeZone
          )
            ? reminder.timeZone
            : deviceTimezone;


        const moment =
          DateTime.fromISO(
            `${reminder.fireDateKey}T${reminder.fireTime}`,
            {
              zone: timezone,
            }
          );


        if (
          !moment.isValid
        ) {
          continue;
        }


        const reminderMs =
          moment.toMillis();

        const nowMs =
          Date.now();


        // Same recovery window used for task and event reminders.
        if (
          reminderMs >
          nowMs + 30 * 1000
        ) {
          continue;
        }


        if (
          reminderMs <
          nowMs - 10 * 60 * 1000
        ) {
          continue;
        }


        const deliveryItem = {
          id:
            `inline:${String(reminder.id)}`,
        };


        const claim =
          await claimDelivery(
            uid,
            deliveryItem,
            moment,
            "inline-reminder"
          );


        if (!claim.claimed) {
          continue;
        }


        const title =
          String(
            reminder.title ||
            ""
          ).trim() ||
          "Reminder";


        let targetBody =
          "It's time for this reminder.";


        if (
          reminder.dateKey
        ) {
          const targetTime =
            reminder.time ||
            "09:00";

          const target =
            DateTime.fromISO(
              `${reminder.dateKey}T${targetTime}`,
              {
                zone: timezone,
              }
            );

          if (target.isValid) {
            targetBody =
              `For ${target.toFormat(
                "MMM d 'at' h:mm a"
              )}.`;
          }
        }


        try {
          const result =
            await messaging.sendEachForMulticast({
              tokens,

              data: {
                title:
                  `Reminder: ${title}`,

                body:
                  targetBody,

                url:
                  `/?tab=reminders&inlineReminderId=${encodeURIComponent(
                    String(reminder.id)
                  )}`,

                tag:
                  `abide-inline-reminder-${String(reminder.id)}`,

                inlineReminderId:
                  String(reminder.id),
              },

              webpush: {
                headers: {
                  Urgency:
                    "high",
                },
              },
            });


          await cleanInvalidTokens(
            deviceDocs,
            result.responses
          );


          if (
            result.successCount >
            0
          ) {
            await markDeliverySent(
              claim.ref,
              result
            );

            remindersSent += 1;

            logger.info(
              `Sent inline reminder ${reminder.id} to ${result.successCount} device(s).`
            );
          } else {
            const firstError =
              result.responses.find(
                (response) =>
                  !response.success
              )?.error?.message ||
              "FCM returned no successful deliveries.";


            await markDeliveryFailed(
              claim.ref,
              firstError
            );


            logger.warn(
              `Inline reminder ${reminder.id} was not delivered: ${firstError}`
            );
          }
        } catch (error) {
          await markDeliveryFailed(
            claim.ref,
            error?.message
          );


          logger.error(
            `Inline reminder delivery failed for ${reminder.id}.`,
            error
          );
        }
      }
    }

    logger.info(
      `Reminder scheduler finished. Sent ${remindersSent} reminder(s).`,
      {
        startedAt: runStarted.toISO(),
        finishedAt: DateTime.utc().toISO(),
      }
    );
  }
);
