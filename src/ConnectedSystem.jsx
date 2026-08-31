import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";


const INLINE_REMINDER_KEY =
  "abide-inline-reminders";

const COMMAND_USAGE_KEY =
  "abide-command-usage";


/* ============================================================
   STORAGE
============================================================ */

function safeParse(
  value,
  fallback = null
) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}


function readStorage(
  key,
  fallback
) {
  try {
    const value =
      safeParse(
        localStorage.getItem(
          key
        ),
        fallback
      );

    return value == null
      ? fallback
      : value;
  } catch {
    return fallback;
  }
}


function writeStorage(
  key,
  value
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        value
      )
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
    typeof value ===
      "object"
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
      let index = 0;
      index <
      localStorage.length;
      index += 1
    ) {
      const key =
        localStorage.key(
          index
        );

      if (!key) continue;

      entries.push({
        key,

        value:
          safeParse(
            localStorage.getItem(
              key
            ),
            null
          ),
      });
    }
  } catch {}

  return entries;
}


/* ============================================================
   TEXT / HTML
============================================================ */

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


function stripHtml(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(
      /&nbsp;/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* ============================================================
   DATE HELPERS
============================================================ */

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];


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


function localDateKey(
  date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}


function dateKeyToday() {
  return localDateKey(
    new Date()
  );
}


function dateFromKey(
  dateKey
) {
  return new Date(
    `${dateKey}T12:00:00`
  );
}


function shiftDateKey(
  dateKey,
  amount
) {
  const date =
    dateFromKey(
      dateKey
    );

  date.setDate(
    date.getDate() +
      amount
  );

  return localDateKey(
    date
  );
}


function validDateParts(
  year,
  month,
  day
) {
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
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month ||
    date.getDate() !==
      day
  ) {
    return null;
  }

  return date;
}


function formatDate(
  dateKey
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(
        dateKey || ""
      )
    )
  ) {
    return String(
      dateKey || ""
    );
  }

  const date =
    dateFromKey(
      dateKey
    );

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",

      year:
        date.getFullYear() !==
        new Date()
          .getFullYear()
          ? "numeric"
          : undefined,
    }
  );
}


function formatTime(
  time
) {
  if (
    !/^\d{2}:\d{2}$/.test(
      String(
        time || ""
      )
    )
  ) {
    return String(
      time || ""
    );
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


function relativeDateName(
  dateKey
) {
  const today =
    dateKeyToday();

  if (
    dateKey === today
  ) {
    return "Today";
  }

  if (
    dateKey ===
    shiftDateKey(
      today,
      1
    )
  ) {
    return "Tomorrow";
  }

  if (
    dateKey ===
    shiftDateKey(
      today,
      -1
    )
  ) {
    return "Yesterday";
  }

  return formatDate(
    dateKey
  );
}


function dateTimeLabel(
  dateKey,
  time = ""
) {
  const dateLabel =
    relativeDateName(
      dateKey
    );

  if (!time) {
    return dateLabel;
  }

  return `${dateLabel} at ${formatTime(
    time
  )}`;
}


function browserTimezone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "America/Chicago"
    );
  } catch {
    return "America/Chicago";
  }
}


/* ============================================================
   NATURAL LANGUAGE DATE + TIME PARSER

   Examples:
   today
   tomorrow
   yesterday
   next Wednesday
   Friday
   in 3 days
   in 2 weeks
   next week
   8/30
   8/30/2026
   2026-08-30
   August 30
   Aug 30 2026
   tomorrow at 3pm
   Friday 9:30am
   next Wednesday at 1pm
   August 30 at 14:15
============================================================ */

function normalizeNaturalText(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /,/g,
      " "
    )
    .replace(
      /\./g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    );
}


