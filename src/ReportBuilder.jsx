import React, {
  useEffect,
  useMemo,
  useState,
} from "react";


/* =========================================================
   ABIDE REPORT BUILDER V1
   Custom filters · columns · sort · group · presets
   CSV · Excel · Word · PDF · ZIP
   ========================================================= */


const SUBJECT_LABELS = {
  tasks: "Tasks",
  goals: "Goals",
  journal: "Journal",
  notes: "Notes",
  areas: "Areas",
  insights: "Insights",
  everything: "Everything",
};


const EVERYTHING_SUBJECTS = [
  "tasks",
  "goals",
  "areas",
  "journal",
  "notes",
  "insights",
];


function localDateKey(
  date = new Date()
) {
  const y =
    date.getFullYear();

  const m =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const d =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${y}-${m}-${d}`;
}


function parseDateKey(value) {
  if (!value) return null;

  const text =
    String(value).slice(0, 10);

  const [
    y,
    m,
    d,
  ] =
    text
      .split("-")
      .map(Number);

  if (
    !y ||
    !m ||
    !d
  ) {
    return null;
  }

  return new Date(
    y,
    m - 1,
    d,
    12,
    0,
    0
  );
}


function shiftDateKey(
  key,
  amount
) {
  const date =
    parseDateKey(key);

  if (!date) {
    return key;
  }

  date.setDate(
    date.getDate() +
    Number(amount || 0)
  );

  return localDateKey(date);
}


function compareDateKeys(
  a,
  b
) {
  return String(
    a || ""
  ).localeCompare(
    String(b || "")
  );
}


function currentWeekRange() {
  const today =
    parseDateKey(
      localDateKey()
    );

  let weekStart =
    "sunday";

  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          "abide-week-start"
        )
      );

    if (
      stored === "monday"
    ) {
      weekStart =
        "monday";
    }
  } catch {}

  const wanted =
    weekStart === "monday"
      ? 1
      : 0;

  const difference =
    (
      today.getDay()
      - wanted
      + 7
    ) % 7;

  const start =
    new Date(today);

  start.setDate(
    start.getDate()
    - difference
  );

  const end =
    new Date(start);

  end.setDate(
    start.getDate() + 6
  );

  return {
    start:
      localDateKey(start),

    end:
      localDateKey(end),
  };
}


function readNotes() {
  if (
    typeof window ===
    "undefined"
  ) {
    return [];
  }

  const results = [];
  const seen =
    new Set();


  const noteText =
    (note) => {
      if (
        Array.isArray(
          note?.blocks
        )
      ) {
        return note.blocks
          .map((block) => {
            if (
              typeof block ===
              "string"
            ) {
              return block;
            }

            if (
              typeof block?.text ===
              "string"
            ) {
              return block.text;
            }

            if (
              typeof block?.content ===
              "string"
            ) {
              return block.content;
            }

            if (
              Array.isArray(
                block?.content
              )
            ) {
              return block.content
                .map(
                  (part) =>
                    typeof part ===
                    "string"
                      ? part
                      : part?.text ||
                        ""
                )
                .join("");
            }

            return "";
          })
          .filter(Boolean)
          .join("\n\n");
      }

      return String(
        note?.content ||
        note?.body ||
        note?.text ||
        ""
      );
    };


  const visit =
    (
      value,
      storageKey
    ) => {
      if (!value) return;

      if (
        Array.isArray(value)
      ) {
        value.forEach(
          (item) =>
            visit(
              item,
              storageKey
            )
        );

        return;
      }

      if (
        typeof value !==
        "object"
      ) {
        return;
      }

      const looksLikeNote =
        value.title ||
        value.blocks ||
        value.content ||
        value.body ||
        value.text;

      if (looksLikeNote) {
        const identity =
          String(
            value.id ||
            value.noteId ||
            value.title ||
            JSON.stringify(
              value.blocks ||
              value.content ||
              value.body ||
              value.text ||
              ""
            )
          );

        if (
          !seen.has(identity)
        ) {
          seen.add(identity);

          results.push({
            ...value,

            _storageKey:
              storageKey,

            _plainText:
              noteText(value),
          });
        }

        return;
      }

      Object.values(value)
        .forEach(
          (child) =>
            visit(
              child,
              storageKey
            )
        );
    };


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

    if (!key) {
      continue;
    }

    const lower =
      key.toLowerCase();

    if (
      !lower.includes(
        "note"
      ) &&
      !lower.includes(
        "scratch"
      )
    ) {
      continue;
    }

    try {
      const parsed =
        JSON.parse(
          localStorage.getItem(
            key
          )
        );

      visit(
        parsed,
        key
      );
    } catch {}
  }

  return results;
}


function csvValue(value) {
  if (value == null) {
    return "";
  }

  const text =
    typeof value ===
    "object"
      ? JSON.stringify(value)
      : String(value);

  return `"${text.replace(
    /"/g,
    '""'
  )}"`;
}


function rowsToCsv(
  rows,
  fields
) {
  return [
    fields
      .map(
        (field) =>
          csvValue(
            field.label
          )
      )
      .join(","),

    ...rows.map(
      (row) =>
        fields
          .map(
            (field) =>
              csvValue(
                row[
                  field.key
                ]
              )
          )
          .join(",")
    ),
  ].join("\n");
}


function downloadFile(
  filename,
  content,
  mime =
    "application/octet-stream"
) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob(
          [content],
          {
            type:
              `${mime};charset=utf-8`,
          }
        );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;
  link.download =
    filename;

  document.body
    .appendChild(link);

  link.click();
  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1200
  );
}


function normalizeText(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function truthy(value) {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1" ||
    value === "yes"
  );
}


function operatorOptions(
  type
) {
  if (type === "date") {
    return [
      ["on", "is"],
      [
        "before",
        "is before",
      ],
      [
        "after",
        "is after",
      ],
      [
        "between",
        "is between",
      ],
      [
        "next_n_days",
        "is within the next",
      ],
      [
        "previous_n_days",
        "is within the previous",
      ],
      [
        "more_than_n_overdue",
        "is more than",
      ],
      [
        "today",
        "is today",
      ],
      [
        "tomorrow",
        "is tomorrow",
      ],
      [
        "this_week",
        "is this week",
      ],
      [
        "next_week",
        "is next week",
      ],
      [
        "this_month",
        "is this month",
      ],
      [
        "empty",
        "has no date",
      ],
      [
        "not_empty",
        "has a date",
      ],
    ];
  }


  if (type === "number") {
    return [
      ["eq", "equals"],
      [
        "neq",
        "does not equal",
      ],
      [
        "gt",
        "is greater than",
      ],
      [
        "gte",
        "is at least",
      ],
      [
        "lt",
        "is less than",
      ],
      [
        "lte",
        "is at most",
      ],
      [
        "between",
        "is between",
      ],
    ];
  }


  if (type === "boolean") {
    return [
      [
        "true",
        "is yes",
      ],
      [
        "false",
        "is no",
      ],
    ];
  }


  if (type === "select") {
    return [
      ["equals", "is"],
      [
        "not_equals",
        "is not",
      ],
      [
        "one_of",
        "is any of",
      ],
      [
        "not_one_of",
        "is none of",
      ],
      [
        "empty",
        "is empty",
      ],
      [
        "not_empty",
        "is not empty",
      ],
    ];
  }


  return [
    [
      "contains",
      "contains",
    ],
    [
      "not_contains",
      "does not contain",
    ],
    [
      "equals",
      "equals",
    ],
    [
      "not_equals",
      "does not equal",
    ],
    [
      "starts_with",
      "starts with",
    ],
    [
      "ends_with",
      "ends with",
    ],
    [
      "empty",
      "is empty",
    ],
    [
      "not_empty",
      "is not empty",
    ],
  ];
}


function defaultOperator(
  type
) {
  if (type === "date") {
    return "on";
  }

  if (type === "number") {
    return "eq";
  }

  if (type === "boolean") {
    return "true";
  }

  if (type === "select") {
    return "equals";
  }

  return "contains";
}


