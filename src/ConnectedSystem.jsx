import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";


function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}


function readStorage(key, fallback) {
  try {
    const value = safeParse(
      localStorage.getItem(key),
      fallback
    );

    return value == null
      ? fallback
      : value;
  } catch {
    return fallback;
  }
}


function writeStorage(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    window.dispatchEvent(
      new CustomEvent(
        "abide-local-data-changed",
        {
          detail: {
            key,
            value,
          },
        }
      )
    );

    return true;
  } catch (error) {
    console.warn(
      "Abide storage write failed:",
      error
    );

    return false;
  }
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function dateKeyToday() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function shiftDateKey(
  dateKey,
  amount
) {
  const d =
    new Date(
      `${dateKey}T12:00:00`
    );

  d.setDate(
    d.getDate() + amount
  );

  const year =
    d.getFullYear();

  const month =
    String(
      d.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      d.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDate(dateKey) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(dateKey || "")
    )
  ) {
    return String(dateKey || "");
  }

  const d =
    new Date(
      `${dateKey}T12:00:00`
    );

  return d.toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year:
        d.getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    }
  );
}


function referenceToken(item) {
  return `@[${item.label}](abide:${item.type}:${item.id})`;
}


function referenceHtml(item) {
  return `<span
    class="abide-mention"
    data-abide-type="${escapeHtml(item.type)}"
    data-abide-id="${escapeHtml(item.id)}"
    data-abide-label="${escapeHtml(item.label)}"
    contenteditable="false"
  >@${escapeHtml(item.label)}</span>&nbsp;`;
}


function normalizeCollection(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.entries(
      value
    ).map(
      ([id, item]) => ({
        id,
        ...item,
      })
    );
  }

  return [];
}


function allStorageEntries() {
  const entries = [];

  try {
    for (
      let i = 0;
      i < localStorage.length;
      i += 1
    ) {
      const key =
        localStorage.key(i);

      if (!key) continue;

      const value =
        safeParse(
          localStorage.getItem(key),
          null
        );

      entries.push({
        key,
        value,
      });
    }
  } catch {}

  return entries;
}