function extractNaturalTime(
  original
) {
  let text =
    normalizeNaturalText(
      original
    );

  const namedTimes = [
    [
      /\bmidnight\b/,
      "00:00",
    ],
    [
      /\bnoon\b/,
      "12:00",
    ],
    [
      /\bmorning\b/,
      "09:00",
    ],
    [
      /\bafternoon\b/,
      "15:00",
    ],
    [
      /\bevening\b/,
      "19:00",
    ],
    [
      /\btonight\b/,
      "19:00",
    ],
  ];

  for (
    const [
      pattern,
      time,
    ] of namedTimes
  ) {
    const match =
      text.match(
        pattern
      );

    if (match) {
      text =
        text
          .replace(
            pattern,
            " "
          )
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      return {
        text,
        time,
      };
    }
  }


  // 3pm, 3:30pm,
  // at 3 pm, at 11:05 AM
  let match =
    text.match(
      /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
    );

  if (match) {
    let hour =
      Number(
        match[1]
      );

    const minute =
      Number(
        match[2] ||
        0
      );

    if (
      hour >= 1 &&
      hour <= 12 &&
      minute >= 0 &&
      minute <= 59
    ) {
      const meridiem =
        match[3]
          .toLowerCase();

      if (
        meridiem ===
          "pm" &&
        hour !== 12
      ) {
        hour += 12;
      }

      if (
        meridiem ===
          "am" &&
        hour === 12
      ) {
        hour = 0;
      }

      text =
        (
          text.slice(
            0,
            match.index
          ) +
          " " +
          text.slice(
            match.index +
              match[0]
                .length
          )
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      return {
        text,

        time:
          `${String(
            hour
          ).padStart(
            2,
            "0"
          )}:${String(
            minute
          ).padStart(
            2,
            "0"
          )}`,
      };
    }
  }


  // 14:30 / at 14:30
  match =
    text.match(
      /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/
    );

  if (match) {
    const hour =
      Number(
        match[1]
      );

    const minute =
      Number(
        match[2]
      );

    text =
      (
        text.slice(
          0,
          match.index
        ) +
        " " +
        text.slice(
          match.index +
            match[0]
              .length
        )
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    return {
      text,

      time:
        `${String(
          hour
        ).padStart(
          2,
          "0"
        )}:${String(
          minute
        ).padStart(
          2,
          "0"
        )}`,
    };
  }


  return {
    text,
    time: "",
  };
}


function parseNaturalDateOnly(
  original
) {
  let text =
    normalizeNaturalText(
      original
    );

  text =
    text
      .replace(
        /^(?:on|for)\s+/,
        ""
      )
      .trim();

  if (!text) {
    return null;
  }

  const today =
    dateKeyToday();

  if (
    text === "today" ||
    text === "now"
  ) {
    return today;
  }

  if (
    text ===
    "tomorrow"
  ) {
    return shiftDateKey(
      today,
      1
    );
  }

  if (
    text ===
    "yesterday"
  ) {
    return shiftDateKey(
      today,
      -1
    );
  }

  if (
    text ===
    "next week"
  ) {
    return shiftDateKey(
      today,
      7
    );
  }


  let match =
    text.match(
      /^in\s+(\d+)\s+days?$/
    );

  if (match) {
    return shiftDateKey(
      today,
      Number(
        match[1]
      )
    );
  }


  match =
    text.match(
      /^in\s+(\d+)\s+weeks?$/
    );

  if (match) {
    return shiftDateKey(
      today,
      Number(
        match[1]
      ) * 7
    );
  }


  // next Wednesday /
  // this Friday /
  // Wednesday
  match =
    text.match(
      /^(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/
    );

  if (match) {
    const qualifier =
      match[1] ||
      "";

    const target =
      WEEKDAYS.indexOf(
        match[2]
      );

    const now =
      dateFromKey(
        today
      );

    const current =
      now.getDay();

    let offset =
      (
        target -
        current +
        7
      ) % 7;

    if (
      qualifier ===
        "next" &&
      offset === 0
    ) {
      offset = 7;
    }

    return shiftDateKey(
      today,
      offset
    );
  }


  // yyyy-mm-dd
  match =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (match) {
    const date =
      validDateParts(
        Number(
          match[1]
        ),
        Number(
          match[2]
        ) - 1,
        Number(
          match[3]
        )
      );

    return date
      ? localDateKey(
          date
        )
      : null;
  }


  // m/d or m/d/yyyy
  match =
    text.match(
      /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/
    );

  if (match) {
    const year =
      match[3]
        ? Number(
            match[3]
          )
        : new Date()
            .getFullYear();

    const date =
      validDateParts(
        year,
        Number(
          match[1]
        ) - 1,
        Number(
          match[2]
        )
      );

    return date
      ? localDateKey(
          date
        )
      : null;
  }


  // Aug 30 /
  // August 30 2026
  match =
    text.match(
      /^(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:\s+(\d{4}))?$/
    );

  if (match) {
    const month =
      MONTHS[
        match[1]
      ];

    const year =
      match[3]
        ? Number(
            match[3]
          )
        : new Date()
            .getFullYear();

    const date =
      validDateParts(
        year,
        month,
        Number(
          match[2]
        )
      );

    return date
      ? localDateKey(
          date
        )
      : null;
  }


  return null;
}


export function parseAbideDateTime(
  value
) {
  const raw =
    normalizeNaturalText(
      value
    );

  if (!raw) {
    return null;
  }


  const extracted =
    extractNaturalTime(
      raw
    );

  const remaining =
    extracted.text
      .replace(
        /\bat\b/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  let dateKey =
    parseNaturalDateOnly(
      remaining
    );


  // A time without a date
  // means today.
  if (
    !dateKey &&
    extracted.time &&
    !remaining
  ) {
    dateKey =
      dateKeyToday();
  }


  if (!dateKey) {
    return null;
  }


  return {
    dateKey,

    time:
      extracted.time ||
      "",

    label:
      dateTimeLabel(
        dateKey,
        extracted.time
      ),
  };
}


/* ============================================================
   STRUCTURED REFERENCES
============================================================ */

function referenceId(
  item
) {
  if (
    item.type ===
      "datetime"
  ) {
    return `${item.dateKey}T${item.time}`;
  }

  if (
    item.type ===
      "date"
  ) {
    return item.dateKey;
  }

  if (
    item.type ===
      "time"
  ) {
    return item.time;
  }

  return item.id;
}


function referenceToken(
  item
) {
  return `@[${item.label}](abide:${item.type}:${referenceId(
    item
  )})`;
}


function referenceHtml(
  item
) {
  const attributes = [
    `data-abide-type="${escapeHtml(
      item.type
    )}"`,

    `data-abide-id="${escapeHtml(
      referenceId(
        item
      )
    )}"`,

    `data-abide-label="${escapeHtml(
      item.label
    )}"`,
  ];


  if (
    item.dateKey
  ) {
    attributes.push(
      `data-abide-date="${escapeHtml(
        item.dateKey
      )}"`
    );
  }


  if (item.time) {
    attributes.push(
      `data-abide-time="${escapeHtml(
        item.time
      )}"`
    );
  }


  return `<span
    class="abide-mention"
    ${attributes.join(
      " "
    )}
    contenteditable="false"
  >@${escapeHtml(
    item.label
  )}</span>&nbsp;`;
}


function structuredDateItem(
  dateKey,
  time = ""
) {
  return {
    type:
      time
        ? "datetime"
        : "date",

    id:
      time
        ? `${dateKey}T${time}`
        : dateKey,

    dateKey,
    time,

    label:
      dateTimeLabel(
        dateKey,
        time
      ),

    meta:
      time
        ? `${formatDate(
            dateKey
          )} · ${formatTime(
            time
          )}`
        : formatDate(
            dateKey
          ),
  };
}


function structuredTimeItem(
  time
) {
  return {
    type: "time",
    id: time,
    time,

    label:
      formatTime(
        time
      ),

    meta: "Time",
  };
}


/* ============================================================
   INLINE REMINDERS
============================================================ */

function inlineReminders() {
  return normalizeCollection(
    readStorage(
      INLINE_REMINDER_KEY,
      []
    )
  );
}


function reminderById(
  id
) {
  return (
    inlineReminders()
      .find(
        (item) =>
          String(
            item.id
          ) ===
          String(id)
      ) ||
    null
  );
}


function subtractMinutes(
  dateKey,
  time,
  minutes
) {
  const moment =
    new Date(
      `${dateKey}T${time}:00`
    );

  moment.setMinutes(
    moment.getMinutes() -
      Number(
        minutes || 0
      )
  );

  return {
    dateKey:
      localDateKey(
        moment
      ),

    time:
      `${String(
        moment.getHours()
      ).padStart(
        2,
        "0"
      )}:${String(
        moment.getMinutes()
      ).padStart(
        2,
        "0"
      )}`,
  };
}


function saveInlineReminder({
  id = null,
  title = "",
  dateKey,
  time,
  leadMinutes = 0,
}) {
  const reminders =
    inlineReminders();

  const reminderId =
    id ||
    `inline_${Date.now()}_${Math.random()
      .toString(36)
      .slice(
        2,
        8
      )}`;


  const actualTime =
    time ||
    "09:00";


  const fire =
    subtractMinutes(
      dateKey,
      actualTime,
      leadMinutes
    );


  const existing =
    reminders.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          reminderId
        )
    );


  const reminder = {
    ...existing,

    id:
      reminderId,

    title:
      String(
        title || ""
      ).trim() ||
      "Reminder",

    dateKey,

    time:
      actualTime,

    leadMinutes:
      Number(
        leadMinutes || 0
      ),

    fireDateKey:
      fire.dateKey,

    fireTime:
      fire.time,

    timeZone:
      browserTimezone(),

    createdAt:
      existing
        ?.createdAt ||
      Date.now(),

    updatedAt:
      Date.now(),

    firedAt: null,
    disabled: false,
  };


  const next =
    existing
      ? reminders.map(
          (item) =>
            String(
              item.id
            ) ===
            String(
              reminderId
            )
              ? reminder
              : item
        )
      : [
          reminder,
          ...reminders,
        ];


  writeStorage(
    INLINE_REMINDER_KEY,
    next
  );


  return reminder;
}


function deleteInlineReminder(
  id
) {
  const next =
    inlineReminders()
      .filter(
        (item) =>
          String(
            item.id
          ) !==
          String(id)
      );


  writeStorage(
    INLINE_REMINDER_KEY,
    next
  );
}


function reminderLeadLabel(
  minutes
) {
  const value =
    Number(
      minutes || 0
    );

  if (value === 0) {
    return "At time";
  }

  if (value < 60) {
    return `${value} min before`;
  }

  if (
    value === 60
  ) {
    return "1 hour before";
  }

  if (
    value === 1440
  ) {
    return "1 day before";
  }

  return `${value} min before`;
}


function reminderStructuredItem(
  reminder
) {
  return {
    type: "reminder",
    id:
      reminder.id,

    label:
      reminder.title ||
      "Reminder",

    dateKey:
      reminder.dateKey,

    time:
      reminder.time,

    meta:
      `${dateTimeLabel(
        reminder.dateKey,
        reminder.time
      )} · ${reminderLeadLabel(
        reminder.leadMinutes
      )}`,
  };
}


/* ============================================================
   REFERENCE CATALOG
============================================================ */

export function getAbideReferenceCatalog() {
  const results = [];
  const seen =
    new Set();


  const add = (
    item
  ) => {
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
      seen.has(
        unique
      )
    ) {
      return;
    }

    seen.add(
      unique
    );

    results.push(
      item
    );
  };


  // ----------------------------------------------------------
  // Quick date mentions
  // ----------------------------------------------------------

  const today =
    dateKeyToday();

  [
    [
      "today",
      today,
    ],
    [
      "tomorrow",
      shiftDateKey(
        today,
        1
      ),
    ],
    [
      "yesterday",
      shiftDateKey(
        today,
        -1
      ),
    ],
  ].forEach(
    ([
      id,
      dateKey,
    ]) =>
      add({
        ...structuredDateItem(
          dateKey
        ),

        id,
      })
  );


  for (
    let offset = 2;
    offset <= 7;
    offset += 1
  ) {
    const dateKey =
      shiftDateKey(
        today,
        offset
      );

    add(
      structuredDateItem(
        dateKey
      )
    );
  }


  // ----------------------------------------------------------
  // Tasks
  // ----------------------------------------------------------

  normalizeCollection(
    readStorage(
      "abide-tasks",
      []
    )
  ).forEach(
    (task) => {
      add({
        type: "task",
        id: task.id,

        label:
          task.title ||
          "Untitled task",

        meta: [
          task.done
            ? "Completed task"
            : "Task",

          task.dueDate
            ? formatDate(
                task.dueDate
              )
            : "",

          task.dueTime
            ? formatTime(
                task.dueTime
              )
            : "",
        ]
          .filter(
            Boolean
          )
          .join(
            " · "
          ),
      });
    }
  );


  // ----------------------------------------------------------
  // Events
  // ----------------------------------------------------------

  normalizeCollection(
    readStorage(
      "abide-calendar-events",
      []
    )
  ).forEach(
    (event) => {
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

          event.time ||
          "",
        ]
          .filter(
            Boolean
          )
          .join(
            " · "
          ),
      });
    }
  );


  // ----------------------------------------------------------
  // Inline reminders
  // ----------------------------------------------------------

  inlineReminders()
    .filter(
      (reminder) =>
        !reminder.disabled
    )
    .forEach(
      (reminder) => {
        add(
          reminderStructuredItem(
            reminder
          )
        );
      }
    );


  // ----------------------------------------------------------
  // Other Abide collections
  // ----------------------------------------------------------

  allStorageEntries()
    .filter(
      ({
        key,
      }) =>
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
          ) ||
          key ===
            INLINE_REMINDER_KEY
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
              if (
                item.id == null &&
                item.key == null
              ) {
                return;
              }

              add({
                type: "goal",

                id:
                  item.id ||
                  item.key,

                label:
                  item.title ||
                  item.name ||
                  "Goal",

                meta:
                  "Goal",
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
              if (
                item.id == null &&
                item.key == null
              ) {
                return;
              }

              add({
                type: "area",

                id:
                  item.id ||
                  item.key,

                label:
                  item.name ||
                  item.title ||
                  "Area",

                meta:
                  "Area",
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
            (
              item,
              index
            ) => {
              if (
                item.id ==
                null
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
                type:
                  "journal",

                id:
                  item.id,

                label:
                  item.ref ||
                  plain.slice(
                    0,
                    58
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
                  .filter(
                    Boolean
                  )
                  .join(
                    " · "
                  ),
              });
            }
          );
        }
      }
    );


  // ----------------------------------------------------------
  // Notes
  // ----------------------------------------------------------

  normalizeCollection(
    readStorage(
      "abide-scratch-pages",
      []
    )
  ).forEach(
    (
      page,
      index
    ) => {
      const plain =
        stripHtml(
          page.contentHtml ||
          page.content ||
          page.text ||
          ""
        );


      add({
        type:
          "scratch",

        id:
          page.id ||
          `scratch_${index}`,

        label:
          page.title ||
          plain.slice(
            0,
            58
          ) ||
          (
            page.type ===
              "draw"
              ? `Drawing ${
                  index + 1
                }`
              : `Notes ${
                  index + 1
                }`
          ),

        meta:
          page.type ===
            "draw"
            ? "Notes drawing"
            : "Notes note",
      });
    }
  );


  return results;
}