function filterMatches(
  row,
  filter,
  field
) {
  const raw =
    row?.[filter.field];

  const op =
    filter.operator;


  if (
    field.type ===
    "boolean"
  ) {
    if (op === "true") {
      return truthy(raw);
    }

    return !truthy(raw);
  }


  if (
    field.type ===
    "number"
  ) {
    const current =
      Number(raw);

    const first =
      Number(
        filter.value
      );

    const second =
      Number(
        filter.value2
      );

    if (
      Number.isNaN(current)
    ) {
      return false;
    }

    if (op === "eq") {
      return (
        current === first
      );
    }

    if (op === "neq") {
      return (
        current !== first
      );
    }

    if (op === "gt") {
      return (
        current > first
      );
    }

    if (op === "gte") {
      return (
        current >= first
      );
    }

    if (op === "lt") {
      return (
        current < first
      );
    }

    if (op === "lte") {
      return (
        current <= first
      );
    }

    if (
      op === "between"
    ) {
      return (
        current >= first &&
        current <= second
      );
    }

    return true;
  }


  if (
    field.type === "date"
  ) {
    const current =
      raw
        ? String(raw)
            .slice(0, 10)
        : "";

    const today =
      localDateKey();


    if (op === "empty") {
      return !current;
    }

    if (
      op ===
      "not_empty"
    ) {
      return Boolean(
        current
      );
    }

    if (!current) {
      return false;
    }


    if (op === "on") {
      return (
        current ===
        filter.value
      );
    }

    if (
      op === "before"
    ) {
      return (
        current <
        filter.value
      );
    }

    if (
      op === "after"
    ) {
      return (
        current >
        filter.value
      );
    }

    if (
      op === "between"
    ) {
      return (
        current >=
          filter.value &&
        current <=
          filter.value2
      );
    }

    if (
      op ===
      "next_n_days"
    ) {
      const days =
        Math.max(
          0,
          Number(
            filter.value ||
            0
          )
        );

      return (
        current >= today &&
        current <=
          shiftDateKey(
            today,
            days
          )
      );
    }

    if (
      op ===
      "previous_n_days"
    ) {
      const days =
        Math.max(
          0,
          Number(
            filter.value ||
            0
          )
        );

      return (
        current <= today &&
        current >=
          shiftDateKey(
            today,
            -days
          )
      );
    }

    if (
      op ===
      "more_than_n_overdue"
    ) {
      const days =
        Math.max(
          0,
          Number(
            filter.value ||
            0
          )
        );

      return (
        current <
        shiftDateKey(
          today,
          -days
        )
      );
    }

    if (
      op === "today"
    ) {
      return (
        current === today
      );
    }

    if (
      op ===
      "tomorrow"
    ) {
      return (
        current ===
        shiftDateKey(
          today,
          1
        )
      );
    }

    if (
      op ===
      "this_week"
    ) {
      const range =
        currentWeekRange();

      return (
        current >=
          range.start &&
        current <=
          range.end
      );
    }

    if (
      op ===
      "next_week"
    ) {
      const range =
        currentWeekRange();

      const start =
        shiftDateKey(
          range.end,
          1
        );

      const end =
        shiftDateKey(
          start,
          6
        );

      return (
        current >= start &&
        current <= end
      );
    }

    if (
      op ===
      "this_month"
    ) {
      return (
        current.slice(
          0,
          7
        ) ===
        today.slice(
          0,
          7
        )
      );
    }

    return true;
  }


  const current =
    normalizeText(raw);

  const expected =
    normalizeText(
      filter.value
    );


  if (op === "empty") {
    return !current;
  }

  if (
    op === "not_empty"
  ) {
    return Boolean(
      current
    );
  }


  if (
    op === "one_of" ||
    op ===
      "not_one_of"
  ) {
    const options =
      String(
        filter.value ||
        ""
      )
        .split(",")
        .map(
          normalizeText
        )
        .filter(Boolean);

    const match =
      options.includes(
        current
      );

    return op ===
      "one_of"
      ? match
      : !match;
  }


  if (
    op === "contains"
  ) {
    return current.includes(
      expected
    );
  }

  if (
    op ===
    "not_contains"
  ) {
    return !current.includes(
      expected
    );
  }

  if (
    op === "equals"
  ) {
    return (
      current === expected
    );
  }

  if (
    op ===
    "not_equals"
  ) {
    return (
      current !== expected
    );
  }

  if (
    op ===
    "starts_with"
  ) {
    return current.startsWith(
      expected
    );
  }

  if (
    op ===
    "ends_with"
  ) {
    return current.endsWith(
      expected
    );
  }

  return true;
}


function applyFilters(
  rows,
  filters,
  fields
) {
  if (!filters.length) {
    return rows;
  }

  const fieldMap =
    Object.fromEntries(
      fields.map(
        (field) => [
          field.key,
          field,
        ]
      )
    );


  return rows.filter(
    (row) => {
      let result = null;

      filters.forEach(
        (
          filter,
          index
        ) => {
          const field =
            fieldMap[
              filter.field
            ];

          if (!field) {
            return;
          }

          const current =
            filterMatches(
              row,
              filter,
              field
            );

          if (
            index === 0 ||
            result === null
          ) {
            result =
              current;

            return;
          }

          if (
            filter.join ===
            "or"
          ) {
            result =
              result ||
              current;
          } else {
            result =
              result &&
              current;
          }
        }
      );

      return result !==
        false;
    }
  );
}


function sortRows(
  rows,
  field,
  direction
) {
  if (!field) {
    return rows;
  }

  const multiplier =
    direction === "desc"
      ? -1
      : 1;

  return [
    ...rows,
  ].sort(
    (a, b) => {
      const left =
        a?.[field];

      const right =
        b?.[field];

      if (
        typeof left ===
          "number" &&
        typeof right ===
          "number"
      ) {
        return (
          left - right
        ) * multiplier;
      }

      return String(
        left ?? ""
      ).localeCompare(
        String(
          right ?? ""
        ),
        undefined,
        {
          numeric: true,
          sensitivity:
            "base",
        }
      ) * multiplier;
    }
  );
}


function groupRows(
  rows,
  field
) {
  if (!field) {
    return [
      {
        label: "",
        rows,
      },
    ];
  }

  const map =
    new Map();

  rows.forEach(
    (row) => {
      const label =
        String(
          row?.[field] ||
          "Unassigned"
        );

      if (
        !map.has(label)
      ) {
        map.set(
          label,
          []
        );
      }

      map.get(label)
        .push(row);
    }
  );

  return Array.from(
    map.entries()
  ).map(
    ([label, items]) => ({
      label,
      rows: items,
    })
  );
}


function makeFilter(
  field,
  index = 0
) {
  return {
    id:
      `${Date.now()}_${Math.random()}`,

    join:
      index === 0
        ? "and"
        : "and",

    field:
      field.key,

    operator:
      defaultOperator(
        field.type
      ),

    value:
      field.type ===
      "date"
        ? localDateKey()
        : "",

    value2:
      "",
  };
}


