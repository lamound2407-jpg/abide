import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import {
  auth,
  storage,
} from "../firebase.js";

import {
  getAbideReferenceCatalog,
  parseAbideDateTime,
} from "../ConnectedSystem.jsx";


export const PAGES_KEY =
  "abide-pages";

export const COLLECTIONS_KEY =
  "abide-collections";

export const PEOPLE_KEY =
  "abide-people";

export const COMMENTS_KEY =
  "abide-block-comments";

export const SYNCED_KEY =
  "abide-synced-blocks";

export const INLINE_REMINDER_KEY =
  "abide-inline-reminders";

export const TASKS_KEY =
  "abide-tasks";


export function safeParse(
  value,
  fallback
) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}


export function readLocal(
  key,
  fallback
) {
  try {
    const value =
      safeParse(
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


export function writeLocal(
  key,
  value
) {
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
}


export function getAbideTasks() {
  const tasks =
    readLocal(
      TASKS_KEY,
      []
    );

  return Array.isArray(tasks)
    ? tasks
    : [];
}


export function getAbideTask(
  id
) {
  return (
    getAbideTasks().find(
      (task) =>
        String(task.id) ===
        String(id)
    ) || null
  );
}


export function createAbideTask({
  title = "",
  dueDate = "",
  dueTime = "",
} = {}) {
  const cleanTitle =
    String(title || "")
      .trim() ||
    "Untitled task";

  const now =
    Date.now();

  const task = {
    id:
      makeId("task"),

    title:
      cleanTitle,

    done:
      false,

    dueDate:
      dueDate || "",

    dueTime:
      dueTime || "",

    createdAt:
      now,

    updatedAt:
      now,
  };

  writeLocal(
    TASKS_KEY,
    [
      task,
      ...getAbideTasks(),
    ]
  );

  return task;
}


export function updateAbideTask(
  id,
  updates = {}
) {
  let updatedTask =
    null;

  const next =
    getAbideTasks().map(
      (task) => {
        if (
          String(task.id) !==
          String(id)
        ) {
          return task;
        }

        updatedTask = {
          ...task,
          ...updates,
          updatedAt:
            Date.now(),
        };

        return updatedTask;
      }
    );

  writeLocal(
    TASKS_KEY,
    next
  );

  return updatedTask;
}


export function makeId(
  prefix = "item"
) {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}


export function escapeHtml(
  value
) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


export function stripHtml(
  value
) {
  const holder =
    document.createElement("div");

  holder.innerHTML =
    String(value || "");

  return (
    holder.textContent ||
    holder.innerText ||
    ""
  );
}


export function todayKey() {
  const date =
    new Date();

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0"),
  ].join("-");
}


export function formatDate(
  key
) {
  const date =
    new Date(
      `${key}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return key;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}


export function formatTime(
  time
) {
  if (
    !/^\d{2}:\d{2}$/.test(
      String(time || "")
    )
  ) {
    return time || "";
  }

  const [
    hour,
    minute,
  ] =
    time
      .split(":")
      .map(Number);

  const date =
    new Date();

  date.setHours(
    hour,
    minute,
    0,
    0
  );

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}


const MONTHS = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};


function dateKeyFromDate(
  date
) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0"),
  ].join("-");
}


function parseMonthDay(
  input
) {
  const clean =
    String(input || "")
      .trim()
      .toLowerCase()
      .replace(/,/g, " ")
      .replace(
        /\b(\d{1,2})(st|nd|rd|th)\b/g,
        "$1"
      )
      .replace(/\s+/g, " ");

  const match =
    clean.match(
      /^(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:\s+(\d{4}))?(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/
    );

  if (!match) {
    return [];
  }

  const month =
    MONTHS[match[1]];

  const day =
    Number(match[2]);

  const explicitYear =
    match[3]
      ? Number(match[3])
      : null;

  let hour =
    match[4]
      ? Number(match[4])
      : null;

  const minute =
    Number(
      match[5] || 0
    );

  const ampm =
    match[6] || "";

  if (
    hour != null &&
    ampm
  ) {
    if (
      ampm === "pm" &&
      hour < 12
    ) {
      hour += 12;
    }

    if (
      ampm === "am" &&
      hour === 12
    ) {
      hour = 0;
    }
  }

  const time =
    hour == null
      ? ""
      : `${String(hour).padStart(2, "0")}:${String(
          minute
        ).padStart(2, "0")}`;

  const currentYear =
    new Date().getFullYear();

  const years =
    explicitYear
      ? [explicitYear]
      : [
          currentYear,
          currentYear + 1,
          currentYear - 1,
        ];

  return years
    .map((year) => {
      const date =
        new Date(
          year,
          month,
          day,
          12,
          0,
          0,
          0
        );

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
      ) {
        return null;
      }

      const key =
        dateKeyFromDate(date);

      return {
        type:
          time
            ? "datetime"
            : "date",

        id:
          time
            ? `${key}T${time}`
            : key,

        dateKey:
          key,

        time,

        label:
          time
            ? `${formatDate(key)} at ${formatTime(time)}`
            : formatDate(key),

        meta:
          explicitYear
            ? "Date"
            : key < todayKey()
              ? "Past date"
              : key > todayKey()
                ? "Future date"
                : "Today",
      };
    })
    .filter(Boolean);
}


export function naturalDateResults(
  query
) {
  const monthResults =
    parseMonthDay(query);

  if (
    monthResults.length
  ) {
    return monthResults;
  }

  const normalized =
    String(query || "")
      .replace(
        /\b(\d{1,2})(st|nd|rd|th)\b/gi,
        "$1"
      );

  const parsed =
    parseAbideDateTime(
      normalized
    );

  if (!parsed) {
    return [];
  }

  return [
    {
      type:
        parsed.time
          ? "datetime"
          : "date",

      id:
        parsed.time
          ? `${parsed.dateKey}T${parsed.time}`
          : parsed.dateKey,

      dateKey:
        parsed.dateKey,

      time:
        parsed.time || "",

      label:
        parsed.label,

      meta: "Date",
    },
  ];
}


export function dateMentionHtml(
  item
) {
  return `<span
    class="abide-mention"
    data-abide-type="${item.type}"
    data-abide-id="${escapeHtml(item.id)}"
    data-abide-date="${escapeHtml(item.dateKey)}"
    data-abide-time="${escapeHtml(item.time || "")}"
    contenteditable="false"
  >@${escapeHtml(item.label)}</span>&nbsp;`;
}


export function getPages() {
  return readLocal(
    PAGES_KEY,
    []
  ) || [];
}


export function createPage(
  title
) {
  const page = {
    id:
      makeId("page"),

    title:
      title || "Untitled",

    html:
      "<div><br></div>",

    createdAt:
      Date.now(),

    updatedAt:
      Date.now(),
  };

  writeLocal(
    PAGES_KEY,
    [
      page,
      ...getPages(),
    ]
  );

  return page;
}


export function updatePage(
  id,
  updates
) {
  writeLocal(
    PAGES_KEY,
    getPages().map(
      (page) =>
        page.id === id
          ? {
              ...page,
              ...updates,
              updatedAt:
                Date.now(),
            }
          : page
    )
  );
}


export function getPeople() {
  return readLocal(
    PEOPLE_KEY,
    []
  ) || [];
}


export function createPerson(
  name
) {
  const person = {
    id:
      makeId("person"),

    name,

    createdAt:
      Date.now(),
  };

  writeLocal(
    PEOPLE_KEY,
    [
      person,
      ...getPeople(),
    ]
  );

  return person;
}


export function getCollections() {
  return readLocal(
    COLLECTIONS_KEY,
    []
  ) || [];
}


export function getCollection(
  id
) {
  return (
    getCollections().find(
      (item) =>
        item.id === id
    ) ||
    null
  );
}


export function createCollection(
  name
) {
  const now =
    Date.now();

  const collection = {
    id:
      makeId("collection"),

    name:
      name ||
      "Untitled database",

    databaseVersion:
      2,

    properties: [
      {
        id: "title",
        name: "Name",
        type: "title",
        description: "",
        createdAt:
          new Date().toISOString(),
      },

      {
        id: "status",
        name: "Status",
        type: "status",
        description: "",

        options: [
          {
            id: "status-not-started",
            name: "Not started",
            color: "gray",
          },
          {
            id: "status-in-progress",
            name: "In progress",
            color: "blue",
          },
          {
            id: "status-complete",
            name: "Complete",
            color: "green",
          },
        ],

        createdAt:
          new Date().toISOString(),
      },

      {
        id: "date",
        name: "Date",
        type: "date",
        description: "",
        createdAt:
          new Date().toISOString(),
      },
    ],

    /*
     * Keep legacy columns during V2 transition.
     * Old clients / cloud copies will not crash.
     */
    columns: [
      {
        id: "name",
        name: "Name",
      },
      {
        id: "status",
        name: "Status",
      },
      {
        id: "date",
        name: "Date",
      },
    ],

    rows: [],

    views: [
      {
        id:
          makeId("view"),

        name:
          "Table",

        type:
          "table",

        filters:
          [],

        filterLogic:
          "and",

        sorts:
          [],

        groupBy:
          "",

        subGroupBy:
          "",

        visibleProperties: [
          "title",
          "status",
          "date",
        ],

        calendarBy:
          "date",

        timelineStart:
          "date",

        timelineEnd:
          "",

        chartGroupBy:
          "status",

        chartValue:
          "",

        chartAggregate:
          "count",

        wrapCells:
          false,

        frozenColumns:
          1,

        openPagesIn:
          "peek",
      },
    ],

    titlePropertyId:
      "title",

    createdAt:
      now,

    updatedAt:
      now,
  };

  writeLocal(
    COLLECTIONS_KEY,
    [
      collection,
      ...getCollections(),
    ]
  );

  return collection;
}


export function updateCollection(
  id,
  updater
) {
  writeLocal(
    COLLECTIONS_KEY,
    getCollections().map(
      (collection) =>
        collection.id === id
          ? {
              ...updater(
                collection
              ),
              updatedAt:
                Date.now(),
            }
          : collection
    )
  );
}


export function createInlineReminder({
  title,
  dateKey,
  time,
}) {
  const existing =
    readLocal(
      INLINE_REMINDER_KEY,
      []
    ) || [];

  const reminder = {
    id:
      makeId("inline"),

    title:
      title ||
      "Reminder",

    dateKey,

    time:
      time ||
      "09:00",

    leadMinutes: 0,

    fireDateKey:
      dateKey,

    fireTime:
      time ||
      "09:00",

    timeZone:
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "America/Chicago",

    createdAt:
      Date.now(),

    updatedAt:
      Date.now(),

    firedAt: null,
    disabled: false,
  };

  writeLocal(
    INLINE_REMINDER_KEY,
    [
      reminder,
      ...existing,
    ]
  );

  return reminder;
}


export function reminderMentionHtml(
  reminder
) {
  return `<span
    class="abide-mention"
    data-abide-type="reminder"
    data-abide-id="${escapeHtml(reminder.id)}"
    data-abide-date="${escapeHtml(reminder.dateKey)}"
    data-abide-time="${escapeHtml(reminder.time)}"
    contenteditable="false"
  >@${escapeHtml(reminder.title)}</span>&nbsp;`;
}


export function getWorkspaceMentionCatalog(
  query
) {
  const lower =
    String(query || "")
      .trim()
      .toLowerCase();

  const dates =
    lower
      ? naturalDateResults(query)
      : [];

  const pages =
    getPages().map(
      (page) => ({
        type: "page",
        id: page.id,
        label: page.title,
        meta: "Abide page",
      })
    );

  const people =
    getPeople().map(
      (person) => ({
        type: "person",
        id: person.id,
        label: person.name,
        meta: "Person",
      })
    );

  const collections =
    getCollections().map(
      (collection) => ({
        type: "collection",
        id: collection.id,
        label: collection.name,
        meta: "Collection",
      })
    );

  const base =
    getAbideReferenceCatalog();

  return [
    ...dates,
    ...base,
    ...pages,
    ...people,
    ...collections,
  ]
    .filter(
      (item) =>
        !lower ||
        dates.includes(item) ||
        `${item.label} ${item.meta || ""} ${item.type}`
          .toLowerCase()
          .includes(lower)
    )
    .filter(
      (
        item,
        index,
        list
      ) =>
        list.findIndex(
          (candidate) =>
            `${candidate.type}:${candidate.id}` ===
            `${item.type}:${item.id}`
        ) === index
    )
    .slice(0, 30);
}


export async function uploadWorkspaceFile(
  file
) {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Sign in to Abide before uploading files."
    );
  }

  const safeName =
    file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

  const target =
    storageRef(
      storage,
      `users/${user.uid}/blocks/${Date.now()}-${safeName}`
    );

  await uploadBytes(
    target,
    file,
    {
      contentType:
        file.type ||
        undefined,
    }
  );

  return getDownloadURL(
    target
  );
}


export function chooseFile(
  accept = "*/*"
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const input =
        document.createElement(
          "input"
        );

      input.type =
        "file";

      input.accept =
        accept;

      input.onchange =
        () => {
          const file =
            input.files?.[0];

          if (!file) {
            reject(
              new Error(
                "No file selected."
              )
            );

            return;
          }

          resolve(file);
        };

      input.click();
    }
  );
}

/* =========================================================
   BLOCK 2 — CORE BLOCK SYSTEM
   ========================================================= */

export const BLOCK_TYPES = Object.freeze({
  TEXT: "text",
  TODO: "todo",
  BULLETED_LIST: "bulleted_list",
  NUMBERED_LIST: "numbered_list",
  TOGGLE: "toggle",
  HEADING_1: "heading_1",
  HEADING_2: "heading_2",
  HEADING_3: "heading_3",
  QUOTE: "quote",
  DIVIDER: "divider",
  CALLOUT: "callout",

  PAGE_LINK: "page_link",
  EQUATION: "equation",
  CODE: "code",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  FILE: "file",
  PDF: "pdf",
  BOOKMARK: "bookmark",
  EMBED: "embed",
  DATABASE: "database",
});

export const CORE_BLOCK_TYPES = Object.freeze([
  BLOCK_TYPES.TEXT,
  BLOCK_TYPES.TODO,
  BLOCK_TYPES.BULLETED_LIST,
  BLOCK_TYPES.NUMBERED_LIST,
  BLOCK_TYPES.TOGGLE,
  BLOCK_TYPES.HEADING_1,
  BLOCK_TYPES.HEADING_2,
  BLOCK_TYPES.HEADING_3,
  BLOCK_TYPES.QUOTE,
  BLOCK_TYPES.DIVIDER,
  BLOCK_TYPES.CALLOUT,

  BLOCK_TYPES.PAGE_LINK,
  BLOCK_TYPES.EQUATION,
  BLOCK_TYPES.CODE,
  BLOCK_TYPES.IMAGE,
  BLOCK_TYPES.VIDEO,
  BLOCK_TYPES.AUDIO,
  BLOCK_TYPES.FILE,
  BLOCK_TYPES.PDF,
  BLOCK_TYPES.BOOKMARK,
  BLOCK_TYPES.EMBED,
  BLOCK_TYPES.DATABASE,
]);

export const SLASH_COMMANDS = Object.freeze([
  {
    id: "text",
    label: "Text",
    description: "Start writing with plain text.",
    aliases: ["text", "paragraph", "plain"],
    blockType: BLOCK_TYPES.TEXT,
  },
  {
    id: "checkbox",
    label: "Checkbox",
    description: "A simple checkbox that only lives in this note.",
    aliases: [
      "checkbox",
      "check",
      "checklist",
      "todo",
      "to-do"
    ],
    blockType: BLOCK_TYPES.TODO,
  },
  {
    id: "task",
    label: "Task",
    description: "Create a real task tracked throughout Abide.",
    aliases: [
      "task",
      "real task",
      "action",
      "action item"
    ],
    blockType: BLOCK_TYPES.TODO,
  },
  {
    id: "bulleted-list",
    label: "Bulleted list",
    description: "Create a simple bulleted list.",
    aliases: ["bullet", "bulleted", "unordered", "ul"],
    blockType: BLOCK_TYPES.BULLETED_LIST,
  },
  {
    id: "numbered-list",
    label: "Numbered list",
    description: "Create a numbered list.",
    aliases: ["number", "numbered", "ordered", "ol"],
    blockType: BLOCK_TYPES.NUMBERED_LIST,
  },
  {
    id: "toggle",
    label: "Toggle list",
    description: "Hide or reveal nested content.",
    aliases: ["toggle", "collapse", "details"],
    blockType: BLOCK_TYPES.TOGGLE,
  },
  {
    id: "heading-1",
    label: "Heading 1",
    description: "Large section heading.",
    aliases: ["h1", "heading1", "heading 1"],
    blockType: BLOCK_TYPES.HEADING_1,
  },
  {
    id: "heading-2",
    label: "Heading 2",
    description: "Medium section heading.",
    aliases: ["h2", "heading2", "heading 2"],
    blockType: BLOCK_TYPES.HEADING_2,
  },
  {
    id: "heading-3",
    label: "Heading 3",
    description: "Small section heading.",
    aliases: ["h3", "heading3", "heading 3"],
    blockType: BLOCK_TYPES.HEADING_3,
  },
  {
    id: "quote",
    label: "Quote",
    description: "Capture a quotation or highlighted thought.",
    aliases: ["quote", "blockquote"],
    blockType: BLOCK_TYPES.QUOTE,
  },
  {
    id: "divider",
    label: "Divider",
    description: "Separate sections visually.",
    aliases: ["divider", "line", "hr", "separator"],
    blockType: BLOCK_TYPES.DIVIDER,
  },
  {
    id: "callout",
    label: "Callout",
    description: "Highlight important information.",
    aliases: ["callout", "notice", "highlight"],
    blockType: BLOCK_TYPES.CALLOUT,
  },

  {
    id: "page",
    label: "Page",
    description: "Create a new Abide page.",
    aliases: [
      "page",
      "new page"
    ],
  },

  {
    id: "link-to-page",
    label: "Link to page",
    description: "Link this block to an existing Abide page.",
    aliases: [
      "link",
      "link page",
      "link to page"
    ],
  },

  {
    id: "mention-person",
    label: "Mention a person",
    description: "Mention a person from Abide.",
    aliases: [
      "person",
      "mention person"
    ],
  },

  {
    id: "mention-page",
    label: "Mention a page",
    description: "Mention an existing Abide page.",
    aliases: [
      "mention",
      "mention page"
    ],
  },

  {
    id: "date",
    label: "Date",
    description: "Insert a real date or date and time.",
    aliases: [
      "date",
      "datetime"
    ],
  },

  {
    id: "reminder",
    label: "Reminder",
    description: "Create a real Abide reminder.",
    aliases: [
      "reminder",
      "remind"
    ],
  },

  {
    id: "equation",
    label: "Equation",
    description: "Insert an equation block.",
    aliases: [
      "equation",
      "math"
    ],
    blockType:
      BLOCK_TYPES.EQUATION,
  },

  {
    id: "emoji",
    label: "Emoji",
    description: "Insert an emoji into your writing.",
    aliases: [
      "emoji",
      "icon"
    ],
  },

  {
    id: "image",
    label: "Image",
    description: "Upload and display an image.",
    aliases: [
      "image",
      "photo",
      "picture"
    ],
    blockType:
      BLOCK_TYPES.IMAGE,
  },

  {
    id: "video",
    label: "Video",
    description: "Upload and play a video.",
    aliases: [
      "video",
      "movie"
    ],
    blockType:
      BLOCK_TYPES.VIDEO,
  },

  {
    id: "audio",
    label: "Audio",
    description: "Upload and play an audio file.",
    aliases: [
      "audio",
      "sound"
    ],
    blockType:
      BLOCK_TYPES.AUDIO,
  },

  {
    id: "file",
    label: "File",
    description: "Upload and attach a file.",
    aliases: [
      "file",
      "attachment"
    ],
    blockType:
      BLOCK_TYPES.FILE,
  },

  {
    id: "pdf",
    label: "PDF",
    description: "Upload and display a PDF.",
    aliases: [
      "pdf"
    ],
    blockType:
      BLOCK_TYPES.PDF,
  },

  {
    id: "bookmark",
    label: "Web bookmark",
    description: "Save a web link as a bookmark.",
    aliases: [
      "bookmark",
      "book",
      "web"
    ],
    blockType:
      BLOCK_TYPES.BOOKMARK,
  },

  {
    id: "embed",
    label: "Embed",
    description: "Embed content from a web address.",
    aliases: [
      "embed",
      "iframe"
    ],
    blockType:
      BLOCK_TYPES.EMBED,
  },

  {
    id: "code",
    label: "Code block",
    description: "Write or paste formatted code.",
    aliases: [
      "code",
      "code block"
    ],
    blockType:
      BLOCK_TYPES.CODE,
  },

  {
    id: "table",
    label: "Table database",
    description: "Create a database in table view.",
    aliases: [
      "table",
      "database table"
    ],
  },

  {
    id: "board",
    label: "Board database",
    description: "Create a database in board view.",
    aliases: [
      "board",
      "kanban"
    ],
  },

  {
    id: "gallery",
    label: "Gallery database",
    description: "Create a database in gallery view.",
    aliases: [
      "gallery",
      "cards"
    ],
  },

  {
    id: "list-database",
    label: "List database",
    description: "Create a compact database list.",
    aliases: [
      "list database",
      "database list"
    ],
  },

  {
    id: "calendar-database",
    label: "Calendar database",
    description: "Create a date-based database view.",
    aliases: [
      "calendar",
      "calendar database"
    ],
  },

  {
    id: "timeline",
    label: "Timeline database",
    description: "Create a timeline database view.",
    aliases: [
      "timeline",
      "timeline database"
    ],
  },

  {
    id: "chart",
    label: "Chart",
    description: "Visualize records from a database.",
    aliases: [
      "chart",
      "database chart"
    ],
  },

  {
    id: "linked-database",
    label: "Linked database",
    description: "Display an existing database here.",
    aliases: [
      "linked database",
      "linked view",
      "linked"
    ],
  },
]);

function normalizeBlockType(type) {
  return CORE_BLOCK_TYPES.includes(type)
    ? type
    : BLOCK_TYPES.TEXT;
}

export function createBlock({
  id = makeId("block"),
  type = BLOCK_TYPES.TEXT,
  content = "",
  text,
  properties = {},
  parentId = null,
  order = 0,
  ...extra
} = {}) {
  const now =
    Date.now();

  const normalizedType =
    normalizeBlockType(type);

  const resolvedText =
    normalizedType ===
    BLOCK_TYPES.DIVIDER
      ? ""
      : String(
          text !== undefined
            ? text
            : content ?? ""
        );

  const defaultProperties = {
    [BLOCK_TYPES.TODO]: {
      checked: false,
    },

    [BLOCK_TYPES.TOGGLE]: {
      open: false,
    },

    [BLOCK_TYPES.CALLOUT]: {
      icon: "💡",
    },
  };

  const mergedProperties = {
    ...(defaultProperties[
      normalizedType
    ] || {}),

    ...(properties || {}),
  };

  return {
    ...extra,

    id,
    type:
      normalizedType,

    /*
     * `text` is the live workspace field.
     * `content` remains synchronized for
     * compatibility with the older block core.
     */
    text:
      resolvedText,

    content:
      resolvedText,

    properties:
      mergedProperties,

    parentId,

    order:
      Number.isFinite(
        Number(order)
      )
        ? Number(order)
        : 0,

    checked:
      normalizedType ===
      BLOCK_TYPES.TODO
        ? Boolean(
            extra.checked ??
            mergedProperties.checked
          )
        : extra.checked,

    open:
      normalizedType ===
      BLOCK_TYPES.TOGGLE
        ? (
            extra.open ??
            mergedProperties.open ??
            false
          )
        : extra.open,

    icon:
      normalizedType ===
      BLOCK_TYPES.CALLOUT
        ? (
            extra.icon ??
            mergedProperties.icon ??
            "💡"
          )
        : extra.icon,

    createdAt:
      extra.createdAt ??
      now,

    updatedAt:
      now,
  };
}

export function updateBlock(
  block,
  updates = {}
) {
  if (!block) {
    return null;
  }

  const nextType =
    updates.type !== undefined
      ? normalizeBlockType(updates.type)
      : normalizeBlockType(block.type);

  return {
    ...block,
    ...updates,
    type: nextType,
    content:
      nextType === BLOCK_TYPES.DIVIDER
        ? ""
        : String(
            updates.content !== undefined
              ? updates.content
              : block.content ?? ""
          ),
    properties: {
      ...(block.properties || {}),
      ...(updates.properties || {}),
    },
    updatedAt: Date.now(),
  };
}

export function convertBlockType(
  block,
  nextType
) {
  if (!block) {
    return null;
  }

  const normalizedType =
    normalizeBlockType(nextType);

  const defaultProperties = {
    [BLOCK_TYPES.TODO]: {
      checked: false,
    },
    [BLOCK_TYPES.TOGGLE]: {
      open: false,
    },
    [BLOCK_TYPES.CALLOUT]: {
      icon: "💡",
    },
  };

  return {
    ...block,
    type: normalizedType,
    content:
      normalizedType === BLOCK_TYPES.DIVIDER
        ? ""
        : block.content ?? "",
    properties: {
      ...(defaultProperties[normalizedType] || {}),
      ...(block.properties || {}),
    },
    updatedAt: Date.now(),
  };
}

export function toggleTodoBlock(
  block,
  checked
) {
  if (
    !block ||
    block.type !== BLOCK_TYPES.TODO
  ) {
    return block;
  }

  const current =
    Boolean(block.properties?.checked);

  return updateBlock(block, {
    properties: {
      checked:
        checked === undefined
          ? !current
          : Boolean(checked),
    },
  });
}

export function toggleToggleBlock(
  block,
  open
) {
  if (
    !block ||
    block.type !== BLOCK_TYPES.TOGGLE
  ) {
    return block;
  }

  const current =
    Boolean(block.properties?.open);

  return updateBlock(block, {
    properties: {
      open:
        open === undefined
          ? !current
          : Boolean(open),
    },
  });
}

export function searchSlashCommands(
  query = ""
) {
  const normalized =
    String(query)
      .trim()
      .replace(/^\/+/, "")
      .toLowerCase();

  if (!normalized) {
    return [...SLASH_COMMANDS];
  }

  return SLASH_COMMANDS
    .map((command) => {
      const label =
        command.label.toLowerCase();

      const aliases =
        command.aliases || [];

      let score = 0;

      if (label === normalized) {
        score += 100;
      } else if (
        label.startsWith(normalized)
      ) {
        score += 50;
      } else if (
        label.includes(normalized)
      ) {
        score += 20;
      }

      for (const alias of aliases) {
        const candidate =
          alias.toLowerCase();

        if (candidate === normalized) {
          score += 100;
        } else if (
          candidate.startsWith(normalized)
        ) {
          score += 50;
        } else if (
          candidate.includes(normalized)
        ) {
          score += 20;
        }
      }

      return {
        command,
        score,
      };
    })
    .filter(
      ({ score }) =>
        score > 0
    )
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .map(
      ({ command }) =>
        command
    );
}

export function slashCommandForInput(
  input = ""
) {
  const value =
    String(input).trim();

  if (!value.startsWith("/")) {
    return null;
  }

  const query =
    value.slice(1).trim();

  const matches =
    searchSlashCommands(query);

  if (!query) {
    return null;
  }

  return (
    matches.find((command) =>
      (command.aliases || []).some(
        (alias) =>
          alias.toLowerCase() ===
          query.toLowerCase()
      )
    ) ||
    matches.find(
      (command) =>
        command.label.toLowerCase() ===
        query.toLowerCase()
    ) ||
    null
  );
}

export function applySlashCommand(
  block,
  commandOrId
) {
  if (!block) {
    return null;
  }

  const command =
    typeof commandOrId === "string"
      ? SLASH_COMMANDS.find(
          (item) =>
            item.id === commandOrId ||
            item.aliases?.includes(
              commandOrId
            )
        )
      : commandOrId;

  if (!command) {
    return block;
  }

  return convertBlockType(
    {
      ...block,
      content: "",
    },
    command.blockType
  );
}

export function createBlockAfter(
  blocks,
  currentBlockId,
  options = {}
) {
  const list =
    Array.isArray(blocks)
      ? [...blocks]
      : [];

  const currentIndex =
    list.findIndex(
      (block) =>
        block.id === currentBlockId
    );

  const insertAt =
    currentIndex >= 0
      ? currentIndex + 1
      : list.length;

  const current =
    currentIndex >= 0
      ? list[currentIndex]
      : null;

  const nextBlock =
    createBlock({
      type:
        options.type ||
        BLOCK_TYPES.TEXT,
      content:
        options.content || "",
      properties:
        options.properties || {},
      parentId:
        options.parentId !== undefined
          ? options.parentId
          : current?.parentId ?? null,
      order: insertAt,
    });

  list.splice(
    insertAt,
    0,
    nextBlock
  );

  return list.map(
    (block, index) => ({
      ...block,
      order: index,
    })
  );
}

export function removeBlock(
  blocks,
  blockId
) {
  const list =
    Array.isArray(blocks)
      ? blocks.filter(
          (block) =>
            block.id !== blockId
        )
      : [];

  return list.map(
    (block, index) => ({
      ...block,
      order: index,
    })
  );
}

export function moveBlock(
  blocks,
  blockId,
  targetIndex
) {
  const list =
    Array.isArray(blocks)
      ? [...blocks]
      : [];

  const fromIndex =
    list.findIndex(
      (block) =>
        block.id === blockId
    );

  if (fromIndex < 0) {
    return list;
  }

  const safeTarget =
    Math.max(
      0,
      Math.min(
        Number(targetIndex) || 0,
        list.length - 1
      )
    );

  const [block] =
    list.splice(fromIndex, 1);

  list.splice(
    safeTarget,
    0,
    block
  );

  return list.map(
    (item, index) => ({
      ...item,
      order: index,
      updatedAt:
        item.id === blockId
          ? Date.now()
          : item.updatedAt,
    })
  );
}

export function blockPlainText(
  block
) {
  if (!block) {
    return "";
  }

  return stripHtml(
    block.content || ""
  );
}

export function isBlockEmpty(
  block
) {
  if (!block) {
    return true;
  }

  if (
    block.type ===
    BLOCK_TYPES.DIVIDER
  ) {
    return true;
  }

  return (
    blockPlainText(block)
      .replace(/\u00a0/g, " ")
      .trim()
      .length === 0
  );
}