/* ============================================================
   NAVIGATION
============================================================ */

export function navigateToAbideItem(
  type,
  id = "",
  extra = {}
) {
  const url =
    new URL(
      window.location.href
    );


  const setTab = (
    tab
  ) => {
    url.searchParams.set(
      "tab",
      tab
    );
  };


  if (
    type ===
    "task"
  ) {
    setTab(
      "today"
    );

    if (id) {
      url.searchParams.set(
        "taskId",
        id
      );
    }
  } else if (
    type ===
    "event"
  ) {
    setTab(
      "calendar"
    );

    if (id) {
      url.searchParams.set(
        "eventId",
        id
      );
    }
  } else if (
    type ===
    "journal"
  ) {
    setTab(
      "journal"
    );

    if (id) {
      url.searchParams.set(
        "journalId",
        id
      );
    }
  } else if (
    type ===
    "scratch"
  ) {
    setTab(
      "scratch"
    );

    if (id) {
      url.searchParams.set(
        "scratchId",
        id
      );
    }
  } else if (
    type ===
    "goal"
  ) {
    setTab(
      "goals"
    );

    if (id) {
      url.searchParams.set(
        "goalId",
        id
      );
    }
  } else if (
    type ===
      "reminder"
  ) {
    setTab(
      "reminders"
    );

    if (id) {
      url.searchParams.set(
        "inlineReminderId",
        id
      );
    }
  } else if (
    type ===
      "calendar"
  ) {
    setTab(
      "calendar"
    );
  } else if (
    type ===
      "date" ||
    type ===
      "datetime"
  ) {
    setTab(
      "calendar"
    );

    if (
      extra.dateKey
    ) {
      url.searchParams.set(
        "date",
        extra.dateKey
      );
    }
  } else {
    setTab(
      "today"
    );
  }


  window.location.assign(
    `${url.pathname}${url.search}${url.hash}`
  );
}


/* ============================================================
   REFERENCE EXTRACTION
============================================================ */

export function extractAbideReferences(
  value
) {
  const text =
    String(
      value || ""
    );

  const references = [];
  const seen =
    new Set();

  const pattern =
    /abide:([a-z-]+):([A-Za-z0-9_.:-]+)/g;

  let match;


  while (
    (
      match =
        pattern.exec(
          text
        )
    )
  ) {
    const unique =
      `${match[1]}:${match[2]}`;


    if (
      seen.has(
        unique
      )
    ) {
      continue;
    }


    seen.add(
      unique
    );


    references.push({
      type:
        match[1],

      id:
        match[2],
    });
  }


  return references;
}


/* ============================================================
   SCRATCH PAD LINKING
============================================================ */