function subjectDefinitions({
  tasks,
  goals,
  areas,
  journalEntries,
  notes,
}) {
  const areaName =
    (id) =>
      areas?.[id]
        ?.name ||
      "";

  const goalMap =
    Object.fromEntries(
      goals.map(
        (goal) => [
          String(goal.id),
          goal.name ||
          "",
        ]
      )
    );


  const taskDate =
    (task) => {
      if (
        task.dueDate
      ) {
        return task.dueDate;
      }

      if (
        Number.isFinite(
          Number(
            task.dueOffsetDays
          )
        )
      ) {
        return shiftDateKey(
          localDateKey(),
          Number(
            task.dueOffsetDays
          )
        );
      }

      return "";
    };


  const taskRows =
    tasks.map(
      (task) => {
        const dueDate =
          taskDate(task);

        return {
          id:
            task.id || "",

          title:
            task.title || "",

          area:
            areaName(
              task.area
            ),

          areaId:
            task.area || "",

          goal:
            goalMap[
              String(
                task.goal
              )
            ] || "",

          goalId:
            task.goal || "",

          dueDate,

          dueTime:
            task.dueTime ||
            "",

          finishBy:
            task.targetDate ||
            "",

          priority:
            task.priority ||
            "",

          status:
            task.status || "",

          progress:
            task.done
              ? "completed"
              : task.progress ||
                "not_started",

          completed:
            Boolean(
              task.done
            ),

          overdue:
            Boolean(
              !task.done &&
              dueDate &&
              dueDate <
                localDateKey()
            ),

          isSubtask:
            Boolean(
              task.parentTaskId
            ),

          parentTaskId:
            task.parentTaskId ||
            "",

          hasGoal:
            Boolean(
              task.goal
            ),

          reminder:
            task.reminder || "",

          recurrence:
            task.recurrence ||
            task.repeat ||
            "",

          notes:
            task.notes || "",

          createdAt:
            task.createdAt
              ? String(
                  task.createdAt
                ).slice(
                  0,
                  10
                )
              : "",

          updatedAt:
            task.updatedAt
              ? String(
                  task.updatedAt
                ).slice(
                  0,
                  10
                )
              : "",

          completedAt:
            task.completedAt
              ? String(
                  task.completedAt
                ).slice(
                  0,
                  10
                )
              : "",
        };
      }
    );


  const goalRows =
    goals.map(
      (goal) => {
        const linked =
          tasks.filter(
            (task) =>
              String(
                task.goal ||
                ""
              ) ===
              String(
                goal.id ||
                ""
              )
          );

        return {
          id:
            goal.id || "",

          goal:
            goal.name || "",

          area:
            areaName(
              goal.area
            ),

          targetDate:
            goal.targetDate ||
            "",

          progress:
            goal.progress ??
            0,

          notes:
            goal.notes || "",

          linkedTasks:
            linked.length,

          overdueTasks:
            linked.filter(
              (task) => {
                const due =
                  taskDate(
                    task
                  );

                return (
                  !task.done &&
                  due &&
                  due <
                    localDateKey()
                );
              }
            ).length,

          createdAt:
            goal.createdAt
              ? String(
                  goal.createdAt
                ).slice(
                  0,
                  10
                )
              : "",

          updatedAt:
            goal.updatedAt
              ? String(
                  goal.updatedAt
                ).slice(
                  0,
                  10
                )
              : "",
        };
      }
    );


  const journalRows =
    journalEntries.map(
      (entry) => ({
        id:
          entry.id || "",

        date:
          entry.dateKey ||
          (
            /^\d{4}-\d{2}-\d{2}$/.test(
              entry.date ||
              ""
            )
              ? entry.date
              : ""
          ),

        displayDate:
          entry.date || "",

        scripture:
          entry.ref ||
          entry.scriptureRef ||
          "",

        entry:
          entry.note || "",

        favorite:
          Boolean(
            entry.favorite
          ),

        tag:
          entry.tag || "",

        createdAt:
          entry.createdAt
            ? String(
                entry.createdAt
              ).slice(
                0,
                10
              )
            : "",

        updatedAt:
          entry.updatedAt
            ? String(
                entry.updatedAt
              ).slice(
                0,
                10
              )
            : "",
      })
    );


  const noteRows =
    notes.map(
      (
        note,
        index
      ) => {
        const text =
          note._plainText ||
          "";

        const blocks =
          Array.isArray(
            note.blocks
          )
            ? note.blocks
            : [];

        return {
          id:
            note.id ||
            `note-${index + 1}`,

          title:
            note.title ||
            note.name ||
            `Note ${index + 1}`,

          text,

          createdAt:
            note.createdAt
              ? String(
                  note.createdAt
                ).slice(
                  0,
                  10
                )
              : "",

          updatedAt:
            note.updatedAt
              ? String(
                  note.updatedAt
                ).slice(
                  0,
                  10
                )
              : "",

          hasLinks:
            /https?:\/\//i.test(
              text
            ),

          hasImages:
            blocks.some(
              (block) =>
                String(
                  block?.type ||
                  ""
                )
                  .toLowerCase()
                  .includes(
                    "image"
                  )
            ),

          hasChecklist:
            blocks.some(
              (block) =>
                [
                  "todo",
                  "to-do",
                  "checklist",
                ].includes(
                  String(
                    block?.type ||
                    ""
                  ).toLowerCase()
                )
            ),

          hasHeadings:
            blocks.some(
              (block) =>
                String(
                  block?.type ||
                  ""
                )
                  .toLowerCase()
                  .includes(
                    "heading"
                  )
            ),
        };
      }
    );


  const areaRows =
    Object.entries(
      areas || {}
    ).map(
      ([id, area]) => {
        const items =
          tasks.filter(
            (task) =>
              task.area === id
          );

        const topLevel =
          items.filter(
            (task) =>
              !task.parentTaskId
          );

        return {
          id,

          area:
            area.name,

          totalRecords:
            items.length,

          independentTasks:
            topLevel.length,

          subtasks:
            items.filter(
              (task) =>
                Boolean(
                  task.parentTaskId
                )
            ).length,

          openTasks:
            topLevel.filter(
              (task) =>
                !task.done
            ).length,

          overdueTasks:
            topLevel.filter(
              (task) => {
                const due =
                  taskDate(
                    task
                  );

                return (
                  !task.done &&
                  due &&
                  due <
                    localDateKey()
                );
              }
            ).length,

          completedTasks:
            topLevel.filter(
              (task) =>
                task.done
            ).length,

          goals:
            goals.filter(
              (goal) =>
                goal.area === id
            ).length,
        };
      }
    );


  const completed =
    tasks.filter(
      (task) =>
        task.done
    ).length;

  const topLevel =
    tasks.filter(
      (task) =>
        !task.parentTaskId
    ).length;

  const subtasks =
    tasks.filter(
      (task) =>
        Boolean(
          task.parentTaskId
        )
    ).length;


  const insightRows = [
    {
      metric:
        "Total task records",
      value:
        tasks.length,
    },
    {
      metric:
        "Independent tasks",
      value:
        topLevel,
    },
    {
      metric:
        "Subtasks",
      value:
        subtasks,
    },
    {
      metric:
        "Completed task records",
      value:
        completed,
    },
    {
      metric:
        "Completion rate",
      value:
        tasks.length
          ? `${Math.round(
              completed /
              tasks.length *
              100
            )}%`
          : "0%",
    },
    {
      metric:
        "Goals",
      value:
        goals.length,
    },
    {
      metric:
        "Journal entries",
      value:
        journalEntries.length,
    },
    {
      metric:
        "Favorite journal entries",
      value:
        journalEntries.filter(
          (entry) =>
            entry.favorite
        ).length,
    },
    {
      metric:
        "Notes",
      value:
        notes.length,
    },
    {
      metric:
        "Areas",
      value:
        Object.keys(
          areas || {}
        ).length,
    },
  ];


  const areaOptions =
    Object.values(
      areas || {}
    )
      .map(
        (area) =>
          area.name
      )
      .filter(Boolean);


  const goalOptions =
    goals
      .map(
        (goal) =>
          goal.name
      )
      .filter(Boolean);


  return {
    tasks: {
      rows:
        taskRows,

      fields: [
        {
          key: "title",
          label: "Title",
          type: "text",
          default: true,
        },
        {
          key: "area",
          label: "Area",
          type: "select",
          options:
            areaOptions,
          default: true,
        },
        {
          key: "goal",
          label: "Goal",
          type: "select",
          options:
            goalOptions,
          default: true,
        },
        {
          key: "dueDate",
          label: "Due Date",
          type: "date",
          default: true,
        },
        {
          key: "dueTime",
          label: "Due Time",
          type: "text",
          default: false,
        },
        {
          key: "finishBy",
          label: "Finish By",
          type: "date",
          default: true,
        },
        {
          key: "priority",
          label: "Priority",
          type: "select",
          options: [
            "high",
            "med",
            "low",
          ],
          default: true,
        },
        {
          key: "status",
          label: "Status",
          type: "text",
          default: true,
        },
        {
          key: "progress",
          label: "Progress",
          type: "select",
          options: [
            "not_started",
            "in_progress",
            "completed",
          ],
          default: true,
        },
        {
          key: "completed",
          label: "Completed",
          type: "boolean",
          default: true,
        },
        {
          key: "overdue",
          label: "Overdue",
          type: "boolean",
          default: false,
        },
        {
          key: "isSubtask",
          label: "Is Subtask",
          type: "boolean",
          default: false,
        },
        {
          key: "parentTaskId",
          label: "Parent Task ID",
          type: "text",
          default: false,
        },
        {
          key: "hasGoal",
          label: "Has Goal",
          type: "boolean",
          default: false,
        },
        {
          key: "reminder",
          label: "Reminder",
          type: "text",
          default: false,
        },
        {
          key: "recurrence",
          label: "Recurrence",
          type: "text",
          default: false,
        },
        {
          key: "notes",
          label: "Notes",
          type: "text",
          default: true,
        },
        {
          key: "createdAt",
          label: "Created",
          type: "date",
          default: false,
        },
        {
          key: "updatedAt",
          label: "Updated",
          type: "date",
          default: false,
        },
        {
          key: "completedAt",
          label: "Completed Date",
          type: "date",
          default: false,
        },
      ],
    },


    goals: {
      rows:
        goalRows,

      fields: [
        {
          key: "goal",
          label: "Goal",
          type: "text",
          default: true,
        },
        {
          key: "area",
          label: "Area",
          type: "select",
          options:
            areaOptions,
          default: true,
        },
        {
          key: "targetDate",
          label: "Target Date",
          type: "date",
          default: true,
        },
        {
          key: "progress",
          label: "Progress",
          type: "number",
          default: true,
        },
        {
          key: "linkedTasks",
          label: "Linked Tasks",
          type: "number",
          default: true,
        },
        {
          key: "overdueTasks",
          label: "Overdue Tasks",
          type: "number",
          default: true,
        },
        {
          key: "notes",
          label: "Notes",
          type: "text",
          default: true,
        },
        {
          key: "createdAt",
          label: "Created",
          type: "date",
          default: false,
        },
        {
          key: "updatedAt",
          label: "Updated",
          type: "date",
          default: false,
        },
      ],
    },


    journal: {
      rows:
        journalRows,

      fields: [
        {
          key: "date",
          label: "Date",
          type: "date",
          default: true,
        },
        {
          key: "scripture",
          label: "Scripture",
          type: "text",
          default: true,
        },
        {
          key: "entry",
          label: "Entry",
          type: "text",
          default: true,
        },
        {
          key: "favorite",
          label: "Favorite",
          type: "boolean",
          default: true,
        },
        {
          key: "tag",
          label: "Tag",
          type: "text",
          default: false,
        },
        {
          key: "createdAt",
          label: "Created",
          type: "date",
          default: false,
        },
        {
          key: "updatedAt",
          label: "Updated",
          type: "date",
          default: false,
        },
      ],
    },


    notes: {
      rows:
        noteRows,

      fields: [
        {
          key: "title",
          label: "Title",
          type: "text",
          default: true,
        },
        {
          key: "text",
          label: "Content",
          type: "text",
          default: true,
        },
        {
          key: "createdAt",
          label: "Created",
          type: "date",
          default: false,
        },
        {
          key: "updatedAt",
          label: "Updated",
          type: "date",
          default: true,
        },
        {
          key: "hasLinks",
          label: "Has Links",
          type: "boolean",
          default: false,
        },
        {
          key: "hasImages",
          label: "Has Images",
          type: "boolean",
          default: false,
        },
        {
          key: "hasChecklist",
          label: "Has Checklist",
          type: "boolean",
          default: false,
        },
        {
          key: "hasHeadings",
          label: "Has Headings",
          type: "boolean",
          default: false,
        },
      ],
    },


    areas: {
      rows:
        areaRows,

      fields: [
        {
          key: "area",
          label: "Area",
          type: "select",
          options:
            areaOptions,
          default: true,
        },
        {
          key: "independentTasks",
          label: "Independent Tasks",
          type: "number",
          default: true,
        },
        {
          key: "subtasks",
          label: "Subtasks",
          type: "number",
          default: true,
        },
        {
          key: "totalRecords",
          label: "Total Records",
          type: "number",
          default: true,
        },
        {
          key: "openTasks",
          label: "Open Tasks",
          type: "number",
          default: true,
        },
        {
          key: "overdueTasks",
          label: "Overdue Tasks",
          type: "number",
          default: true,
        },
        {
          key: "completedTasks",
          label: "Completed Tasks",
          type: "number",
          default: true,
        },
        {
          key: "goals",
          label: "Goals",
          type: "number",
          default: true,
        },
      ],
    },


    insights: {
      rows:
        insightRows,

      fields: [
        {
          key: "metric",
          label: "Metric",
          type: "text",
          default: true,
        },
        {
          key: "value",
          label: "Value",
          type: "text",
          default: true,
        },
      ],
    },
  };
}


