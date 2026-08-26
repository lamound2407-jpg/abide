const crypto = require("crypto");

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

const { initializeApp } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const { DateTime } = require("luxon");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

const TASK_STATE_KEY = "abide-tasks";
const PREF_STATE_KEY = "abide-notification-prefs";

const DEFAULT_TIMEZONE = "America/Chicago";

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

function deliveryId(taskId, moment) {
  return crypto
    .createHash("sha256")
    .update(`${String(taskId)}|${moment.toUTC().toISO()}`)
    .digest("hex");
}

function notificationBody(task, moment, timezone) {
  const localMoment = moment.setZone(timezone);

  const reminderText =
    task.reminder === "Custom"
      ? `Custom reminder · ${localMoment.toFormat("MMM d 'at' h:mm a")}`
      : task.reminder;

  if (task.dueDate) {
    const dueTime = task.dueTime || "09:00";

    const due = DateTime.fromISO(
      `${task.dueDate}T${dueTime}`,
      { zone: timezone }
    );

    if (due.isValid) {
      return `${reminderText} · Due ${due.toFormat("MMM d 'at' h:mm a")}`;
    }
  }

  return reminderText || "You have an Abide reminder.";
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

async function claimDelivery(uid, task, moment) {
  const id = deliveryId(task.id, moment);

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
    const taskStates = await db
      .collectionGroup("syncState")
      .where("key", "==", TASK_STATE_KEY)
      .get();

    logger.info(
      `Reminder scheduler checking ${taskStates.size} task state document(s).`
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
        if (!task.reminder || task.reminder === "None") continue;

        const moment = reminderMoment(task, timezone);

        if (!moment || !moment.isValid) continue;

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

        const title =
          String(task.title || "").trim() ||
          "Abide reminder";

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
                url: "/",
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

    logger.info(
      `Reminder scheduler finished. Sent ${remindersSent} reminder(s).`,
      {
        startedAt: runStarted.toISO(),
        finishedAt: DateTime.utc().toISO(),
      }
    );
  }
);
