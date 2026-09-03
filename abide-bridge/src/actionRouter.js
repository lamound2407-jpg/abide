import "dotenv/config";
import crypto from "node:crypto";
import {
  getAdminServices,
  resolveTargetUser
} from "./firebaseAdmin.js";

function compactAction(action) {
  const parts = [];

  if (action.intent) {
    parts.push(
      action.intent.replaceAll("_", " ")
    );
  }

  if (action.title) {
    parts.push(`“${action.title}”`);
  }

  if (action.target_person) {
    parts.push(
      `for ${action.target_person}`
    );
  }

  if (action.due_date) {
    parts.push(
      `on ${action.due_date}`
    );
  }

  if (action.due_time) {
    parts.push(
      `at ${action.due_time}`
    );
  }

  return parts.join(" ");
}

function normalizedTarget(action, actor) {
  const raw =
    String(
      action?.target_person ||
      "shared"
    )
      .trim()
      .toLowerCase();

  if (raw === "sender") {
    return actor;
  }

  if (
    raw === "tyler" ||
    raw === "elizabeth" ||
    raw === "shared"
  ) {
    return raw;
  }

  return "shared";
}

function validateCreateTask(action) {
  const title =
    String(action?.title || "").trim();

  if (!title) {
    throw new Error(
      "A task needs a title."
    );
  }

  const dueDate =
    String(
      action?.due_date || ""
    ).trim();

  if (
    dueDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dueDate
    )
  ) {
    throw new Error(
      "The task due date is invalid."
    );
  }

  const dueTime =
    String(
      action?.due_time || ""
    ).trim();

  if (
    dueTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      dueTime
    )
  ) {
    throw new Error(
      "The task due time is invalid."
    );
  }

  return {
    title,
    dueDate,
    dueTime
  };
}

async function queueTask({
  action,
  actor,
  originalMessage,
  source
}) {
  const {
    title,
    dueDate,
    dueTime
  } =
    validateCreateTask(action);

  const targetPerson =
    normalizedTarget(
      action,
      actor
    );

  const { uid } =
    await resolveTargetUser();

  const {
    db,
    FieldValue
  } =
    getAdminServices();

  const actionId =
    `bridge_${Date.now()}_${crypto
      .randomBytes(4)
      .toString("hex")}`;

  const ref =
    db
      .collection("users")
      .doc(uid)
      .collection("bridgeInbox")
      .doc(actionId);

  await ref.set({
    status: "pending",
    intent: "create_task",
    actor,
    source:
      source ||
      "message_bridge",
    originalMessage:
      String(
        originalMessage || ""
      ).trim(),
    action: {
      ...action,
      target_person:
        targetPerson,
      title,
      due_date:
        dueDate,
      due_time:
        dueTime,
      area:
        String(
          action?.area || ""
        )
    },
    createdAt:
      FieldValue.serverTimestamp()
  });

  return {
    actionId,
    targetPerson,
    title,
    dueDate,
    dueTime
  };
}

export async function routeAction({
  action,
  actor = "unknown",
  originalMessage = "",
  source = "simulator"
}) {
  if (
    action.status ===
    "needs_clarification"
  ) {
    return {
      complete: false,
      executed: false,
      reply:
        action.clarification_question ||
        "Can you tell me a little more?"
    };
  }

  if (
    action.status ===
      "no_action" ||
    action.intent ===
      "conversation" ||
    action.intent ===
      "unknown"
  ) {
    return {
      complete: true,
      executed: false,
      reply:
        action.confirmation ||
        "Got it."
    };
  }

  const dryRun =
    String(
      process.env
        .ABIDE_BRIDGE_DRY_RUN ||
      "true"
    ).toLowerCase() !==
    "false";

  if (
    dryRun ||
    action.intent !==
      "create_task"
  ) {
    const summary =
      compactAction(action);

    const reason =
      dryRun
        ? "Prototype only — it is not saved to Abide yet."
        : "This action type is not enabled for real writes yet.";

    return {
      complete: true,
      executed: false,
      action,
      reply:
        `I understood that as ${summary}. (${reason})`
    };
  }

  const queued =
    await queueTask({
      action,
      actor,
      originalMessage,
      source
    });

  const when = [
    queued.dueDate,
    queued.dueTime
  ]
    .filter(Boolean)
    .join(" at ");

  return {
    complete: true,
    executed: true,
    action,
    actionId:
      queued.actionId,
    reply:
      `Added “${queued.title}” to Abide for ${queued.targetPerson}` +
      (when ? ` (${when})` : "") +
      "."
  };
}