function Section({
  number,
  title,
  children,
}) {
  return (
    <div
      style={{
        background:
          "var(--card, var(--surface, rgba(255,255,255,.04)))",

        border:
          "1px solid var(--divider)",

        borderRadius:
          14,

        padding:
          16,

        marginBottom:
          14,
      }}
    >
      <div
        style={{
          fontSize:
            9.5,

          textTransform:
            "uppercase",

          letterSpacing:
            1.2,

          color:
            "var(--text3)",

          marginBottom:
            3,
        }}
      >
        Step {number}
      </div>

      <div
        style={{
          fontSize:
            15,

          fontWeight:
            760,

          color:
            "var(--text)",

          marginBottom:
            13,
        }}
      >
        {title}
      </div>

      {children}
    </div>
  );
}


function SmallButton({
  children,
  active = false,
  onClick,
  danger = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance:
          "none",

        border:
          active
            ? "1px solid #E8B45C"
            : danger
              ? "1px solid rgba(224,112,112,.35)"
              : "1px solid var(--divider)",

        background:
          active
            ? "rgba(232,180,92,.12)"
            : "var(--pillBg)",

        color:
          danger
            ? "#E68080"
            : active
              ? "#E8B45C"
              : "var(--text2)",

        borderRadius:
          9,

        padding:
          "8px 10px",

        fontFamily:
          "inherit",

        fontSize:
          11.5,

        cursor:
          "pointer",
      }}
    >
      {children}
    </button>
  );
}


function Input({
  ...props
}) {
  return (
    <input
      {...props}
      style={{
        width:
          "100%",

        boxSizing:
          "border-box",

        background:
          "var(--inputBg)",

        border:
          "1px solid var(--inputBorder)",

        color:
          "var(--text)",

        borderRadius:
          9,

        padding:
          "9px 10px",

        fontFamily:
          "inherit",

        fontSize:
          12,

        outline:
          "none",

        ...(props.style ||
          {}),
      }}
    />
  );
}


function Select({
  children,
  ...props
}) {
  return (
    <select
      {...props}
      style={{
        width:
          "100%",

        boxSizing:
          "border-box",

        background:
          "var(--inputBg)",

        border:
          "1px solid var(--inputBorder)",

        color:
          "var(--text)",

        borderRadius:
          9,

        padding:
          "9px 10px",

        fontFamily:
          "inherit",

        fontSize:
          12,

        outline:
          "none",

        ...(props.style ||
          {}),
      }}
    >
      {children}
    </select>
  );
}