function scratchPageType(
  pages
) {
  const existing =
    normalizeCollection(
      pages
    ).find(
      (page) =>
        page?.type &&
        page.type !==
          "draw"
    );


  return (
    existing
      ?.type ||
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
      item?.dueDate
        ? `<p><strong>Due:</strong> ${escapeHtml(
            dateTimeLabel(
              item.dueDate,
              item.dueTime ||
              ""
            )
          )}</p>`
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


export function sendToNotes(
  item,
  kind
) {
  const pages =
    normalizeCollection(
      readStorage(
        "abide-scratch-pages",
        []
      )
    );


  const now =
    Date.now();


  const html =
    kind ===
      "event"
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
        pages
      ),

    title:
      item?.title ||
      (
        kind ===
          "event"
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


  writeStorage(
    "abide-scratch-pages",
    [
      page,
      ...pages,
    ]
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


export function sendToNotesAndOfferOpen(
  item,
  kind
) {
  const page =
    sendToNotes(
      item,
      kind
    );


  const open =
    window.confirm(
      `Sent "${page.title}" to Notes.\n\nOpen Notes now?`
    );


  if (open) {
    navigateToAbideItem(
      "scratch",
      page.id
    );
  }


  return page;
}


/* ============================================================
   COMMAND USAGE / RECENTS
============================================================ */

function commandUsage() {
  return readStorage(
    COMMAND_USAGE_KEY,
    {}
  ) || {};
}


function recordCommandUse(
  id
) {
  const current =
    commandUsage();

  const existing =
    current[id] ||
    {
      count: 0,
      lastUsed: 0,
    };


  writeStorage(
    COMMAND_USAGE_KEY,
    {
      ...current,

      [id]: {
        count:
          Number(
            existing.count ||
            0
          ) + 1,

        lastUsed:
          Date.now(),
      },
    }
  );
}


/* ============================================================
   SLASH COMMANDS
============================================================ */

function baseCommandCatalog() {
  return [
    {
      id: "mention",
      label: "Mention",
      description:
        "Link a task, event, page, date, goal, Area or reminder",
      behavior:
        "mention",
      category:
        "Inline",
    },

    {
      id: "date",
      label: "Date",
      description:
        "Insert a real date or datetime",
      behavior:
        "date-picker",
      category:
        "Inline",
    },

    {
      id: "time",
      label: "Time",
      description:
        "Insert a real time",
      behavior:
        "time-picker",
      category:
        "Inline",
    },

    {
      id:
        "reminder",
      aliases: [
        "remind",
      ],
      label:
        "Reminder",
      description:
        "Create a real Abide reminder",
      behavior:
        "reminder-picker",
      category:
        "Inline",
    },

    {
      id: "due",
      label:
        "Due date",
      description:
        "Insert a linked due-date timestamp",
      behavior:
        "date-picker",
      prefix:
        "Due ",
      category:
        "Planning",
    },

    {
      id:
        "finish-by",
      aliases: [
        "finish",
        "target",
      ],
      label:
        "Finish by",
      description:
        "Insert a linked personal target date",
      behavior:
        "date-picker",
      prefix:
        "Finish by ",
      category:
        "Planning",
    },

    {
      id:
        "task",
      aliases: [
        "todo",
      ],
      label:
        "Task / To-do",
      description:
        "Insert a task or checkbox line",
      insert:
        "☐ ",
      category:
        "Basic",
    },

    {
      id:
        "event",
      label:
        "Event",
      description:
        "Insert an event planning line",
      insert:
        "Event: ",
      category:
        "Planning",
    },

    {
      id:
        "area",
      label:
        "Area",
      description:
        "Mention an Abide Area",
      insert:
        "Area: @",
      category:
        "Planning",
    },

    {
      id:
        "goal",
      label:
        "Goal",
      description:
        "Mention an Abide goal",
      insert:
        "Goal: @",
      category:
        "Planning",
    },

    {
      id:
        "priority",
      label:
        "Priority",
      description:
        "Insert priority planning",
      insert:
        "Priority: ",
      category:
        "Planning",
    },

    {
      id:
        "repeat",
      label:
        "Repeat",
      description:
        "Insert recurrence planning",
      insert:
        "Repeat: ",
      category:
        "Planning",
    },

    {
      id:
        "text",
      aliases: [
        "plain",
      ],
      label:
        "Text",
      description:
        "Standard text block",
      behavior:
        "format-text",
      category:
        "Basic",
    },

    {
      id:
        "bullet",
      label:
        "Bullet list",
      description:
        "Create a bulleted list",
      behavior:
        "bullet",
      category:
        "Basic",
    },

    {
      id:
        "numbered",
      aliases: [
        "num",
      ],
      label:
        "Numbered list",
      description:
        "Create a numbered list",
      behavior:
        "numbered",
      category:
        "Basic",
    },

    {
      id:
        "quote",
      label:
        "Quote",
      description:
        "Create a quote block",
      behavior:
        "quote",
      category:
        "Basic",
    },

    {
      id:
        "h1",
      aliases: [
        "#",
      ],
      label:
        "Heading 1",
      description:
        "Large heading",
      behavior:
        "h1",
      category:
        "Basic",
    },

    {
      id:
        "h2",
      aliases: [
        "##",
      ],
      label:
        "Heading 2",
      description:
        "Medium heading",
      behavior:
        "h2",
      category:
        "Basic",
    },

    {
      id:
        "h3",
      aliases: [
        "###",
      ],
      label:
        "Heading 3",
      description:
        "Small heading",
      behavior:
        "h3",
      category:
        "Basic",
    },

    {
      id:
        "divider",
      aliases: [
        "div",
      ],
      label:
        "Divider",
      description:
        "Insert a divider",
      insert:
        "\n────────────\n",
      category:
        "Basic",
    },

    {
      id:
        "scratch",
      label:
        "Open Notes",
      description:
        "Go to Notes",
      action:
        () =>
          navigateToAbideItem(
            "scratch"
          ),
      category:
        "Navigate",
    },

    {
      id:
        "journal",
      label:
        "Open Journal",
      description:
        "Go to Journal",
      action:
        () =>
          navigateToAbideItem(
            "journal"
          ),
      category:
        "Navigate",
    },

    {
      id:
        "calendar",
      label:
        "Open Calendar",
      description:
        "Go to Calendar",
      action:
        () =>
          navigateToAbideItem(
            "calendar"
          ),
      category:
        "Navigate",
    },
  ];
}


function commandSearchText(
  command
) {
  return [
    command.id,
    command.label,
    command.description,
    command.category,
    ...(
      command.aliases ||
      []
    ),
  ]
    .join(
      " "
    )
    .toLowerCase();
}


function commandMatchesHead(
  command,
  head
) {
  const names = [
    command.id,
    ...(
      command.aliases ||
      []
    ),
  ].map(
    (value) =>
      value
        .toLowerCase()
  );


  return names.includes(
    head.toLowerCase()
  );
}


function dynamicSlashResult(
  query
) {
  const trimmed =
    String(
      query || ""
    ).trim();


  if (
    !trimmed.includes(
      " "
    )
  ) {
    return null;
  }


  const [
    head,
    ...restParts
  ] =
    trimmed.split(
      /\s+/
    );


  const rest =
    restParts.join(
      " "
    );


  const command =
    baseCommandCatalog()
      .find(
        (item) =>
          commandMatchesHead(
            item,
            head
          )
      );


  if (!command) {
    return null;
  }


  if (
    ![
      "date-picker",
      "time-picker",
      "reminder-picker",
    ].includes(
      command.behavior
    )
  ) {
    return null;
  }


  const parsed =
    parseAbideDateTime(
      rest
    );


  if (!parsed) {
    return null;
  }


  return {
    ...command,

    id:
      `smart-${command.id}`,

    originalCommandId:
      command.id,

    label:
      command.behavior ===
        "reminder-picker"
        ? `Reminder · ${parsed.label}`
        : `${command.label} · ${parsed.label}`,

    description:
      "Use the date and time you typed",

    smartDate:
      parsed,
  };
}


function slashResults(
  query
) {
  const normalized =
    String(
      query || ""
    )
      .trim()
      .toLowerCase();


  const dynamic =
    dynamicSlashResult(
      normalized
    );


  const base =
    baseCommandCatalog();


  const filtered =
    normalized
      ? base.filter(
          (command) =>
            commandSearchText(
              command
            ).includes(
              normalized
            ) ||
            normalized.startsWith(
              `${command.id} `
            ) ||
            (
              command.aliases ||
              []
            ).some(
              (alias) =>
                normalized.startsWith(
                  `${alias} `
                )
            )
        )
      : base;


  const usage =
    commandUsage();


  const sorted =
    [...filtered].sort(
      (
        a,
        b
      ) => {
        const aUsage =
          usage[a.id] ||
          {};

        const bUsage =
          usage[b.id] ||
          {};


        if (
          Number(
            bUsage.lastUsed ||
            0
          ) !==
          Number(
            aUsage.lastUsed ||
            0
          )
        ) {
          return (
            Number(
              bUsage.lastUsed ||
              0
            ) -
            Number(
              aUsage.lastUsed ||
              0
            )
          );
        }


        return (
          Number(
            bUsage.count ||
            0
          ) -
          Number(
            aUsage.count ||
            0
          )
        );
      }
    );


  return [
    ...(
      dynamic
        ? [
            dynamic,
          ]
        : []
    ),

    ...sorted,
  ].slice(
    0,
    30
  );
}


/* ============================================================
   @ RESULTS
============================================================ */

function mentionResults(
  query
) {
  const normalized =
    String(
      query || ""
    )
      .trim();


  const lower =
    normalized.toLowerCase();


  const results = [];


  // ----------------------------------------------------------
  // @remind ...
  // ----------------------------------------------------------

  if (
    lower ===
      "remind" ||
    lower ===
      "reminder"
  ) {
    results.push({
      type:
        "special-reminder",

      id:
        "create-reminder",

      label:
        "Set a reminder…",

      meta:
        "Choose a real date and time",
    });

    return results;
  }


  if (
    lower.startsWith(
      "remind "
    ) ||
    lower.startsWith(
      "reminder "
    )
  ) {
    const phrase =
      normalized.replace(
        /^remind(?:er)?\s+/i,
        ""
      );


    const parsed =
      parseAbideDateTime(
        phrase
      );


    if (parsed) {
      results.push({
        type:
          "special-reminder-smart",

        id:
          "create-reminder-smart",

        label:
          `Remind · ${parsed.label}`,

        meta:
          "Create this reminder",

        smartDate:
          parsed,
      });
    }


    return results;
  }


  // ----------------------------------------------------------
  // Natural-language date
  // ----------------------------------------------------------

  if (normalized) {
    const parsed =
      parseAbideDateTime(
        normalized
      );


    if (parsed) {
      results.push({
        ...structuredDateItem(
          parsed.dateKey,
          parsed.time
        ),

        id:
          `natural-${parsed.dateKey}-${parsed.time || "date"}`,

        meta:
          "Date mention · " +
          (
            parsed.time
              ? `${formatDate(
                  parsed.dateKey
                )} · ${formatTime(
                  parsed.time
                )}`
              : formatDate(
                  parsed.dateKey
                )
          ),
      });
    }
  }


  // ----------------------------------------------------------
  // Actual Abide entities
  // ----------------------------------------------------------

  const catalog =
    getAbideReferenceCatalog();


  const entityMatches =
    catalog.filter(
      (item) => {
        if (!normalized) {
          return true;
        }


        return [
          item.label,
          item.meta,
          item.type,
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
          .toLowerCase()
          .includes(
            lower
          );
      }
    );


  results.push(
    ...entityMatches
  );


  return results
    .filter(
      (
        item,
        index,
        array
      ) =>
        array.findIndex(
          (candidate) =>
            `${candidate.type}:${candidate.id}` ===
            `${item.type}:${item.id}`
        ) ===
        index
    )
    .slice(
      0,
      30
    );
}


/* ============================================================
   EDITOR POSITIONING
============================================================ */

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
        .getRangeAt(
          0
        )
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


function captureInsertionPoint(
  element
) {
  if (
    element instanceof
      HTMLInputElement ||
    element instanceof
      HTMLTextAreaElement
  ) {
    return {
      kind:
        "input",

      element,

      position:
        element.selectionStart ??
        element.value.length,
    };
  }


  if (
    element
      ?.isContentEditable
  ) {
    const selection =
      window.getSelection();


    if (
      selection &&
      selection.rangeCount
    ) {
      return {
        kind:
          "contenteditable",

        element,

        range:
          selection
            .getRangeAt(
              0
            )
            .cloneRange(),
      };
    }
  }


  return {
    kind:
      "unknown",

    element,
  };
}


function insertAtPoint(
  point,
  plainText,
  html = null
) {
  const element =
    point?.element;


  if (!element) {
    return;
  }


  if (
    point.kind ===
      "input"
  ) {
    const position =
      Number(
        point.position ||
        0
      );


    const before =
      element.value.slice(
        0,
        position
      );


    const after =
      element.value.slice(
        position
      );


    element.value =
      before +
      plainText +
      after;


    const nextPosition =
      before.length +
      plainText.length;


    element.focus();


    element.setSelectionRange(
      nextPosition,
      nextPosition
    );


    element.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true,
        }
      )
    );


    return;
  }


  if (
    point.kind ===
      "contenteditable"
  ) {
    const selection =
      window.getSelection();


    if (
      !selection ||
      !point.range
    ) {
      return;
    }


    element.focus();


    selection.removeAllRanges();
    selection.addRange(
      point.range
    );


    if (
      html &&
      document
        .queryCommandSupported
        ?.(
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
  }
}


function replaceTriggerToken(
  element,
  tokenLength,
  plainText,
  html = null
) {
  if (!element) {
    return null;
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


    const start =
      Math.max(
        0,
        end -
          tokenLength
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


    element.focus();


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


    return {
      kind:
        "input",

      element,

      position:
        next,
    };
  }


  if (
    element
      .isContentEditable
  ) {
    const selection =
      window.getSelection();


    if (
      !selection ||
      !selection.rangeCount
    ) {
      return null;
    }


    const range =
      selection.getRangeAt(
        0
      );


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


    element.focus();


    if (
      html &&
      document
        .queryCommandSupported
        ?.(
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


    return captureInsertionPoint(
      element
    );
  }


  return null;
}


function structuredInsert(
  point,
  item,
  prefix = ""
) {
  insertAtPoint(
    point,

    `${prefix}${referenceToken(
      item
    )} `,

    `${escapeHtml(
      prefix
    )}${referenceHtml(
      item
    )}`
  );
}


/* ============================================================
   BLOCK FORMATTING
============================================================ */

function runBlockBehavior(
  element,
  behavior
) {
  if (
    !element
      ?.isContentEditable
  ) {
    return false;
  }


  element.focus();


  try {
    if (
      behavior ===
      "bullet"
    ) {
      document.execCommand(
        "insertUnorderedList"
      );
    } else if (
      behavior ===
      "numbered"
    ) {
      document.execCommand(
        "insertOrderedList"
      );
    } else if (
      behavior ===
      "quote"
    ) {
      document.execCommand(
        "formatBlock",
        false,
        "blockquote"
      );
    } else if (
      behavior ===
      "h1"
    ) {
      document.execCommand(
        "formatBlock",
        false,
        "h1"
      );
    } else if (
      behavior ===
      "h2"
    ) {
      document.execCommand(
        "formatBlock",
        false,
        "h2"
      );
    } else if (
      behavior ===
      "h3"
    ) {
      document.execCommand(
        "formatBlock",
        false,
        "h3"
      );
    } else if (
      behavior ===
      "format-text"
    ) {
      document.execCommand(
        "formatBlock",
        false,
        "div"
      );
    } else {
      return false;
    }


    element.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true,
        }
      )
    );


    return true;
  } catch {
    return false;
  }
}


/* ============================================================
   MENTION LABEL REFRESH

   Similar principle to Notion page mentions:
   if a linked Abide item is renamed, rendered mentions update.
============================================================ */

function refreshRenderedMentions() {
  const catalog =
    getAbideReferenceCatalog();


  const byId =
    new Map(
      catalog.map(
        (item) => [
          `${item.type}:${item.id}`,
          item,
        ]
      )
    );


  document
    .querySelectorAll(
      ".abide-mention"
    )
    .forEach(
      (node) => {
        const type =
          node.dataset
            .abideType;


        const id =
          node.dataset
            .abideId;


        if (
          type ===
            "date" ||
          type ===
            "datetime"
        ) {
          const dateKey =
            node.dataset
              .abideDate ||
            String(id)
              .split(
                "T"
              )[0];


          const time =
            node.dataset
              .abideTime ||
            (
              type ===
                "datetime"
                ? String(
                    id
                  )
                    .split(
                      "T"
                    )[1] ||
                  ""
                : ""
            );


          if (dateKey) {
            const label =
              dateTimeLabel(
                dateKey,
                time
              );


            node.textContent =
              `@${label}`;


            node.dataset
              .abideLabel =
              label;
          }


          return;
        }


        if (
          type ===
          "time"
        ) {
          const time =
            node.dataset
              .abideTime ||
            id;


          node.textContent =
            `@${formatTime(
              time
            )}`;


          return;
        }


        if (
          type ===
          "reminder"
        ) {
          const reminder =
            reminderById(
              id
            );


          if (reminder) {
            node.textContent =
              `@${reminder.title}`;


            node.dataset
              .abideLabel =
              reminder.title;


            node.dataset
              .abideDate =
              reminder.dateKey;


            node.dataset
              .abideTime =
              reminder.time;
          }


          return;
        }


        const item =
          byId.get(
            `${type}:${id}`
          );


        if (item) {
          node.textContent =
            `@${item.label}`;


          node.dataset
            .abideLabel =
            item.label;
        }
      }
    );
}


/* ============================================================
   PICKER
============================================================ */

function DateReminderPicker({
  picker,
  onClose,
  onSave,
  onDelete,
}) {
  const mode =
    picker.mode;


  const isReminder =
    mode ===
    "reminder";


  const isTimeOnly =
    mode ===
    "time";


  const [
    title,
    setTitle,
  ] =
    useState(
      picker.title ||
      "Reminder"
    );


  const [
    dateKey,
    setDateKey,
  ] =
    useState(
      picker.dateKey ||
      dateKeyToday()
    );


  const [
    time,
    setTime,
  ] =
    useState(
      picker.time ||
      (
        isReminder
          ? "09:00"
          : ""
      )
    );


  const [
    leadMinutes,
    setLeadMinutes,
  ] =
    useState(
      Number(
        picker.leadMinutes ||
        0
      )
    );


  const quickDates =
    [
      [
        "Today",
        dateKeyToday(),
      ],

      [
        "Tomorrow",
        shiftDateKey(
          dateKeyToday(),
          1
        ),
      ],

      [
        "Next week",
        shiftDateKey(
          dateKeyToday(),
          7
        ),
      ],
    ];


  return createPortal(
    <div
      style={{
        position:
          "fixed",

        inset: 0,

        zIndex:
          40000,

        background:
          "rgba(0,0,0,.42)",

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          18,
      }}
      onMouseDown={
        onClose
      }
    >
      <div
        style={{
          width:
            "min(94vw, 390px)",

          maxHeight:
            "88vh",

          overflowY:
            "auto",

          borderRadius:
            16,

          background:
            "var(--card)",

          border:
            "1px solid var(--cardBorder)",

          boxShadow:
            "0 22px 70px rgba(0,0,0,.40)",

          padding:
            14,
        }}
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-start",

            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize:
                  14,

                fontWeight:
                  780,

                color:
                  "var(--text)",
              }}
            >
              {isReminder
                ? "Reminder"
                : isTimeOnly
                  ? "Time"
                  : "Date & time"}
            </div>

            <div
              style={{
                fontSize:
                  10.75,

                color:
                  "var(--text3)",

                marginTop:
                  3,

                lineHeight:
                  1.4,
              }}
            >
              {isReminder
                ? "This creates a real Abide reminder, not placeholder text."
                : "This inserts a structured, clickable timestamp."}
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            style={{
              border:
                "1px solid var(--pillBorder)",

              background:
                "var(--pillBg)",

              color:
                "var(--text2)",

              borderRadius:
                9,

              width: 30,
              height: 30,

              cursor:
                "pointer",
            }}
          >
            ×
          </button>
        </div>


        {isReminder && (
          <>
            <div
              style={{
                marginTop:
                  13,

                fontSize:
                  10,

                fontWeight:
                  750,

                color:
                  "var(--text3)",

                letterSpacing:
                  .4,
              }}
            >
              REMIND ME ABOUT
            </div>

            <input
              className="input-line"
              style={{
                marginTop:
                  6,
              }}
              value={
                title
              }
              onChange={(
                event
              ) =>
                setTitle(
                  event.target
                    .value
                )
              }
              placeholder="What should Abide remind you about?"
            />
          </>
        )}


        {!isTimeOnly && (
          <>
            <div
              style={{
                marginTop:
                  13,

                fontSize:
                  10,

                fontWeight:
                  750,

                color:
                  "var(--text3)",

                letterSpacing:
                  .4,
              }}
            >
              DATE
            </div>

            <div
              style={{
                display:
                  "flex",

                flexWrap:
                  "wrap",

                gap: 6,

                marginTop:
                  7,
              }}
            >
              {quickDates.map(
                ([
                  label,
                  key,
                ]) => (
                  <button
                    type="button"
                    key={
                      key
                    }
                    onClick={() =>
                      setDateKey(
                        key
                      )
                    }
                    className={`filter-chip ${
                      dateKey ===
                      key
                        ? "active"
                        : ""
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <input
              type="date"
              className="input-line"
              value={
                dateKey
              }
              onChange={(
                event
              ) =>
                setDateKey(
                  event.target
                    .value
                )
              }
              style={{
                marginTop:
                  9,
              }}
            />
          </>
        )}


        <div
          style={{
            marginTop:
              13,

            fontSize:
              10,

            fontWeight:
              750,

            color:
              "var(--text3)",

            letterSpacing:
              .4,
          }}
        >
          {isReminder
            ? "TIME"
            : isTimeOnly
              ? "TIME"
              : "TIME · OPTIONAL"}
        </div>

        <input
          type="time"
          className="input-line"
          value={
            time
          }
          onChange={(
            event
          ) =>
            setTime(
              event.target
                .value
            )
          }
          style={{
            marginTop:
              6,
          }}
        />


        {isReminder && (
          <>
            <div
              style={{
                marginTop:
                  13,

                fontSize:
                  10,

                fontWeight:
                  750,

                color:
                  "var(--text3)",

                letterSpacing:
                  .4,
              }}
            >
              NOTIFY ME
            </div>

            <select
              className="input-line"
              value={
                String(
                  leadMinutes
                )
              }
              onChange={(
                event
              ) =>
                setLeadMinutes(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              style={{
                marginTop:
                  6,
              }}
            >
              <option value="0">
                At time
              </option>

              <option value="5">
                5 minutes before
              </option>

              <option value="15">
                15 minutes before
              </option>

              <option value="30">
                30 minutes before
              </option>

              <option value="60">
                1 hour before
              </option>

              <option value="1440">
                1 day before
              </option>
            </select>
          </>
        )}


        <div
          style={{
            marginTop:
              12,

            padding:
              "9px 10px",

            borderRadius:
              11,

            background:
              "var(--subtleBg)",

            border:
              "1px solid var(--divider)",

            fontSize:
              11,

            lineHeight:
              1.45,

            color:
              "var(--text2)",
          }}
        >
          {isTimeOnly
            ? (
                time
                  ? formatTime(
                      time
                    )
                  : "Choose a time."
              )
            : dateTimeLabel(
                dateKey,
                time
              )}

          {isReminder && (
            <>
              {" · "}
              {reminderLeadLabel(
                leadMinutes
              )}

              <div
                style={{
                  marginTop:
                    3,

                  color:
                    "var(--text3)",

                  fontSize:
                    10,
                }}
              >
                {browserTimezone()}
              </div>
            </>
          )}
        </div>


        <div
          style={{
            display:
              "flex",

            gap: 8,

            marginTop:
              14,
          }}
        >
          <button
            type="button"
            className="filter-chip active"
            style={{
              flex: 1,
              justifyContent:
                "center",
            }}
            onClick={() =>
              onSave({
                title,

                dateKey:
                  isTimeOnly
                    ? dateKeyToday()
                    : dateKey,

                time,

                leadMinutes,
              })
            }
          >
            {picker.existingNode
              ? "Update"
              : isReminder
                ? "Create reminder"
                : "Insert"}
          </button>

          {picker.existingNode &&
            isReminder && (
            <button
              type="button"
              className="filter-chip"
              style={{
                color:
                  "#E68080",
              }}
              onClick={
                onDelete
              }
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ============================================================
   COMMAND RESULT ICON
============================================================ */

function ResultIcon({
  item,
  trigger,
}) {
  if (
    trigger === "/"
  ) {
    if (
      item.behavior ===
        "date-picker" ||
      item.behavior ===
        "time-picker"
    ) {
      return "◷";
    }

    if (
      item.behavior ===
      "reminder-picker"
    ) {
      return "♢";
    }

    if (
      item.behavior ===
      "mention"
    ) {
      return "@";
    }

    return "⌘";
  }


  if (
    item.type ===
    "task"
  ) {
    return "✓";
  }

  if (
    item.type ===
    "event"
  ) {
    return "◫";
  }

  if (
    item.type ===
      "date" ||
    item.type ===
      "datetime" ||
    item.type ===
      "time"
  ) {
    return "◷";
  }

  if (
    item.type ===
    "reminder" ||
    item.type.startsWith(
      "special-reminder"
    )
  ) {
    return "♢";
  }

  if (
    item.type ===
    "journal"
  ) {
    return "▤";
  }

  if (
    item.type ===
    "scratch"
  ) {
    return "✎";
  }

  if (
    item.type ===
    "goal"
  ) {
    return "◎";
  }

  if (
    item.type ===
    "area"
  ) {
    return "◉";
  }

  return "@";
}


/* ============================================================
   GLOBAL LAYER
============================================================ */

export function AbideCommandLayer() {
  const [
    state,
    setState,
  ] =
    useState(null);


  const [
    selectedIndex,
    setSelectedIndex,
  ] =
    useState(0);


  const [
    picker,
    setPicker,
  ] =
    useState(null);


  /* ----------------------------------------------------------
     Detect @ or /
     Supports MULTI-WORD queries.

     @next Wednesday at 1pm
     @remind tomorrow at 7pm
     @Coffee with Alex newsletter
     /date tomorrow 3pm
     /reminder next Friday 9am
  ---------------------------------------------------------- */

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


    // Important difference from the first Abide version:
    // everything after the trigger can contain spaces.
    const match =
      before.match(
        /(?:^|[\s([{"'])([@/])([^@/\n]*)$/
      );


    if (!match) {
      setState(null);
      return;
    }


    const trigger =
      match[1];


    const rawQuery =
      match[2] ||
      "";


    const query =
      rawQuery.trim();


    const results =
      trigger === "@"
        ? mentionResults(
            query
          )
        : slashResults(
            query
          );


    const rect =
      element
        .getBoundingClientRect();


    setSelectedIndex(
      0
    );


    setState({
      element,
      trigger,
      query,
      results,

      tokenLength:
        1 +
        rawQuery.length,

      rect,
    });
  };


  /* ----------------------------------------------------------
     Create/edit picker
  ---------------------------------------------------------- */

  const openPickerForCommand =
    (
      command,
      insertionPoint,
      initial = null
    ) => {
      let mode =
        "date";


      if (
        command.behavior ===
        "time-picker"
      ) {
        mode = "time";
      }


      if (
        command.behavior ===
        "reminder-picker"
      ) {
        mode =
          "reminder";
      }


      setPicker({
        mode,

        point:
          insertionPoint,

        prefix:
          command.prefix ||
          "",

        dateKey:
          initial?.dateKey ||
          dateKeyToday(),

        time:
          initial?.time ||
          "",

        title:
          initial?.title ||
          "Reminder",

        leadMinutes:
          Number(
            initial?.leadMinutes ||
            0
          ),

        reminderId:
          initial?.id ||
          null,

        existingNode:
          null,
      });
    };


  const openExistingMention =
    (
      node
    ) => {
      const type =
        node.dataset
          .abideType;


      const id =
        node.dataset
          .abideId;


      if (
        type ===
        "reminder"
      ) {
        const reminder =
          reminderById(
            id
          );


        if (!reminder) {
          return false;
        }


        setPicker({
          mode:
            "reminder",

          existingNode:
            node,

          reminderId:
            reminder.id,

          title:
            reminder.title,

          dateKey:
            reminder.dateKey,

          time:
            reminder.time,

          leadMinutes:
            reminder.leadMinutes ||
            0,
        });


        return true;
      }


      if (
        type ===
          "date" ||
        type ===
          "datetime" ||
        type ===
          "time"
      ) {
        setPicker({
          mode:
            type ===
              "time"
              ? "time"
              : "date",

          existingNode:
            node,

          dateKey:
            node.dataset
              .abideDate ||
            (
              type ===
                "time"
                ? dateKeyToday()
                : String(
                    id
                  )
                    .split(
                      "T"
                    )[0]
            ),

          time:
            node.dataset
              .abideTime ||
            (
              type ===
                "datetime"
                ? String(
                    id
                  )
                    .split(
                      "T"
                    )[1] ||
                  ""
                : type ===
                    "time"
                  ? id
                  : ""
            ),

          leadMinutes:
            0,
        });


        return true;
      }


      return false;
    };


  /* ----------------------------------------------------------
     Selection
  ---------------------------------------------------------- */

  const choose = (
    item
  ) => {
    if (!state) {
      return;
    }


    const {
      element,
      tokenLength,
      trigger,
    } =
      state;


    if (
      trigger === "@"
    ) {
      if (
        item.type ===
        "special-reminder"
      ) {
        const point =
          replaceTriggerToken(
            element,
            tokenLength,
            ""
          );


        setPicker({
          mode:
            "reminder",

          point,

          prefix: "",

          title:
            "Reminder",

          dateKey:
            dateKeyToday(),

          time:
            "09:00",

          leadMinutes:
            0,
        });


        setState(null);
        return;
      }


      if (
        item.type ===
        "special-reminder-smart"
      ) {
        const parsed =
          item.smartDate;


        const reminder =
          saveInlineReminder({
            title:
              "Reminder",

            dateKey:
              parsed.dateKey,

            time:
              parsed.time ||
              "09:00",

            leadMinutes:
              0,
          });


        replaceTriggerToken(
          element,
          tokenLength,

          `${referenceToken(
            reminderStructuredItem(
              reminder
            )
          )} `,

          referenceHtml(
            reminderStructuredItem(
              reminder
            )
          )
        );


        setState(null);
        return;
      }


      replaceTriggerToken(
        element,
        tokenLength,

        `${referenceToken(
          item
        )} `,

        referenceHtml(
          item
        )
      );


      setState(null);
      return;
    }


    /* --------------------------------------------------------
       Slash command
    -------------------------------------------------------- */

    const commandId =
      item.originalCommandId ||
      item.id;


    recordCommandUse(
      commandId
    );


    if (
      item.smartDate
    ) {
      const parsed =
        item.smartDate;


      if (
        item.behavior ===
        "reminder-picker"
      ) {
        const reminder =
          saveInlineReminder({
            title:
              "Reminder",

            dateKey:
              parsed.dateKey,

            time:
              parsed.time ||
              "09:00",

            leadMinutes:
              0,
          });


        replaceTriggerToken(
          element,
          tokenLength,

          `${item.prefix || ""}${referenceToken(
            reminderStructuredItem(
              reminder
            )
          )} `,

          `${escapeHtml(
            item.prefix ||
            ""
          )}${referenceHtml(
            reminderStructuredItem(
              reminder
            )
          )}`
        );
      } else if (
        item.behavior ===
        "time-picker"
      ) {
        const time =
          parsed.time ||
          "09:00";


        replaceTriggerToken(
          element,
          tokenLength,

          `${item.prefix || ""}${referenceToken(
            structuredTimeItem(
              time
            )
          )} `,

          `${escapeHtml(
            item.prefix ||
            ""
          )}${referenceHtml(
            structuredTimeItem(
              time
            )
          )}`
        );
      } else {
        const dateItem =
          structuredDateItem(
            parsed.dateKey,
            parsed.time
          );


        replaceTriggerToken(
          element,
          tokenLength,

          `${item.prefix || ""}${referenceToken(
            dateItem
          )} `,

          `${escapeHtml(
            item.prefix ||
            ""
          )}${referenceHtml(
            dateItem
          )}`
        );
      }


      setState(null);
      return;
    }


    if (
      [
        "date-picker",
        "time-picker",
        "reminder-picker",
      ].includes(
        item.behavior
      )
    ) {
      const point =
        replaceTriggerToken(
          element,
          tokenLength,
          ""
        );


      openPickerForCommand(
        item,
        point
      );


      setState(null);
      return;
    }


    if (
      item.behavior ===
      "mention"
    ) {
      replaceTriggerToken(
        element,
        tokenLength,
        "@"
      );


      // Force the global input listener
      // to immediately open @ search.
      element.dispatchEvent(
        new Event(
          "input",
          {
            bubbles:
              true,
          }
        )
      );


      setState(null);
      return;
    }


    if (
      [
        "bullet",
        "numbered",
        "quote",
        "h1",
        "h2",
        "h3",
        "format-text",
      ].includes(
        item.behavior
      )
    ) {
      const point =
        replaceTriggerToken(
          element,
          tokenLength,
          ""
        );


      if (
        !runBlockBehavior(
          element,
          item.behavior
        )
      ) {
        // Plain fields still get a sensible text fallback.
        const fallbacks = {
          bullet:
            "• ",

          numbered:
            "1. ",

          quote:
            "> ",

          h1:
            "# ",

          h2:
            "## ",

          h3:
            "### ",

          "format-text":
            "",
        };


        insertAtPoint(
          point,
          fallbacks[
            item.behavior
          ] ||
          ""
        );
      }


      setState(null);
      return;
    }


    if (
      item.action
    ) {
      replaceTriggerToken(
        element,
        tokenLength,
        ""
      );


      item.action();


      setState(null);
      return;
    }


    replaceTriggerToken(
      element,
      tokenLength,
      item.insert ||
      ""
    );


    setState(null);
  };


  /* ----------------------------------------------------------
     Picker save
  ---------------------------------------------------------- */

  const savePicker =
    (value) => {
      if (!picker) {
        return;
      }


      if (
        picker.mode ===
        "reminder"
      ) {
        const reminder =
          saveInlineReminder({
            id:
              picker.reminderId,

            title:
              value.title,

            dateKey:
              value.dateKey,

            time:
              value.time ||
              "09:00",

            leadMinutes:
              value.leadMinutes,
          });


        const item =
          reminderStructuredItem(
            reminder
          );


        if (
          picker.existingNode
        ) {
          const node =
            picker.existingNode;


          node.dataset
            .abideType =
            "reminder";

          node.dataset
            .abideId =
            reminder.id;

          node.dataset
            .abideLabel =
            reminder.title;

          node.dataset
            .abideDate =
            reminder.dateKey;

          node.dataset
            .abideTime =
            reminder.time;

          node.textContent =
            `@${reminder.title}`;


          const editor =
            node.closest(
              '[contenteditable="true"]'
            );


          editor?.dispatchEvent(
            new Event(
              "input",
              {
                bubbles:
                  true,
              }
            )
          );
        } else {
          structuredInsert(
            picker.point,
            item,
            picker.prefix ||
            ""
          );
        }


        setPicker(null);
        return;
      }


      const item =
        picker.mode ===
        "time"
          ? structuredTimeItem(
              value.time ||
              "09:00"
            )
          : structuredDateItem(
              value.dateKey,
              value.time
            );


      if (
        picker.existingNode
      ) {
        const node =
          picker.existingNode;


        node.dataset
          .abideType =
          item.type;

        node.dataset
          .abideId =
          referenceId(
            item
          );

        node.dataset
          .abideLabel =
          item.label;


        if (
          item.dateKey
        ) {
          node.dataset
            .abideDate =
            item.dateKey;
        } else {
          delete node.dataset
            .abideDate;
        }


        if (
          item.time
        ) {
          node.dataset
            .abideTime =
            item.time;
        } else {
          delete node.dataset
            .abideTime;
        }


        node.textContent =
          `@${item.label}`;


        const editor =
          node.closest(
            '[contenteditable="true"]'
          );


        editor?.dispatchEvent(
          new Event(
            "input",
            {
              bubbles:
                true,
            }
          )
        );
      } else {
        structuredInsert(
          picker.point,
          item,
          picker.prefix ||
          ""
        );
      }


      setPicker(null);
    };


  const deletePickerReminder =
    () => {
      if (
        !picker
          ?.reminderId
      ) {
        setPicker(null);
        return;
      }


      deleteInlineReminder(
        picker.reminderId
      );


      if (
        picker.existingNode
      ) {
        const parent =
          picker.existingNode
            .parentElement;


        picker.existingNode
          .remove();


        parent?.dispatchEvent(
          new Event(
            "input",
            {
              bubbles:
                true,
            }
          )
        );
      }


      setPicker(null);
    };


  /* ----------------------------------------------------------
     Global input / mention click events
  ---------------------------------------------------------- */

  useEffect(
    () => {
      const onInput =
        (event) =>
          refresh(
            event
          );


      const onKeyUp =
        (event) => {
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


          refresh(
            event
          );
        };


      const onMentionClick =
        (event) => {
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


          if (
            openExistingMention(
              mention
            )
          ) {
            return;
          }


          navigateToAbideItem(
            mention.dataset
              .abideType,

            mention.dataset
              .abideId,

            {
              dateKey:
                mention.dataset
                  .abideDate,
            }
          );
        };


      const refreshLabels =
        () =>
          window.setTimeout(
            refreshRenderedMentions,
            10
          );


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


      window.addEventListener(
        "abide-local-data-changed",
        refreshLabels
      );


      window.addEventListener(
        "focus",
        refreshLabels
      );


      document.addEventListener(
        "visibilitychange",
        refreshLabels
      );


      refreshLabels();


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


        window.removeEventListener(
          "abide-local-data-changed",
          refreshLabels
        );


        window.removeEventListener(
          "focus",
          refreshLabels
        );


        document.removeEventListener(
          "visibilitychange",
          refreshLabels
        );
      };
    },
    []
  );


  /* ----------------------------------------------------------
     Keyboard navigation
  ---------------------------------------------------------- */

  useEffect(
    () => {
      const onKeyDown =
        (event) => {
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
    },
    [
      state,
      selectedIndex,
    ]
  );


  /* ----------------------------------------------------------
     Local reminder fallback

     Server push is authoritative when a Firebase device token
     exists. If this browser has no FCM registration, Abide can
     still fire while the app is open.
  ---------------------------------------------------------- */

  useEffect(
    () => {
      const check =
        () => {
          if (
            typeof Notification ===
              "undefined" ||
            Notification.permission !==
              "granted"
          ) {
            return;
          }


          // Avoid duplicates when the existing Firebase
          // background scheduler owns delivery.
          if (
            localStorage.getItem(
              "abide-fcm-device-token-local"
            )
          ) {
            return;
          }


          const reminders =
            inlineReminders();


          if (
            !reminders.length
          ) {
            return;
          }


          const now =
            Date.now();


          let changed =
            false;


          const next =
            reminders.map(
              (reminder) => {
                if (
                  reminder.disabled ||
                  reminder.firedAt ||
                  !reminder.fireDateKey ||
                  !reminder.fireTime
                ) {
                  return reminder;
                }


                const moment =
                  new Date(
                    `${reminder.fireDateKey}T${reminder.fireTime}:00`
                  );


                if (
                  Number.isNaN(
                    moment.getTime()
                  )
                ) {
                  return reminder;
                }


                const diff =
                  now -
                  moment.getTime();


                if (
                  diff < 0 ||
                  diff >
                    90 * 1000
                ) {
                  return reminder;
                }


                try {
                  new Notification(
                    reminder.title ||
                    "Abide reminder",
                    {
                      body:
                        `For ${dateTimeLabel(
                          reminder.dateKey,
                          reminder.time
                        )}`,

                      tag:
                        `abide-inline-${reminder.id}`,
                    }
                  );


                  changed =
                    true;


                  return {
                    ...reminder,

                    firedAt:
                      Date.now(),
                  };
                } catch {
                  return reminder;
                }
              }
            );


          if (changed) {
            writeStorage(
              INLINE_REMINDER_KEY,
              next
            );
          }
        };


      check();


      const timer =
        window.setInterval(
          check,
          30000
        );


      return () =>
        window.clearInterval(
          timer
        );
    },
    []
  );


  /* ----------------------------------------------------------
     Render
  ---------------------------------------------------------- */

  const overlayStyle =
    useMemo(
      () => {
        if (!state) {
          return {};
        }


        const width =
          Math.min(
            380,
            window.innerWidth -
              16
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
            56,

            Math.min(
              state.rect.bottom +
                6,

              window.innerHeight -
                380
            )
          );


        return {
          width,
          left,
          top,
        };
      },
      [
        state,
      ]
    );


  return (
    <>
      {picker && (
        <DateReminderPicker
          picker={
            picker
          }
          onClose={() =>
            setPicker(
              null
            )
          }
          onSave={
            savePicker
          }
          onDelete={
            deletePickerReminder
          }
        />
      )}


      {state &&
        state.results
          ?.length >
          0 &&
        createPortal(
          <div
            className="abide-command-overlay"
            style={
              overlayStyle
            }
            onPointerDown={(
              event
            ) =>
              event.preventDefault()
            }
          >
            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                alignItems:
                  "center",

                padding:
                  "6px 8px 8px",

                borderBottom:
                  "1px solid var(--divider)",

                marginBottom:
                  4,
              }}
            >
              <div
                style={{
                  fontSize:
                    10,

                  fontWeight:
                    800,

                  color:
                    "var(--text3)",

                  letterSpacing:
                    .45,
                }}
              >
                {state.trigger ===
                "@"
                  ? "@ CONNECT"
                  : "/ COMMAND"}
              </div>

              <div
                style={{
                  fontSize:
                    9,

                  color:
                    "var(--text3)",
                }}
              >
                ↑ ↓ · Enter · Esc
              </div>
            </div>


            {state.results.map(
              (
                item,
                index
              ) => (
                <button
                  type="button"
                  key={`${item.type || item.category || "command"}:${item.id}:${index}`}
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

                    choose(
                      item
                    );
                  }}
                >
                  <div
                    style={{
                      width:
                        28,

                      height:
                        28,

                      borderRadius:
                        8,

                      background:
                        "var(--pillBg)",

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",

                      flexShrink:
                        0,

                      color:
                        "var(--text2)",

                      fontWeight:
                        800,

                      fontSize:
                        12,
                    }}
                  >
                    <ResultIcon
                      item={
                        item
                      }
                      trigger={
                        state.trigger
                      }
                    />
                  </div>

                  <div
                    style={{
                      minWidth:
                        0,

                      flex: 1,
                    }}
                  >
                    <div className="abide-command-result-title">
                      {state.trigger ===
                      "@"
                        ? "@"
                        : "/"}
                      {item.label}
                    </div>

                    <div className="abide-command-result-meta">
                      {item.meta ||
                        item.description ||
                        item.type ||
                        item.category}
                    </div>
                  </div>

                  {item.category && (
                    <div
                      style={{
                        fontSize:
                          9,

                        color:
                          "var(--text3)",

                        paddingTop:
                          3,

                        flexShrink:
                          0,
                      }}
                    >
                      {item.category}
                    </div>
                  )}
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
}