export function getAbideReferenceCatalog() {
  const results = [];
  const seen =
    new Set();

  const add = (item) => {
    if (
      !item?.type ||
      item?.id == null ||
      !item?.label
    ) {
      return;
    }

    const unique =
      `${item.type}:${item.id}`;

    if (
      seen.has(unique)
    ) {
      return;
    }

    seen.add(unique);
    results.push(item);
  };


  // ----------------------------------------------------------
  // TASKS
  // ----------------------------------------------------------

  const tasks =
    readStorage(
      "abide-tasks",
      []
    );

  normalizeCollection(
    tasks
  ).forEach((task) => {
    add({
      type: "task",
      id: task.id,
      label:
        task.title ||
        "Untitled task",
      meta: [
        task.done
          ? "Completed"
          : "Task",
        task.dueDate
          ? formatDate(
              task.dueDate
            )
          : "",
        task.dueTime || "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  });


  // ----------------------------------------------------------
  // EVENTS
  // ----------------------------------------------------------

  const events =
    readStorage(
      "abide-calendar-events",
      []
    );

  normalizeCollection(
    events
  ).forEach((event) => {
    add({
      type: "event",
      id: event.id,
      label:
        event.title ||
        "Untitled event",
      meta: [
        "Event",
        event.date
          ? formatDate(
              event.date
            )
          : "",
        event.time || "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  });


  // ----------------------------------------------------------
  // SCAN OTHER ABIDE COLLECTIONS
  // ----------------------------------------------------------

  allStorageEntries()
    .filter(
      ({ key }) =>
        key.startsWith(
          "abide"
        )
    )
    .forEach(
      ({
        key,
        value,
      }) => {
        const lower =
          key.toLowerCase();

        if (
          lower.includes(
            "draft"
          )
        ) {
          return;
        }

        const collection =
          normalizeCollection(
            value
          );

        if (
          lower.includes(
            "goal"
          )
        ) {
          collection.forEach(
            (item) => {
              add({
                type: "goal",
                id:
                  item.id ||
                  item.key,
                label:
                  item.title ||
                  item.name ||
                  "Goal",
                meta: "Goal",
              });
            }
          );
        }

        if (
          lower.includes(
            "area"
          )
        ) {
          collection.forEach(
            (item) => {
              add({
                type: "area",
                id:
                  item.id ||
                  item.key,
                label:
                  item.name ||
                  item.title ||
                  "Area",
                meta: "Area",
              });
            }
          );
        }

        if (
          lower.includes(
            "journal"
          ) &&
          !lower.includes(
            "search"
          )
        ) {
          collection.forEach(
            (item, index) => {
              if (
                item.id == null
              ) {
                return;
              }

              const plain =
                stripHtml(
                  item.noteHtml ||
                  item.richTextHtml ||
                  item.note ||
                  item.ref ||
                  ""
                );

              add({
                type: "journal",
                id: item.id,
                label:
                  item.ref ||
                  plain.slice(
                    0,
                    55
                  ) ||
                  `Journal entry ${
                    index + 1
                  }`,
                meta: [
                  "Journal",
                  item.dateKey
                    ? formatDate(
                        item.dateKey
                      )
                    : item.date ||
                      "",
                ]
                  .filter(Boolean)
                  .join(" · "),
              });
            }
          );
        }
      }
    );


  // ----------------------------------------------------------
  // SCRATCH PAD
  // ----------------------------------------------------------

  const scratchPages =
    readStorage(
      "abide-scratch-pages",
      []
    );

  normalizeCollection(
    scratchPages
  ).forEach(
    (page, index) => {
      const plain =
        stripHtml(
          page.contentHtml ||
          page.content ||
          page.text ||
          ""
        );

      add({
        type: "scratch",
        id:
          page.id ||
          `scratch_${index}`,
        label:
          page.title ||
          plain.slice(
            0,
            55
          ) ||
          (
            page.type ===
            "draw"
              ? `Drawing ${
                  index + 1
                }`
              : `Scratch Pad ${
                  index + 1
                }`
          ),
        meta:
          page.type ===
          "draw"
            ? "Scratch Pad drawing"
            : "Scratch Pad note",
      });
    }
  );


  // ----------------------------------------------------------
  // DATES
  // ----------------------------------------------------------

  const today =
    dateKeyToday();

  const dateItems = [
    {
      id: "today",
      label: "Today",
      dateKey: today,
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      dateKey:
        shiftDateKey(
          today,
          1
        ),
    },
  ];

  for (
    let offset = 2;
    offset <= 7;
    offset += 1
  ) {
    const key =
      shiftDateKey(
        today,
        offset
      );

    const label =
      new Date(
        `${key}T12:00:00`
      ).toLocaleDateString(
        "en-US",
        {
          weekday: "long",
        }
      );

    dateItems.push({
      id: key,
      label,
      dateKey: key,
    });
  }

  dateItems.forEach(
    (item) =>
      add({
        type: "date",
        id: item.id,
        label:
          item.label,
        meta:
          formatDate(
            item.dateKey
          ),
        dateKey:
          item.dateKey,
      })
  );


  // ----------------------------------------------------------
  // TIMES
  // ----------------------------------------------------------

  [
    ["morning", "Morning", "09:00"],
    ["noon", "Noon", "12:00"],
    ["afternoon", "Afternoon", "15:00"],
    ["evening", "Evening", "19:00"],
  ].forEach(
    ([id, label, time]) =>
      add({
        type: "time",
        id,
        label,
        meta: time,
        time,
      })
  );


  return results;
}


function commandCatalog() {
  return [
    {
      id: "today",
      label: "Today",
      description:
        "Insert today's date",
      insert: () =>
        formatDate(
          dateKeyToday()
        ),
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      description:
        "Insert tomorrow's date",
      insert: () =>
        formatDate(
          shiftDateKey(
            dateKeyToday(),
            1
          )
        ),
    },
    {
      id: "date",
      label: "Date",
      description:
        "Insert a date field",
      insert: () =>
        "Date: ",
    },
    {
      id: "time",
      label: "Time",
      description:
        "Insert a time field",
      insert: () =>
        "Time: ",
    },
    {
      id: "task",
      label: "Task",
      description:
        "Insert a task planning line",
      insert: () =>
        "☐ Task: ",
    },
    {
      id: "event",
      label: "Event",
      description:
        "Insert an event planning line",
      insert: () =>
        "Event: ",
    },
    {
      id: "remind",
      label: "Reminder",
      description:
        "Insert reminder planning",
      insert: () =>
        "Reminder: ",
    },
    {
      id: "due",
      label: "Due date",
      description:
        "Insert a due date",
      insert: () =>
        "Due: ",
    },
    {
      id: "finish-by",
      label: "Finish by",
      description:
        "Insert a personal finish-by target",
      insert: () =>
        "Finish by: ",
    },
    {
      id: "repeat",
      label: "Repeat",
      description:
        "Insert recurrence planning",
      insert: () =>
        "Repeat: ",
    },
    {
      id: "priority",
      label: "Priority",
      description:
        "Insert priority planning",
      insert: () =>
        "Priority: ",
    },
    {
      id: "area",
      label: "Area",
      description:
        "Connect an Abide Area",
      insert: () =>
        "Area: @",
    },
    {
      id: "goal",
      label: "Goal",
      description:
        "Connect an Abide goal",
      insert: () =>
        "Goal: @",
    },
    {
      id: "checkbox",
      label: "Checkbox",
      description:
        "Insert a checklist item",
      insert: () =>
        "☐ ",
    },
    {
      id: "bullet",
      label: "Bullet",
      description:
        "Insert a bullet",
      insert: () =>
        "• ",
    },
    {
      id: "numbered",
      label: "Numbered list",
      description:
        "Insert a numbered item",
      insert: () =>
        "1. ",
    },
    {
      id: "heading",
      label: "Heading",
      description:
        "Insert a heading",
      insert: () =>
        "## ",
    },
    {
      id: "divider",
      label: "Divider",
      description:
        "Insert a divider",
      insert: () =>
        "\n────────────\n",
    },
    {
      id: "scratch",
      label: "Open Scratch Pad",
      description:
        "Go to Scratch Pad",
      action: () =>
        navigateToAbideItem(
          "scratch"
        ),
    },
    {
      id: "journal",
      label: "Open Journal",
      description:
        "Go to Journal",
      action: () =>
        navigateToAbideItem(
          "journal"
        ),
    },
    {
      id: "calendar",
      label: "Open Calendar",
      description:
        "Go to Calendar",
      action: () =>
        navigateToAbideItem(
          "calendar"
        ),
    },
  ];
}


export function navigateToAbideItem(
  type,
  id = "",
  extra = {}
) {
  const url =
    new URL(
      window.location.href
    );

  const setTab = (tab) => {
    url.searchParams.set(
      "tab",
      tab
    );
  };

  if (
    type === "task"
  ) {
    setTab("today");

    if (id) {
      url.searchParams.set(
        "taskId",
        id
      );
    }
  } else if (
    type === "event"
  ) {
    setTab("calendar");

    if (id) {
      url.searchParams.set(
        "eventId",
        id
      );
    }
  } else if (
    type === "journal"
  ) {
    setTab("journal");

    if (id) {
      url.searchParams.set(
        "journalId",
        id
      );
    }
  } else if (
    type === "scratch"
  ) {
    setTab("scratch");

    if (id) {
      url.searchParams.set(
        "scratchId",
        id
      );
    }
  } else if (
    type === "goal"
  ) {
    setTab("goals");

    if (id) {
      url.searchParams.set(
        "goalId",
        id
      );
    }
  } else if (
    type === "calendar"
  ) {
    setTab("calendar");
  } else if (
    type === "date"
  ) {
    setTab("calendar");

    if (
      extra.dateKey
    ) {
      url.searchParams.set(
        "date",
        extra.dateKey
      );
    }
  } else {
    setTab("today");
  }

  window.location.assign(
    `${url.pathname}${url.search}${url.hash}`
  );
}


export function extractAbideReferences(
  value
) {
  const text =
    String(value || "");

  const references = [];
  const seen =
    new Set();

  const tokenPattern =
    /abide:([a-z-]+):([A-Za-z0-9_.:-]+)/g;

  let match;

  while (
    (
      match =
        tokenPattern.exec(
          text
        )
    )
  ) {
    const unique =
      `${match[1]}:${match[2]}`;

    if (
      seen.has(unique)
    ) {
      continue;
    }

    seen.add(unique);

    references.push({
      type: match[1],
      id: match[2],
    });
  }

  return references;
}


function scratchPageType(
  pages
) {
  const existing =
    normalizeCollection(
      pages
    ).find(
      (page) =>
        page?.type &&
        page.type !== "draw"
    );

  return (
    existing?.type ||
    "typed"
  );
}


function formatTaskScratchHtml(
  item
) {
  const title =
    escapeHtml(
      item?.title ||
      "Untitled task"
    );

  const due =
    item?.dueDate
      ? formatDate(
          item.dueDate
        )
      : "";

  return `
    <h3>${title}</h3>

    <p>
      <span
        class="abide-mention"
        data-abide-type="task"
        data-abide-id="${escapeHtml(
          item?.id
        )}"
        data-abide-label="${title}"
        contenteditable="false"
      >@${title}</span>
    </p>

    ${
      due
        ? `<p><strong>Due:</strong> ${escapeHtml(
            due
          )}${
            item?.dueTime
              ? ` · ${escapeHtml(
                  item.dueTime
                )}`
              : ""
          }</p>`
        : ""
    }

    ${
      item?.targetDate
        ? `<p><strong>Finish by:</strong> ${escapeHtml(
            formatDate(
              item.targetDate
            )
          )}</p>`
        : ""
    }

    ${
      item?.priority
        ? `<p><strong>Priority:</strong> ${escapeHtml(
            item.priority
          )}</p>`
        : ""
    }

    ${
      item?.reminder &&
      item.reminder !==
        "None"
        ? `<p><strong>Reminder:</strong> ${escapeHtml(
            item.reminder
          )}</p>`
        : ""
    }

    ${
      item?.notes
        ? `<p><strong>Notes:</strong> ${escapeHtml(
            item.notes
          )}</p>`
        : ""
    }

    <h4>Working notes</h4>
    <p><br></p>
  `;
}


function formatEventScratchHtml(
  item
) {
  const title =
    escapeHtml(
      item?.title ||
      "Untitled event"
    );

  return `
    <h3>${title}</h3>

    <p>
      <span
        class="abide-mention"
        data-abide-type="event"
        data-abide-id="${escapeHtml(
          item?.id
        )}"
        data-abide-label="${title}"
        contenteditable="false"
      >@${title}</span>
    </p>

    ${
      item?.date
        ? `<p><strong>Date:</strong> ${escapeHtml(
            formatDate(
              item.date
            )
          )}</p>`
        : ""
    }

    ${
      item?.time
        ? `<p><strong>Time:</strong> ${escapeHtml(
            item.time
          )}</p>`
        : ""
    }

    ${
      item?.notes
        ? `<p><strong>Notes:</strong> ${escapeHtml(
            item.notes
          )}</p>`
        : ""
    }

    <h4>Notes / agenda</h4>
    <p><br></p>
  `;
}


export function sendToScratchPad(
  item,
  kind
) {
  const pages =
    readStorage(
      "abide-scratch-pages",
      []
    );

  const current =
    normalizeCollection(
      pages
    );

  const now =
    Date.now();

  const html =
    kind === "event"
      ? formatEventScratchHtml(
          item
        )
      : formatTaskScratchHtml(
          item
        );

  const page = {
    id: now,
    type:
      scratchPageType(
        current
      ),
    title:
      item?.title ||
      (
        kind === "event"
          ? "Event Notes"
          : "Task Notes"
      ),
    content: html,
    contentHtml: html,
    createdAt: now,
    updatedAt: now,
    linkedRefs: [
      {
        type: kind,
        id:
          item?.id ||
          "",
        label:
          item?.title ||
          "",
      },
    ],
    source: {
      type: kind,
      id:
        item?.id ||
        "",
    },
  };

  const next = [
    page,
    ...current,
  ];

  writeStorage(
    "abide-scratch-pages",
    next
  );

  window.dispatchEvent(
    new CustomEvent(
      "abide-scratch-pad-created",
      {
        detail: {
          page,
          item,
          kind,
        },
      }
    )
  );

  return page;
}


export function sendToScratchPadAndOfferOpen(
  item,
  kind
) {
  const page =
    sendToScratchPad(
      item,
      kind
    );

  const open =
    window.confirm(
      `Sent "${page.title}" to Scratch Pad.\n\nOpen Scratch Pad now?`
    );

  if (open) {
    navigateToAbideItem(
      "scratch",
      page.id
    );
  }

  return page;
}


function textBeforeCursor(
  element
) {
  if (!element) {
    return "";
  }

  if (
    element instanceof
      HTMLInputElement ||
    element instanceof
      HTMLTextAreaElement
  ) {
    const end =
      element.selectionStart ??
      element.value.length;

    return element.value.slice(
      0,
      end
    );
  }

  if (
    element.isContentEditable
  ) {
    const selection =
      window.getSelection();

    if (
      !selection ||
      !selection.rangeCount
    ) {
      return "";
    }

    const range =
      selection
        .getRangeAt(0)
        .cloneRange();

    const before =
      range.cloneRange();

    before.selectNodeContents(
      element
    );

    before.setEnd(
      range.endContainer,
      range.endOffset
    );

    return before.toString();
  }

  return "";
}


function replaceToken(
  element,
  tokenLength,
  plainText,
  html = null
) {
  if (!element) return;

  if (
    element instanceof
      HTMLInputElement ||
    element instanceof
      HTMLTextAreaElement
  ) {
    const end =
      element.selectionStart ??
      element.value.length;

    const start =
      Math.max(
        0,
        end - tokenLength
      );

    const before =
      element.value.slice(
        0,
        start
      );

    const after =
      element.value.slice(
        end
      );

    element.value =
      before +
      plainText +
      after;

    const next =
      before.length +
      plainText.length;

    element.setSelectionRange(
      next,
      next
    );

    element.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true,
        }
      )
    );

    element.focus();
    return;
  }

  if (
    element.isContentEditable
  ) {
    const selection =
      window.getSelection();

    if (
      !selection ||
      !selection.rangeCount
    ) {
      return;
    }

    const range =
      selection.getRangeAt(0);

    const container =
      range.startContainer;

    if (
      container.nodeType ===
        Node.TEXT_NODE &&
      range.startOffset >=
        tokenLength
    ) {
      range.setStart(
        container,
        range.startOffset -
          tokenLength
      );

      range.deleteContents();
    }

    if (
      html &&
      document
        .queryCommandSupported?.(
          "insertHTML"
        )
    ) {
      document.execCommand(
        "insertHTML",
        false,
        html
      );
    } else {
      document.execCommand(
        "insertText",
        false,
        plainText
      );
    }

    element.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true,
        }
      )
    );

    element.focus();
  }
}


function ResultIcon({
  type,
  command,
}) {
  if (command) {
    return "⌘";
  }

  if (
    type === "task"
  ) {
    return "✓";
  }

  if (
    type === "event"
  ) {
    return "◫";
  }

  if (
    type === "journal"
  ) {
    return "▤";
  }

  if (
    type === "scratch"
  ) {
    return "✎";
  }

  if (
    type === "goal"
  ) {
    return "◎";
  }

  if (
    type === "date" ||
    type === "time"
  ) {
    return "◷";
  }

  return "@";
}


export function AbideCommandLayer() {
  const [state, setState] =
    useState(null);

  const [
    selectedIndex,
    setSelectedIndex,
  ] =
    useState(0);


  const refresh = (
    event
  ) => {
    const element =
      event?.target ||
      document.activeElement;

    if (!element) {
      setState(null);
      return;
    }

    const valid =
      element instanceof
        HTMLInputElement ||
      element instanceof
        HTMLTextAreaElement ||
      element.isContentEditable;

    if (!valid) {
      setState(null);
      return;
    }

    if (
      element instanceof
        HTMLInputElement &&
      [
        "date",
        "time",
        "datetime-local",
        "number",
        "color",
        "checkbox",
        "radio",
        "range",
      ].includes(
        element.type
      )
    ) {
      setState(null);
      return;
    }

    const before =
      textBeforeCursor(
        element
      );

    const match =
      before.match(
        /(?:^|\s)([@/])([^\s@/]*)$/
      );

    if (!match) {
      setState(null);
      return;
    }

    const trigger =
      match[1];

    const query =
      String(
        match[2] || ""
      )
        .toLowerCase()
        .trim();

    let results;

    if (
      trigger === "@"
    ) {
      results =
        getAbideReferenceCatalog()
          .filter(
            (item) => {
              if (!query) {
                return true;
              }

              return `${item.label} ${item.meta || ""} ${item.type}`
                .toLowerCase()
                .includes(
                  query
                );
            }
          )
          .slice(0, 24);
    } else {
      results =
        commandCatalog()
          .filter(
            (item) => {
              if (!query) {
                return true;
              }

              return `${item.id} ${item.label} ${item.description || ""}`
                .toLowerCase()
                .includes(
                  query
                );
            }
          )
          .slice(0, 24);
    }

    const rect =
      element
        .getBoundingClientRect();

    setSelectedIndex(0);

    setState({
      element,
      trigger,
      query,
      results,
      tokenLength:
        1 +
        String(
          match[2] || ""
        ).length,
      rect,
    });
  };


  useEffect(() => {
    const onInput = (
      event
    ) =>
      refresh(event);

    const onKeyUp = (
      event
    ) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "Enter",
          "Escape",
        ].includes(
          event.key
        )
      ) {
        return;
      }

      refresh(event);
    };

    const onMentionClick = (
      event
    ) => {
      const mention =
        event.target
          .closest?.(
            ".abide-mention"
          );

      if (!mention) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      navigateToAbideItem(
        mention.dataset
          .abideType,
        mention.dataset
          .abideId
      );
    };

    document.addEventListener(
      "input",
      onInput,
      true
    );

    document.addEventListener(
      "keyup",
      onKeyUp,
      true
    );

    document.addEventListener(
      "click",
      onMentionClick,
      true
    );

    return () => {
      document.removeEventListener(
        "input",
        onInput,
        true
      );

      document.removeEventListener(
        "keyup",
        onKeyUp,
        true
      );

      document.removeEventListener(
        "click",
        onMentionClick,
        true
      );
    };
  }, []);


  const choose = (
    item
  ) => {
    if (!state) {
      return;
    }

    if (
      state.trigger === "@"
    ) {
      replaceToken(
        state.element,
        state.tokenLength,
        referenceToken(
          item
        ) + " ",
        referenceHtml(
          item
        )
      );
    } else {
      if (
        item.action
      ) {
        replaceToken(
          state.element,
          state.tokenLength,
          ""
        );

        item.action();
      } else {
        replaceToken(
          state.element,
          state.tokenLength,
          typeof item.insert ===
            "function"
            ? item.insert()
            : ""
        );
      }
    }

    setState(null);
  };


  useEffect(() => {
    const onKeyDown = (
      event
    ) => {
      if (
        !state ||
        !state.results
          ?.length
      ) {
        return;
      }

      if (
        event.key ===
        "ArrowDown"
      ) {
        event.preventDefault();

        setSelectedIndex(
          (current) =>
            Math.min(
              current + 1,
              state.results
                .length - 1
            )
        );

        return;
      }

      if (
        event.key ===
        "ArrowUp"
      ) {
        event.preventDefault();

        setSelectedIndex(
          (current) =>
            Math.max(
              current - 1,
              0
            )
        );

        return;
      }

      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();

        choose(
          state.results[
            selectedIndex
          ]
        );

        return;
      }

      if (
        event.key ===
        "Escape"
      ) {
        event.preventDefault();
        setState(null);
      }
    };

    document.addEventListener(
      "keydown",
      onKeyDown,
      true
    );

    return () =>
      document.removeEventListener(
        "keydown",
        onKeyDown,
        true
      );
  }, [
    state,
    selectedIndex,
  ]);


  if (
    !state ||
    !state.results
      ?.length
  ) {
    return null;
  }


  const width =
    Math.min(
      360,
      window.innerWidth - 16
    );

  const left =
    Math.max(
      8,
      Math.min(
        state.rect.left,
        window.innerWidth -
          width -
          8
      )
    );

  const top =
    Math.max(
      58,
      Math.min(
        state.rect.bottom + 6,
        window.innerHeight -
          330
      )
    );


  return createPortal(
    <div
      className="abide-command-overlay"
      style={{
        top,
        left,
        width,
      }}
      onPointerDown={(
        event
      ) =>
        event.preventDefault()
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          padding:
            "6px 8px 8px",
          borderBottom:
            "1px solid var(--divider)",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color:
              "var(--text3)",
            letterSpacing:
              0.5,
          }}
        >
          {state.trigger ===
          "@"
            ? "@ CONNECT"
            : "/ COMMAND"}
        </div>

        <div
          style={{
            fontSize: 9,
            color:
              "var(--text3)",
          }}
        >
          ↑ ↓ · Enter
        </div>
      </div>

      {state.results.map(
        (item, index) => (
          <button
            type="button"
            key={`${item.type || "command"}:${item.id}`}
            className={`abide-command-result ${
              selectedIndex ===
              index
                ? "active"
                : ""
            }`}
            onPointerDown={(
              event
            ) => {
              event.preventDefault();
              choose(item);
            }}
          >
            <div
              style={{
                width: 27,
                height: 27,
                borderRadius: 8,
                background:
                  "var(--pillBg)",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                flexShrink: 0,
                color:
                  "var(--text2)",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              <ResultIcon
                type={
                  item.type
                }
                command={
                  state.trigger ===
                  "/"
                }
              />
            </div>

            <div
              style={{
                minWidth: 0,
                flex: 1,
              }}
            >
              <div
                className="abide-command-result-title"
              >
                {state.trigger ===
                "@"
                  ? "@"
                  : "/"}
                {item.label}
              </div>

              <div
                className="abide-command-result-meta"
              >
                {item.meta ||
                  item.description ||
                  item.type}
              </div>
            </div>
          </button>
        )
      )}
    </div>,
    document.body
  );
}