export function JournalFavoriteDock({
  entries,
  setEntries,
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false);


  const ordered =
    useMemo(
      () =>
        [...entries]
          .sort(
            (a, b) =>
              String(
                b.dateKey ||
                b.date ||
                ""
              ).localeCompare(
                String(
                  a.dateKey ||
                  a.date ||
                  ""
                )
              )
          ),
      [entries]
    );


  const favoriteCount =
    entries.filter(
      (entry) =>
        entry.favorite
    ).length;


  const toggle =
    (id) => {
      setEntries(
        (current) =>
          current.map(
            (entry) =>
              String(
                entry.id
              ) ===
              String(id)
                ? {
                    ...entry,

                    favorite:
                      !entry.favorite,

                    updatedAt:
                      new Date()
                        .toISOString(),
                  }
                : entry
          )
      );
    };


  return (
    <div
      style={{
        position:
          "fixed",

        right:
          16,

        bottom:
          88,

        zIndex:
          140,
      }}
    >
      {open && (
        <div
          style={{
            width:
              "min(360px, calc(100vw - 32px))",

            maxHeight:
              "55vh",

            overflowY:
              "auto",

            marginBottom:
              9,

            background:
              "var(--appBg)",

            border:
              "1px solid var(--divider)",

            borderRadius:
              14,

            boxShadow:
              "0 16px 50px rgba(0,0,0,.28)",

            padding:
              12,
          }}
        >
          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              gap:
                10,

              marginBottom:
                10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize:
                    13.5,

                  fontWeight:
                    750,

                  color:
                    "var(--text)",
                }}
              >
                Journal Favorites
              </div>

              <div
                style={{
                  fontSize:
                    10.5,

                  color:
                    "var(--text3)",

                  marginTop:
                    2,
                }}
              >
                {favoriteCount} favorite
                {favoriteCount ===
                1
                  ? ""
                  : "s"}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              style={{
                border:
                  "none",

                background:
                  "transparent",

                color:
                  "var(--text3)",

                cursor:
                  "pointer",

                fontSize:
                  18,
              }}
            >
              ×
            </button>
          </div>

          {!ordered.length && (
            <div
              style={{
                fontSize:
                  11.5,

                color:
                  "var(--text3)",

                padding:
                  "10px 4px",
              }}
            >
              Your journal entries will appear here.
            </div>
          )}

          {ordered.map(
            (entry) => (
              <div
                key={
                  entry.id
                }
                style={{
                  display:
                    "flex",

                  gap:
                    10,

                  alignItems:
                    "flex-start",

                  padding:
                    "10px 4px",

                  borderTop:
                    "1px solid var(--divider)",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    toggle(
                      entry.id
                    )
                  }
                  aria-label={
                    entry.favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                  style={{
                    appearance:
                      "none",

                    border:
                      "none",

                    background:
                      "transparent",

                    padding:
                      0,

                    cursor:
                      "pointer",

                    color:
                      entry.favorite
                        ? "#E8B45C"
                        : "var(--text3)",

                    fontSize:
                      20,

                    lineHeight:
                      1,
                  }}
                >
                  {entry.favorite
                    ? "★"
                    : "☆"}
                </button>

                <div
                  style={{
                    minWidth:
                      0,

                    flex:
                      1,
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        11.5,

                      fontWeight:
                        650,

                      color:
                        "var(--text)",
                    }}
                  >
                    {entry.dateKey ||
                      entry.date ||
                      "Undated"}

                    {entry.ref
                      ? ` · ${entry.ref}`
                      : ""}
                  </div>

                  <div
                    style={{
                      marginTop:
                        3,

                      fontSize:
                        10.5,

                      lineHeight:
                        1.4,

                      color:
                        "var(--text3)",

                      display:
                        "-webkit-box",

                      WebkitLineClamp:
                        2,

                      WebkitBoxOrient:
                        "vertical",

                      overflow:
                        "hidden",
                    }}
                  >
                    {entry.note ||
                      "Journal check-in"}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) =>
              !value
          )
        }
        style={{
          appearance:
            "none",

          border:
            "1px solid rgba(232,180,92,.35)",

          background:
            "var(--appBg)",

          color:
            "#E8B45C",

          borderRadius:
            999,

          padding:
            "10px 13px",

          boxShadow:
            "0 8px 28px rgba(0,0,0,.24)",

          fontFamily:
            "inherit",

          fontSize:
            11.5,

          fontWeight:
            700,

          cursor:
            "pointer",
        }}
      >
        ★ Favorites
        {favoriteCount
          ? ` · ${favoriteCount}`
          : ""}
      </button>
    </div>
  );
}


export default function ReportBuilder({
  tasks = [],
  goals = [],
  areas = {},
  journalEntries = [],
  onBack,
}) {
  const notes =
    useMemo(
      () =>
        readNotes(),
      []
    );


  const definitions =
    useMemo(
      () =>
        subjectDefinitions({
          tasks,
          goals,
          areas,
          journalEntries,
          notes,
        }),
      [
        tasks,
        goals,
        areas,
        journalEntries,
        notes,
      ]
    );


  const [
    subject,
    setSubject,
  ] =
    useState("tasks");


  const [
    filters,
    setFilters,
  ] =
    useState([]);


  const [
    selectedColumns,
    setSelectedColumns,
  ] =
    useState([]);


  const [
    sortField,
    setSortField,
  ] =
    useState("");


  const [
    sortDirection,
    setSortDirection,
  ] =
    useState("asc");


  const [
    groupField,
    setGroupField,
  ] =
    useState("");


  const [
    format,
    setFormat,
  ] =
    useState("xlsx");


  const [
    presetName,
    setPresetName,
  ] =
    useState("");


  const [
    presets,
    setPresets,
  ] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "abide-report-presets-v1"
          ) || "[]"
        );
      } catch {
        return [];
      }
    });


  const [
    everythingSections,
    setEverythingSections,
  ] =
    useState(
      EVERYTHING_SUBJECTS
    );


  const config =
    subject ===
    "everything"
      ? null
      : definitions[
          subject
        ];


  const fields =
    config?.fields ||
    [];


  const rows =
    config?.rows ||
    [];


  useEffect(
    () => {
      if (
        subject ===
        "everything"
      ) {
        setFilters([]);
        setSelectedColumns(
          []
        );
        setSortField("");
        setGroupField("");

        return;
      }

      const next =
        definitions[
          subject
        ]?.fields ||
        [];

      setSelectedColumns(
        next
          .filter(
            (field) =>
              field.default
          )
          .map(
            (field) =>
              field.key
          )
      );

      setFilters([]);
      setSortField(
        next[0]?.key ||
        ""
      );

      setGroupField("");
    },
    [
      subject,
      definitions,
    ]
  );


  useEffect(
    () => {
      localStorage.setItem(
        "abide-report-presets-v1",
        JSON.stringify(
          presets
        )
      );
    },
    [presets]
  );


  const filteredRows =
    useMemo(
      () =>
        subject ===
        "everything"
          ? []
          : sortRows(
              applyFilters(
                rows,
                filters,
                fields
              ),
              sortField,
              sortDirection
            ),
      [
        subject,
        rows,
        filters,
        fields,
        sortField,
        sortDirection,
      ]
    );


  const selectedFields =
    useMemo(
      () =>
        fields.filter(
          (field) =>
            selectedColumns.includes(
              field.key
            )
        ),
      [
        fields,
        selectedColumns,
      ]
    );


  const grouped =
    useMemo(
      () =>
        groupRows(
          filteredRows,
          groupField
        ),
      [
        filteredRows,
        groupField,
      ]
    );


  const updateFilter =
    (
      id,
      changes
    ) => {
      setFilters(
        (current) =>
          current.map(
            (filter) =>
              filter.id === id
                ? {
                    ...filter,
                    ...changes,
                  }
                : filter
          )
      );
    };


  const addFilter =
    (
      fieldKey =
        fields[0]?.key
    ) => {
      const field =
        fields.find(
          (candidate) =>
            candidate.key ===
            fieldKey
        ) ||
        fields[0];

      if (!field) return;

      setFilters(
        (current) => [
          ...current,
          makeFilter(
            field,
            current.length
          ),
        ]
      );
    };


  const changeFilterField =
    (
      filter,
      key
    ) => {
      const field =
        fields.find(
          (candidate) =>
            candidate.key ===
            key
        );

      if (!field) return;

      updateFilter(
        filter.id,
        {
          field:
            field.key,

          operator:
            defaultOperator(
              field.type
            ),

          value:
            field.type ===
            "date"
              ? localDateKey()
              : "",

          value2:
            "",
        }
      );
    };


  const removeFilter =
    (id) =>
      setFilters(
        (current) =>
          current.filter(
            (filter) =>
              filter.id !== id
          )
      );


  const useQuickPreset =
    (
      type,
      value
    ) => {
      if (
        subject !==
        "tasks"
      ) {
        setSubject("tasks");

        setTimeout(
          () => {},
          0
        );
      }

      if (
        type ===
        "upcoming"
      ) {
        setFilters([
          {
            id:
              `${Date.now()}`,

            join: "and",

            field:
              "dueDate",

            operator:
              "next_n_days",

            value:
              String(value),

            value2:
              "",
          },
          {
            id:
              `${Date.now()}b`,

            join: "and",

            field:
              "completed",

            operator:
              "false",

            value: "",
            value2: "",
          },
        ]);
      }

      if (
        type ===
        "overdue"
      ) {
        setFilters([
          {
            id:
              `${Date.now()}`,

            join: "and",

            field:
              "overdue",

            operator:
              "true",

            value: "",
            value2: "",
          },
        ]);
      }
    };


  const savePreset =
    () => {
      const name =
        presetName.trim();

      if (!name) {
        return;
      }

      const preset = {
        id:
          `${Date.now()}`,

        name,

        subject,

        filters,

        selectedColumns,

        sortField,

        sortDirection,

        groupField,

        format,

        everythingSections,
      };

      setPresets(
        (current) => [
          preset,
          ...current,
        ]
      );

      setPresetName("");
    };


  const loadPreset =
    (preset) => {
      setSubject(
        preset.subject ||
        "tasks"
      );

      setTimeout(
        () => {
          setFilters(
            preset.filters ||
            []
          );

          setSelectedColumns(
            preset.selectedColumns ||
            []
          );

          setSortField(
            preset.sortField ||
            ""
          );

          setSortDirection(
            preset.sortDirection ||
            "asc"
          );

          setGroupField(
            preset.groupField ||
            ""
          );

          setFormat(
            preset.format ||
            "xlsx"
          );

          setEverythingSections(
            preset.everythingSections ||
            EVERYTHING_SUBJECTS
          );
        },
        0
      );
    };


  const deletePreset =
    (id) =>
      setPresets(
        (current) =>
          current.filter(
            (preset) =>
              preset.id !== id
          )
      );


  const exportSections =
    () => {
      if (
        subject !==
        "everything"
      ) {
        return [
          {
            key:
              subject,

            title:
              SUBJECT_LABELS[
                subject
              ],

            rows:
              filteredRows,

            fields:
              selectedFields.length
                ? selectedFields
                : fields,
          },
        ];
      }

      return everythingSections
        .map(
          (key) => {
            const definition =
              definitions[key];

            return {
              key,

              title:
                SUBJECT_LABELS[
                  key
                ],

              rows:
                definition.rows,

              fields:
                definition.fields.filter(
                  (field) =>
                    field.default
                ),
            };
          }
        )
        .filter(
          (section) =>
            section.rows
        );
    };


  const exportCsv =
    () => {
      const sections =
        exportSections();

      if (
        sections.length !== 1
      ) {
        return;
      }

      const section =
        sections[0];

      downloadFile(
        `abide-${section.key}-${localDateKey()}.csv`,
        rowsToCsv(
          section.rows,
          section.fields
        ),
        "text/csv"
      );
    };


  const exportExcel =
    async () => {
      const XLSX =
        await import(
          "xlsx"
        );

      const workbook =
        XLSX.utils
          .book_new();


      exportSections()
        .forEach(
          (section) => {
            const data =
              section.rows.map(
                (row) =>
                  Object.fromEntries(
                    section.fields.map(
                      (field) => [
                        field.label,
                        row[
                          field.key
                        ],
                      ]
                    )
                  )
              );

            const worksheet =
              XLSX.utils
                .json_to_sheet(
                  data
                );

            XLSX.utils
              .book_append_sheet(
                workbook,
                worksheet,
                section.title.slice(
                  0,
                  31
                )
              );
          }
        );


      XLSX.writeFile(
        workbook,
        `abide-report-${localDateKey()}.xlsx`
      );
    };


  const exportWord =
    async () => {
      const {
        Document,
        Packer,
        Paragraph,
        HeadingLevel,
      } =
        await import(
          "docx"
        );

      const children = [
        new Paragraph({
          text:
            "Abide Report",

          heading:
            HeadingLevel.HEADING_1,
        }),

        new Paragraph({
          text:
            `Generated ${new Date().toLocaleString()}`,
        }),
      ];


      exportSections()
        .forEach(
          (section) => {
            children.push(
              new Paragraph({
                text:
                  section.title,

                heading:
                  HeadingLevel.HEADING_2,
              })
            );


            const groups =
              section.key ===
                subject &&
              groupField
                ? groupRows(
                    section.rows,
                    groupField
                  )
                : [
                    {
                      label: "",
                      rows:
                        section.rows,
                    },
                  ];


            groups.forEach(
              (group) => {
                if (
                  group.label
                ) {
                  children.push(
                    new Paragraph({
                      text:
                        group.label,

                      heading:
                        HeadingLevel.HEADING_3,
                    })
                  );
                }


                group.rows
                  .forEach(
                    (row) => {
                      const text =
                        section.fields
                          .map(
                            (field) =>
                              `${field.label}: ${row[field.key] ?? ""}`
                          )
                          .join(
                            " · "
                          );

                      children.push(
                        new Paragraph({
                          text,
                        })
                      );
                    }
                  );
              }
            );
          }
        );


      const document =
        new Document({
          sections: [
            {
              children,
            },
          ],
        });


      const blob =
        await Packer.toBlob(
          document
        );

      downloadFile(
        `abide-report-${localDateKey()}.docx`,
        blob,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    };


  const exportPdf =
    async () => {
      const {
        jsPDF,
      } =
        await import(
          "jspdf"
        );

      const doc =
        new jsPDF();

      const pageHeight =
        doc.internal
          .pageSize
          .getHeight();

      let y = 18;


      const ensure =
        (height = 10) => {
          if (
            y + height >
            pageHeight - 15
          ) {
            doc.addPage();
            y = 18;
          }
        };


      doc.setFontSize(18);

      doc.text(
        "Abide Report",
        18,
        y
      );

      y += 9;

      doc.setFontSize(8);

      doc.text(
        `Generated ${new Date().toLocaleString()}`,
        18,
        y
      );

      y += 11;


      exportSections()
        .forEach(
          (section) => {
            ensure(12);

            doc.setFontSize(14);

            doc.text(
              section.title,
              18,
              y
            );

            y += 8;


            const groups =
              section.key ===
                subject &&
              groupField
                ? groupRows(
                    section.rows,
                    groupField
                  )
                : [
                    {
                      label: "",
                      rows:
                        section.rows,
                    },
                  ];


            groups.forEach(
              (group) => {
                if (
                  group.label
                ) {
                  ensure(10);

                  doc.setFontSize(11);

                  doc.text(
                    group.label,
                    18,
                    y
                  );

                  y += 6;
                }


                group.rows
                  .forEach(
                    (row) => {
                      const text =
                        section.fields
                          .map(
                            (field) =>
                              `${field.label}: ${row[field.key] ?? ""}`
                          )
                          .join(
                            " | "
                          );

                      const lines =
                        doc.splitTextToSize(
                          text,
                          175
                        );

                      ensure(
                        lines.length *
                          4.3 +
                        3
                      );

                      doc.setFontSize(8.5);

                      doc.text(
                        lines,
                        18,
                        y
                      );

                      y +=
                        lines.length *
                          4.3 +
                        3;
                    }
                  );

                y += 2;
              }
            );

            y += 4;
          }
        );


      doc.save(
        `abide-report-${localDateKey()}.pdf`
      );
    };


  const exportZip =
    async () => {
      const JSZipModule =
        await import(
          "jszip"
        );

      const JSZip =
        JSZipModule.default ||
        JSZipModule;

      const zip =
        new JSZip();

      const sections =
        exportSections();


      sections.forEach(
        (section) => {
          zip.file(
            `${section.title}.csv`,
            rowsToCsv(
              section.rows,
              section.fields
            )
          );
        }
      );


      zip.file(
        "Report Configuration.json",
        JSON.stringify(
          {
            exportedAt:
              new Date()
                .toISOString(),

            subject,

            filters,

            selectedColumns,

            sortField,

            sortDirection,

            groupField,

            everythingSections,

            recordCount:
              subject ===
              "everything"
                ? sections.reduce(
                    (
                      total,
                      section
                    ) =>
                      total +
                      section.rows
                        .length,
                    0
                  )
                : filteredRows.length,
          },
          null,
          2
        )
      );


      zip.file(
        "Abide Data.json",
        JSON.stringify(
          Object.fromEntries(
            sections.map(
              (section) => [
                section.key,
                section.rows,
              ]
            )
          ),
          null,
          2
        )
      );


      const blob =
        await zip
          .generateAsync({
            type: "blob",
          });


      downloadFile(
        `abide-report-${localDateKey()}.zip`,
        blob,
        "application/zip"
      );
    };


  const generate =
    async () => {
      if (format === "csv") {
        return exportCsv();
      }

      if (
        format === "xlsx"
      ) {
        return exportExcel();
      }

      if (
        format === "docx"
      ) {
        return exportWord();
      }

      if (format === "pdf") {
        return exportPdf();
      }

      return exportZip();
    };


  const firstPreviewFields =
    selectedFields.length
      ? selectedFields.slice(
          0,
          6
        )
      : fields.slice(
          0,
          6
        );


  return (
    <div
      style={{
        height:
          "100%",

        overflowY:
          "auto",

        padding:
          "0 0 100px",
      }}
    >
      <div
        style={{
          padding:
            "18px 18px 12px",

          borderBottom:
            "1px solid var(--divider)",

          marginBottom:
            14,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            appearance:
              "none",

            border:
              "none",

            background:
              "transparent",

            color:
              "var(--text3)",

            padding:
              0,

            marginBottom:
              12,

            fontFamily:
              "inherit",

            cursor:
              "pointer",

            fontSize:
              11.5,
          }}
        >
          ← Export Center
        </button>

        <div
          style={{
            fontSize:
              9.5,

            letterSpacing:
              1.1,

            textTransform:
              "uppercase",

            color:
              "#E8B45C",
          }}
        >
          Data & Reporting
        </div>

        <div
          style={{
            marginTop:
              3,

            fontSize:
              24,

            fontWeight:
              780,

            color:
              "var(--text)",
          }}
        >
          Report Builder
        </div>

        <div
          style={{
            marginTop:
              5,

            maxWidth:
              700,

            fontSize:
              11.5,

            lineHeight:
              1.5,

            color:
              "var(--text3)",
          }}
        >
          Build exactly the report you need.
          Choose your data, stack filters,
          choose fields, sort and group it,
          preview the matches, and export.
        </div>
      </div>


      <div
        style={{
          padding:
            "0 16px",

          maxWidth:
            1000,

          margin:
            "0 auto",
        }}
      >
        {presets.length >
          0 && (
          <div
            style={{
              marginBottom:
                14,
            }}
          >
            <div
              style={{
                fontSize:
                  9.5,

                textTransform:
                  "uppercase",

                letterSpacing:
                  1,

                color:
                  "var(--text3)",

                margin:
                  "0 3px 7px",
              }}
            >
              Saved Reports
            </div>

            <div
              style={{
                display:
                  "flex",

                gap:
                  7,

                overflowX:
                  "auto",

                paddingBottom:
                  4,
              }}
            >
              {presets.map(
                (preset) => (
                  <div
                    key={
                      preset.id
                    }
                    style={{
                      display:
                        "flex",

                      flexShrink:
                        0,

                      alignItems:
                        "center",

                      border:
                        "1px solid var(--divider)",

                      borderRadius:
                        9,

                      background:
                        "var(--pillBg)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        loadPreset(
                          preset
                        )
                      }
                      style={{
                        border:
                          "none",

                        background:
                          "transparent",

                        color:
                          "var(--text2)",

                        padding:
                          "8px 10px",

                        fontFamily:
                          "inherit",

                        fontSize:
                          11,

                        cursor:
                          "pointer",
                      }}
                    >
                      {preset.name}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deletePreset(
                          preset.id
                        )
                      }
                      style={{
                        border:
                          "none",

                        borderLeft:
                          "1px solid var(--divider)",

                        background:
                          "transparent",

                        color:
                          "var(--text3)",

                        padding:
                          "8px 9px",

                        cursor:
                          "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}


        <Section
          number="1"
          title="What do you want a report on?"
        >
          <div
            style={{
              display:
                "flex",

              flexWrap:
                "wrap",

              gap:
                7,
            }}
          >
            {Object.entries(
              SUBJECT_LABELS
            ).map(
              (
                [
                  key,
                  label,
                ]
              ) => (
                <SmallButton
                  key={key}
                  active={
                    subject === key
                  }
                  onClick={() =>
                    setSubject(key)
                  }
                >
                  {label}
                </SmallButton>
              )
            )}
          </div>


          {subject ===
            "everything" && (
            <div
              style={{
                marginTop:
                  14,

                paddingTop:
                  12,

                borderTop:
                  "1px solid var(--divider)",
              }}
            >
              <div
                style={{
                  fontSize:
                    11,

                  fontWeight:
                    650,

                  color:
                    "var(--text2)",

                  marginBottom:
                    8,
                }}
              >
                Include sections
              </div>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(130px, 1fr))",

                  gap:
                    7,
                }}
              >
                {EVERYTHING_SUBJECTS.map(
                  (key) => {
                    const checked =
                      everythingSections
                        .includes(
                          key
                        );

                    return (
                      <label
                        key={
                          key
                        }
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            7,

                          padding:
                            "8px 9px",

                          borderRadius:
                            8,

                          background:
                            checked
                              ? "rgba(232,180,92,.08)"
                              : "var(--subtleBg)",

                          color:
                            "var(--body)",

                          fontSize:
                            11,

                          cursor:
                            "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            checked
                          }
                          onChange={() =>
                            setEverythingSections(
                              (
                                current
                              ) =>
                                checked
                                  ? current.filter(
                                      (
                                        value
                                      ) =>
                                        value !==
                                        key
                                    )
                                  : [
                                      ...current,
                                      key,
                                    ]
                            )
                          }
                        />

                        {
                          SUBJECT_LABELS[
                            key
                          ]
                        }
                      </label>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </Section>


        {subject !==
          "everything" && (
          <>
            <Section
              number="2"
              title="Narrow the results"
            >
              {subject ===
                "tasks" && (
                <div
                  style={{
                    display:
                      "flex",

                    flexWrap:
                      "wrap",

                    gap:
                      6,

                    marginBottom:
                      12,
                  }}
                >
                  <SmallButton
                    onClick={() =>
                      useQuickPreset(
                        "upcoming",
                        7
                      )
                    }
                  >
                    Next 7 days
                  </SmallButton>

                  <SmallButton
                    onClick={() =>
                      useQuickPreset(
                        "upcoming",
                        14
                      )
                    }
                  >
                    Next 14 days
                  </SmallButton>

                  <SmallButton
                    onClick={() =>
                      useQuickPreset(
                        "upcoming",
                        30
                      )
                    }
                  >
                    Next 30 days
                  </SmallButton>

                  <SmallButton
                    onClick={() =>
                      useQuickPreset(
                        "overdue"
                      )
                    }
                  >
                    Overdue
                  </SmallButton>
                </div>
              )}


              {!filters.length && (
                <div
                  style={{
                    padding:
                      "12px",

                    border:
                      "1px dashed var(--divider)",

                    borderRadius:
                      9,

                    fontSize:
                      11,

                    color:
                      "var(--text3)",

                    marginBottom:
                      10,
                  }}
                >
                  No filters applied. All {SUBJECT_LABELS[subject].toLowerCase()} will be included.
                </div>
              )}


              {filters.map(
                (
                  filter,
                  index
                ) => {
                  const field =
                    fields.find(
                      (
                        candidate
                      ) =>
                        candidate.key ===
                        filter.field
                    ) ||
                    fields[0];

                  const operators =
                    operatorOptions(
                      field.type
                    );

                  const noValue =
                    [
                      "empty",
                      "not_empty",
                      "today",
                      "tomorrow",
                      "this_week",
                      "next_week",
                      "this_month",
                      "true",
                      "false",
                    ].includes(
                      filter.operator
                    );

                  const relativeNumber =
                    [
                      "next_n_days",
                      "previous_n_days",
                      "more_than_n_overdue",
                    ].includes(
                      filter.operator
                    );

                  return (
                    <div
                      key={
                        filter.id
                      }
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          index
                            ? "74px minmax(120px,1fr) minmax(145px,1fr) minmax(120px,1fr) auto"
                            : "minmax(120px,1fr) minmax(145px,1fr) minmax(120px,1fr) auto",

                        gap:
                          7,

                        alignItems:
                          "center",

                        marginBottom:
                          8,
                      }}
                    >
                      {index >
                        0 && (
                        <Select
                          value={
                            filter.join
                          }
                          onChange={(
                            event
                          ) =>
                            updateFilter(
                              filter.id,
                              {
                                join:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                        >
                          <option value="and">
                            AND
                          </option>

                          <option value="or">
                            OR
                          </option>
                        </Select>
                      )}


                      <Select
                        value={
                          filter.field
                        }
                        onChange={(
                          event
                        ) =>
                          changeFilterField(
                            filter,
                            event
                              .target
                              .value
                          )
                        }
                      >
                        {fields.map(
                          (
                            candidate
                          ) => (
                            <option
                              key={
                                candidate.key
                              }
                              value={
                                candidate.key
                              }
                            >
                              {
                                candidate.label
                              }
                            </option>
                          )
                        )}
                      </Select>


                      <Select
                        value={
                          filter.operator
                        }
                        onChange={(
                          event
                        ) =>
                          updateFilter(
                            filter.id,
                            {
                              operator:
                                event
                                  .target
                                  .value,
                            }
                          )
                        }
                      >
                        {operators.map(
                          (
                            [
                              key,
                              label,
                            ]
                          ) => (
                            <option
                              key={
                                key
                              }
                              value={
                                key
                              }
                            >
                              {
                                label
                              }
                            </option>
                          )
                        )}
                      </Select>


                      {!noValue && (
                        <div
                          style={{
                            display:
                              "flex",

                            gap:
                              5,

                            alignItems:
                              "center",
                          }}
                        >
                          {field.type ===
                            "select" &&
                          ![
                            "one_of",
                            "not_one_of",
                          ].includes(
                            filter.operator
                          ) ? (
                            <Select
                              value={
                                filter.value
                              }
                              onChange={(
                                event
                              ) =>
                                updateFilter(
                                  filter.id,
                                  {
                                    value:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                            >
                              <option value="">
                                Choose…
                              </option>

                              {(field.options ||
                                []).map(
                                (
                                  option
                                ) => (
                                  <option
                                    key={
                                      option
                                    }
                                    value={
                                      option
                                    }
                                  >
                                    {
                                      option
                                    }
                                  </option>
                                )
                              )}
                            </Select>
                          ) : (
                            <Input
                              type={
                                relativeNumber ||
                                field.type ===
                                  "number"
                                  ? "number"
                                  : field.type ===
                                      "date"
                                    ? "date"
                                    : "text"
                              }
                              min={
                                relativeNumber
                                  ? "0"
                                  : undefined
                              }
                              value={
                                filter.value
                              }
                              placeholder={
                                [
                                  "one_of",
                                  "not_one_of",
                                ].includes(
                                  filter.operator
                                )
                                  ? "Separate values with commas"
                                  : relativeNumber
                                    ? "Number of days"
                                    : "Value"
                              }
                              onChange={(
                                event
                              ) =>
                                updateFilter(
                                  filter.id,
                                  {
                                    value:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                            />
                          )}


                          {filter.operator ===
                            "between" && (
                            <>
                              <span
                                style={{
                                  fontSize:
                                    10,

                                  color:
                                    "var(--text3)",
                                }}
                              >
                                and
                              </span>

                              <Input
                                type={
                                  field.type ===
                                  "date"
                                    ? "date"
                                    : field.type ===
                                        "number"
                                      ? "number"
                                      : "text"
                                }
                                value={
                                  filter.value2
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateFilter(
                                    filter.id,
                                    {
                                      value2:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                              />
                            </>
                          )}


                          {relativeNumber && (
                            <span
                              style={{
                                whiteSpace:
                                  "nowrap",

                                fontSize:
                                  10.5,

                                color:
                                  "var(--text3)",
                              }}
                            >
                              days
                              {filter.operator ===
                              "more_than_n_overdue"
                                ? " overdue"
                                : ""}
                            </span>
                          )}
                        </div>
                      )}


                      <button
                        type="button"
                        onClick={() =>
                          removeFilter(
                            filter.id
                          )
                        }
                        style={{
                          border:
                            "none",

                          background:
                            "transparent",

                          color:
                            "var(--text3)",

                          fontSize:
                            17,

                          cursor:
                            "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                }
              )}


              <div
                style={{
                  display:
                    "flex",

                  flexWrap:
                    "wrap",

                  gap:
                    7,

                  marginTop:
                    10,
                }}
              >
                <SmallButton
                  active
                  onClick={() =>
                    addFilter()
                  }
                >
                  + Add a filter
                </SmallButton>

                {filters.length >
                  0 && (
                  <SmallButton
                    onClick={() =>
                      setFilters(
                        []
                      )
                    }
                  >
                    Clear filters
                  </SmallButton>
                )}
              </div>
            </Section>


            <Section
              number="3"
              title="Choose fields to include"
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  gap:
                    10,

                  marginBottom:
                    10,

                  alignItems:
                    "center",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedColumns(
                        fields.map(
                          (
                            field
                          ) =>
                            field.key
                        )
                      )
                    }
                    style={{
                      border:
                        "none",

                      background:
                        "transparent",

                      padding:
                        0,

                      color:
                        "var(--text2)",

                      fontSize:
                        10.5,

                      cursor:
                        "pointer",
                    }}
                  >
                    Select all
                  </button>

                  <span
                    style={{
                      color:
                        "var(--text3)",
                    }}
                  >
                    ·
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedColumns(
                        []
                      )
                    }
                    style={{
                      border:
                        "none",

                      background:
                        "transparent",

                      padding:
                        0,

                      color:
                        "var(--text2)",

                      fontSize:
                        10.5,

                      cursor:
                        "pointer",
                    }}
                  >
                    Clear
                  </button>

                  <span
                    style={{
                      color:
                        "var(--text3)",
                    }}
                  >
                    ·
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedColumns(
                        fields
                          .filter(
                            (
                              field
                            ) =>
                              field.default
                          )
                          .map(
                            (
                              field
                            ) =>
                              field.key
                          )
                      )
                    }
                    style={{
                      border:
                        "none",

                      background:
                        "transparent",

                      padding:
                        0,

                      color:
                        "var(--text2)",

                      fontSize:
                        10.5,

                      cursor:
                        "pointer",
                    }}
                  >
                    Defaults
                  </button>
                </div>

                <div
                  style={{
                    fontSize:
                      9.5,

                    letterSpacing:
                      .7,

                    textTransform:
                      "uppercase",

                    color:
                      "var(--text3)",
                  }}
                >
                  {selectedColumns.length} of {fields.length} selected
                </div>
              </div>


              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(170px, 1fr))",

                  gap:
                    6,
                }}
              >
                {fields.map(
                  (field) => {
                    const checked =
                      selectedColumns
                        .includes(
                          field.key
                        );

                    return (
                      <label
                        key={
                          field.key
                        }
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            7,

                          padding:
                            "8px 9px",

                          background:
                            checked
                              ? "rgba(232,180,92,.07)"
                              : "transparent",

                          borderRadius:
                            7,

                          fontSize:
                            11.5,

                          color:
                            "var(--body)",

                          cursor:
                            "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            checked
                          }
                          onChange={() =>
                            setSelectedColumns(
                              (
                                current
                              ) =>
                                checked
                                  ? current.filter(
                                      (
                                        key
                                      ) =>
                                        key !==
                                        field.key
                                    )
                                  : [
                                      ...current,
                                      field.key,
                                    ]
                            )
                          }
                        />

                        {
                          field.label
                        }
                      </label>
                    );
                  }
                )}
              </div>


              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(170px, 1fr))",

                  gap:
                    8,

                  marginTop:
                    14,

                  paddingTop:
                    12,

                  borderTop:
                    "1px solid var(--divider)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        10,

                      color:
                        "var(--text3)",

                      marginBottom:
                        5,
                    }}
                  >
                    Sort by
                  </div>

                  <Select
                    value={
                      sortField
                    }
                    onChange={(
                      event
                    ) =>
                      setSortField(
                        event
                          .target
                          .value
                      )
                    }
                  >
                    <option value="">
                      No sorting
                    </option>

                    {fields.map(
                      (field) => (
                        <option
                          key={
                            field.key
                          }
                          value={
                            field.key
                          }
                        >
                          {
                            field.label
                          }
                        </option>
                      )
                    )}
                  </Select>
                </div>


                <div>
                  <div
                    style={{
                      fontSize:
                        10,

                      color:
                        "var(--text3)",

                      marginBottom:
                        5,
                    }}
                  >
                    Direction
                  </div>

                  <Select
                    value={
                      sortDirection
                    }
                    onChange={(
                      event
                    ) =>
                      setSortDirection(
                        event
                          .target
                          .value
                      )
                    }
                  >
                    <option value="asc">
                      Ascending
                    </option>

                    <option value="desc">
                      Descending
                    </option>
                  </Select>
                </div>


                <div>
                  <div
                    style={{
                      fontSize:
                        10,

                      color:
                        "var(--text3)",

                      marginBottom:
                        5,
                    }}
                  >
                    Group by
                  </div>

                  <Select
                    value={
                      groupField
                    }
                    onChange={(
                      event
                    ) =>
                      setGroupField(
                        event
                          .target
                          .value
                      )
                    }
                  >
                    <option value="">
                      No grouping
                    </option>

                    {fields.map(
                      (field) => (
                        <option
                          key={
                            field.key
                          }
                          value={
                            field.key
                          }
                        >
                          {
                            field.label
                          }
                        </option>
                      )
                    )}
                  </Select>
                </div>
              </div>
            </Section>
          </>
        )}


        <Section
          number={
            subject ===
            "everything"
              ? "2"
              : "4"
          }
          title="Preview"
        >
          {subject ===
          "everything" ? (
            <div>
              <div
                style={{
                  fontSize:
                    15,

                  fontWeight:
                    760,

                  color:
                    "var(--text)",

                  marginBottom:
                    4,
                }}
              >
                {everythingSections.reduce(
                  (
                    total,
                    key
                  ) =>
                    total +
                    (
                      definitions[
                        key
                      ]?.rows
                        ?.length ||
                      0
                    ),
                  0
                )} records included
              </div>

              <div
                style={{
                  fontSize:
                    11,

                  lineHeight:
                    1.5,

                  color:
                    "var(--text3)",
                }}
              >
                {everythingSections
                  .map(
                    (key) =>
                      `${SUBJECT_LABELS[key]}: ${
                        definitions[
                          key
                        ]?.rows
                          ?.length ||
                        0
                      }`
                  )
                  .join(
                    " · "
                  )}
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "space-between",

                  gap:
                    10,

                  marginBottom:
                    9,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize:
                        15,

                      fontWeight:
                        760,

                      color:
                        "var(--text)",
                    }}
                  >
                    {filteredRows.length}
                  </span>

                  <span
                    style={{
                      marginLeft:
                        5,

                      fontSize:
                        11,

                      color:
                        "var(--text3)",
                    }}
                  >
                    record
                    {filteredRows.length ===
                    1
                      ? ""
                      : "s"}{" "}
                    match
                  </span>
                </div>

                <div
                  style={{
                    fontSize:
                      10,

                    color:
                      "var(--text3)",
                  }}
                >
                  {selectedFields.length} field
                  {selectedFields.length ===
                  1
                    ? ""
                    : "s"}
                </div>
              </div>


              <div
                style={{
                  overflowX:
                    "auto",

                  border:
                    "1px solid var(--divider)",

                  borderRadius:
                    9,
                }}
              >
                <table
                  style={{
                    width:
                      "100%",

                    borderCollapse:
                      "collapse",

                    minWidth:
                      520,

                    fontSize:
                      10.5,

                    color:
                      "var(--body)",
                  }}
                >
                  <thead>
                    <tr>
                      {firstPreviewFields.map(
                        (
                          field
                        ) => (
                          <th
                            key={
                              field.key
                            }
                            style={{
                              textAlign:
                                "left",

                              padding:
                                "9px",

                              borderBottom:
                                "1px solid var(--divider)",

                              color:
                                "var(--text2)",

                              fontWeight:
                                700,
                            }}
                          >
                            {
                              field.label
                            }
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows
                      .slice(
                        0,
                        5
                      )
                      .map(
                        (
                          row,
                          index
                        ) => (
                          <tr
                            key={
                              row.id ||
                              index
                            }
                          >
                            {firstPreviewFields.map(
                              (
                                field
                              ) => (
                                <td
                                  key={
                                    field.key
                                  }
                                  style={{
                                    padding:
                                      "8px 9px",

                                    borderBottom:
                                      "1px solid var(--divider)",

                                    maxWidth:
                                      230,

                                    whiteSpace:
                                      "nowrap",

                                    overflow:
                                      "hidden",

                                    textOverflow:
                                      "ellipsis",
                                  }}
                                >
                                  {typeof row[
                                    field
                                      .key
                                  ] ===
                                  "boolean"
                                    ? row[
                                        field
                                          .key
                                      ]
                                      ? "Yes"
                                      : "No"
                                    : String(
                                        row[
                                          field
                                            .key
                                        ] ??
                                          ""
                                      )}
                                </td>
                              )
                            )}
                          </tr>
                        )
                      )}
                  </tbody>
                </table>
              </div>

              {filteredRows.length >
                5 && (
                <div
                  style={{
                    marginTop:
                      7,

                    fontSize:
                      10,

                    fontStyle:
                      "italic",

                    color:
                      "var(--text3)",
                  }}
                >
                  Showing the first 5 of {filteredRows.length} matching records.
                </div>
              )}
            </>
          )}
        </Section>


        <Section
          number={
            subject ===
            "everything"
              ? "3"
              : "5"
          }
          title="Save or download"
        >
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "minmax(0, 1fr) auto",

              gap:
                7,

              marginBottom:
                14,
            }}
          >
            <Input
              value={
                presetName
              }
              placeholder="Preset name — e.g. Margin · Next 30 Days"
              onChange={(
                event
              ) =>
                setPresetName(
                  event
                    .target
                    .value
                )
              }
            />

            <SmallButton
              onClick={
                savePreset
              }
            >
              Save preset
            </SmallButton>
          </div>


          <div
            style={{
              fontSize:
                9.5,

              textTransform:
                "uppercase",

              letterSpacing:
                1,

              color:
                "var(--text3)",

              marginBottom:
                7,
            }}
          >
            File format
          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(120px, 1fr))",

              gap:
                7,
            }}
          >
            {[
              [
                "csv",
                "CSV",
                "Simple spreadsheet"
              ],
              [
                "xlsx",
                "Excel",
                "Workbook"
              ],
              [
                "docx",
                "Word",
                "Readable document"
              ],
              [
                "pdf",
                "PDF",
                "Shareable report"
              ],
              [
                "zip",
                "ZIP Bundle",
                "Data + configuration"
              ],
            ].map(
              (
                [
                  key,
                  label,
                  description,
                ]
              ) => {
                const disabled =
                  key === "csv" &&
                  subject ===
                    "everything";

                return (
                  <button
                    type="button"
                    key={
                      key
                    }
                    disabled={
                      disabled
                    }
                    onClick={() =>
                      !disabled &&
                      setFormat(
                        key
                      )
                    }
                    style={{
                      appearance:
                        "none",

                      textAlign:
                        "left",

                      border:
                        format ===
                          key
                          ? "1px solid #E8B45C"
                          : "1px solid var(--divider)",

                      background:
                        format ===
                          key
                          ? "rgba(232,180,92,.08)"
                          : "var(--subtleBg)",

                      borderRadius:
                        10,

                      padding:
                        11,

                      opacity:
                        disabled
                          ? .4
                          : 1,

                      cursor:
                        disabled
                          ? "not-allowed"
                          : "pointer",

                      fontFamily:
                        "inherit",
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          11.5,

                        fontWeight:
                          700,

                        color:
                          format ===
                            key
                            ? "#E8B45C"
                            : "var(--text)",
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        marginTop:
                          3,

                        fontSize:
                          9.5,

                        lineHeight:
                          1.35,

                        color:
                          "var(--text3)",
                      }}
                    >
                      {description}
                    </div>
                  </button>
                );
              }
            )}
          </div>


          <button
            type="button"
            onClick={
              generate
            }
            disabled={
              subject !==
                "everything" &&
              !selectedFields.length
            }
            style={{
              width:
                "100%",

              marginTop:
                14,

              appearance:
                "none",

              border:
                "none",

              background:
                "#E8B45C",

              color:
                "#1A160F",

              borderRadius:
                10,

              padding:
                "12px 14px",

              fontFamily:
                "inherit",

              fontSize:
                12.5,

              fontWeight:
                780,

              cursor:
                "pointer",

              opacity:
                subject !==
                  "everything" &&
                !selectedFields.length
                  ? .45
                  : 1,
            }}
          >
            Generate report
          </button>
        </Section>
      </div>
    </div>
  );
}
