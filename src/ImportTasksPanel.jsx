import React, {
  useMemo,
  useRef,
  useState,
} from "react";


function normalizePriority(
  value
) {
  const p =
    String(
      value || "med"
    )
      .trim()
      .toLowerCase();

  if (
    p === "medium"
  ) {
    return "med";
  }

  return [
    "high",
    "med",
    "low",
  ].includes(p)
    ? p
    : "med";
}


function normalizeMode(
  value
) {
  const mode =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    [
      "replace-area",
      "replace_area",
      "replacearea",
    ].includes(mode)
  ) {
    return "replace-area";
  }

  if (
    [
      "replace-range",
      "replace_range",
      "replacerange",
    ].includes(mode)
  ) {
    return "replace-range";
  }

  return "add";
}


function normalizeTask(
  raw,
  index
) {
  const title =
    String(
      raw?.title || ""
    ).trim();

  const dueDate =
    String(
      raw?.dueDate ||
      raw?.due ||
      ""
    ).trim();

  const errors = [];

  if (!title) {
    errors.push(
      `Task ${
        index + 1
      }: title is required.`
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dueDate
    )
  ) {
    errors.push(
      `${
        title ||
        `Task ${
          index + 1
        }`
      }: dueDate must be YYYY-MM-DD.`
    );
  }

  const subtasks =
    (
      Array.isArray(
        raw?.subtasks
      )
        ? raw.subtasks
        : []
    )
      .map(
        (
          item,
          subIndex
        ) => {
          if (
            typeof item ===
            "string"
          ) {
            return {
              id:
                `import_sub_${Date.now()}_${index}_${subIndex}`,
              label:
                item.trim(),
              done: false,
            };
          }

          return {
            id:
              item?.id ||
              `import_sub_${Date.now()}_${index}_${subIndex}`,
            label:
              String(
                item?.label ||
                item?.title ||
                ""
              ).trim(),
            done:
              Boolean(
                item?.done
              ),
          };
        }
      )
      .filter(
        (item) =>
          item.label
      );

  return {
    errors,

    task: {
      title,
      dueDate,

      dueTime:
        raw?.dueTime ||
        null,

      priority:
        normalizePriority(
          raw?.priority
        ),

      areaName:
        String(
          raw?.area ||
          raw?.areaName ||
          ""
        ).trim(),

      notes:
        String(
          raw?.notes ||
          ""
        ).trim(),

      subtasks,

      reminder:
        raw?.reminder ||
        "None",

      reminderAt:
        raw?.reminderAt ||
        null,

      targetDate:
        raw?.targetDate ||
        raw?.finishBy ||
        null,

      status:
        raw?.status ||
        "next",

      progress:
        raw?.progress ||
        "not_started",
    },
  };
}


function normalizeScope(
  raw
) {
  return {
    area:
      String(
        raw?.area ||
        ""
      ).trim(),

    startDate:
      String(
        raw?.startDate ||
        ""
      ).trim(),

    endDate:
      String(
        raw?.endDate ||
        ""
      ).trim(),

    preserveCompleted:
      raw
        ?.preserveCompleted !==
      false,
  };
}


function parseJson(
  text
) {
  try {
    const parsed =
      JSON.parse(text);

    const list =
      Array.isArray(
        parsed
      )
        ? parsed
        : parsed?.tasks;

    if (
      !Array.isArray(
        list
      )
    ) {
      return {
        tasks: [],
        errors: [
          "JSON must contain a tasks array.",
        ],
        directives: {
          mode: "add",
          scope:
            normalizeScope(
              {}
            ),
        },
      };
    }

    const tasks = [];
    const errors = [];

    list.forEach(
      (
        item,
        index
      ) => {
        const normalized =
          normalizeTask(
            item,
            index
          );

        errors.push(
          ...normalized.errors
        );

        if (
          !normalized
            .errors.length
        ) {
          tasks.push(
            normalized.task
          );
        }
      }
    );

    return {
      tasks,
      errors,

      directives: {
        mode:
          normalizeMode(
            parsed?.mode
          ),

        scope:
          normalizeScope(
            parsed?.scope ||
            {}
          ),

        format:
          parsed?.format ||
          "",

        version:
          parsed?.version ||
          null,
      },
    };
  } catch {
    return {
      tasks: [],
      errors: [
        "That file is not valid JSON.",
      ],
      directives: {
        mode: "add",
        scope:
          normalizeScope(
            {}
          ),
      },
    };
  }
}


function parseCsvRows(
  text
) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (
    let i = 0;
    i < text.length;
    i += 1
  ) {
    const ch =
      text[i];

    const next =
      text[i + 1];

    if (
      ch === '"' &&
      quoted &&
      next === '"'
    ) {
      cell += '"';
      i += 1;
    } else if (
      ch === '"'
    ) {
      quoted =
        !quoted;
    } else if (
      ch === "," &&
      !quoted
    ) {
      row.push(cell);
      cell = "";
    } else if (
      (
        ch === "\n" ||
        ch === "\r"
      ) &&
      !quoted
    ) {
      if (
        ch === "\r" &&
        next === "\n"
      ) {
        i += 1;
      }

      row.push(cell);

      if (
        row.some(
          (item) =>
            item.trim()
        )
      ) {
        rows.push(row);
      }

      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell);

  if (
    row.some(
      (item) =>
        item.trim()
    )
  ) {
    rows.push(row);
  }

  return rows;
}


function parseCsv(
  text
) {
  const rows =
    parseCsvRows(
      text
    );

  if (
    rows.length < 2
  ) {
    return {
      tasks: [],
      errors: [
        "CSV needs a header row and at least one task.",
      ],
      directives: {
        mode: "add",
        scope:
          normalizeScope(
            {}
          ),
      },
    };
  }

  const headers =
    rows[0].map(
      (header) =>
        header
          .trim()
          .toLowerCase()
          .replace(
            /\s+/g,
            ""
          )
    );

  const get = (
    row,
    ...names
  ) => {
    const index =
      headers.findIndex(
        (header) =>
          names.includes(
            header
          )
      );

    return index >= 0
      ? row[index] || ""
      : "";
  };

  const tasks = [];
  const errors = [];

  rows
    .slice(1)
    .forEach(
      (
        row,
        index
      ) => {
        const normalized =
          normalizeTask(
            {
              title:
                get(
                  row,
                  "title",
                  "task"
                ),

              dueDate:
                get(
                  row,
                  "duedate",
                  "due"
                ),

              dueTime:
                get(
                  row,
                  "duetime",
                  "time"
                ),

              priority:
                get(
                  row,
                  "priority"
                ),

              area:
                get(
                  row,
                  "area"
                ),

              notes:
                get(
                  row,
                  "notes"
                ),

              reminder:
                get(
                  row,
                  "reminder"
                ),

              reminderAt:
                get(
                  row,
                  "reminderat"
                ),

              targetDate:
                get(
                  row,
                  "targetdate",
                  "finishby"
                ),

              status:
                get(
                  row,
                  "status"
                ),

              progress:
                get(
                  row,
                  "progress"
                ),

              subtasks:
                get(
                  row,
                  "subtasks"
                )
                  ? get(
                      row,
                      "subtasks"
                    )
                      .split("|")
                      .map(
                        (item) =>
                          item.trim()
                      )
                      .filter(
                        Boolean
                      )
                  : [],
            },
            index
          );

        errors.push(
          ...normalized.errors
        );

        if (
          !normalized
            .errors.length
        ) {
          tasks.push(
            normalized.task
          );
        }
      }
    );

  return {
    tasks,
    errors,

    directives: {
      mode: "add",

      scope:
        normalizeScope(
          {}
        ),
    },
  };
}


function findAreaId(
  areas,
  name
) {
  const wanted =
    String(
      name || ""
    )
      .trim()
      .toLowerCase();

  if (!wanted) {
    return "";
  }

  return (
    Object.entries(
      areas || {}
    ).find(
      ([, area]) =>
        String(
          area?.name ||
          ""
        )
          .trim()
          .toLowerCase() ===
        wanted
    )?.[0] ||
    ""
  );
}


function areaNameForTask(
  task,
  areas
) {
  if (
    task?.area &&
    areas?.[
      task.area
    ]
  ) {
    return (
      areas[
        task.area
      ]?.name ||
      ""
    );
  }

  return (
    task?.areaName ||
    ""
  );
}


function formatDate(
  dateKey
) {
  const d =
    new Date(
      `${dateKey}T12:00:00`
    );

  return Number.isNaN(
    d.getTime()
  )
    ? dateKey
    : d.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        }
      );
}


function dueLabel(
  dateKey,
  time
) {
  if (time) {
    const [
      hour,
      minute,
    ] =
      String(
        time
      )
        .split(":")
        .map(Number);

    const d =
      new Date();

    d.setHours(
      hour || 0,
      minute || 0,
      0,
      0
    );

    return d.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  return formatDate(
    dateKey
  );
}


function copyText(
  text
) {
  if (
    navigator.clipboard
      ?.writeText
  ) {
    return navigator.clipboard
      .writeText(text);
  }

  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value = text;

  textarea.style.position =
    "fixed";

  textarea.style.opacity =
    "0";

  document.body.appendChild(
    textarea
  );

  textarea.select();

  document.execCommand(
    "copy"
  );

  textarea.remove();

  return Promise.resolve();
}


function aiInstructions(
  areas
) {
  const areaNames =
    Object.values(
      areas || {}
    )
      .map(
        (area) =>
          area?.name
      )
      .filter(Boolean);

  return `You are creating an import for my Abide productivity app.

Return ONLY valid JSON. Do not use markdown fences.

FORMAT:
{
  "format": "abide-task-import",
  "version": 2,
  "mode": "add" | "replace-area" | "replace-range",
  "scope": {
    "area": "Area name or blank",
    "startDate": "YYYY-MM-DD or blank",
    "endDate": "YYYY-MM-DD or blank",
    "preserveCompleted": true
  },
  "tasks": [
    {
      "title": "Required",
      "dueDate": "YYYY-MM-DD",
      "dueTime": "HH:MM or null",
      "targetDate": "YYYY-MM-DD or null",
      "priority": "high" | "med" | "low",
      "area": "Area name",
      "notes": "",
      "reminder": "None" | "At time" | "5 min before" | "15 min before" | "30 min before" | "1 hour before" | "1 day before" | "2 days before" | "Custom",
      "reminderAt": "YYYY-MM-DDTHH:MM or null",
      "status": "next",
      "progress": "not_started" | "in_progress" | "completed",
      "subtasks": ["Subtask 1", "Subtask 2"]
    }
  ]
}

IMPORT MODES:
- add: keep existing tasks and add these.
- replace-area: replace incomplete tasks in the matching Area(s).
- replace-range: replace incomplete tasks only in the matching Area(s) and date range.
- preserveCompleted should normally remain true.

AVAILABLE AREAS:
${areaNames.length
  ? areaNames
      .map(
        (name) =>
          `- ${name}`
      )
      .join("\n")
  : "- No Areas currently configured"}

When I describe a plan, choose the safest appropriate import mode. If I say replace, redo, rebuild, or reorganize an existing period, use replace-range when a date range is clear. Preserve completed work unless I explicitly tell you otherwise.`;
}


function currentContext(
  tasks,
  areas
) {
  const normalizedTasks =
    (
      Array.isArray(
        tasks
      )
        ? tasks
        : []
    ).map(
      (task) => ({
        id:
          task.id,

        title:
          task.title,

        dueDate:
          task.dueDate,

        dueTime:
          task.dueTime ||
          null,

        targetDate:
          task.targetDate ||
          null,

        priority:
          task.priority,

        area:
          areaNameForTask(
            task,
            areas
          ),

        done:
          Boolean(
            task.done
          ),

        progress:
          task.progress ||
          (
            task.done
              ? "completed"
              : "not_started"
          ),

        reminder:
          task.reminder ||
          "None",

        notes:
          task.notes ||
          "",
      })
    );

  return `${aiInstructions(
    areas
  )}

CURRENT ABIDE CONTEXT:
${JSON.stringify(
  {
    areas:
      Object.values(
        areas || {}
      )
        .map(
          (area) => ({
            name:
              area?.name ||
              "",
          })
        )
        .filter(
          (area) =>
            area.name
        ),

    tasks:
      normalizedTasks,
  },
  null,
  2
)}

Use this current context when I ask you to reorganize, replace, reschedule, or rebuild my existing Abide plan.`;
}


export default function ImportTasksPanel({
  areas,
  tasks = [],
  onCreateArea,
  onCreateTask,
  onDeleteTask,
  onClose,
}) {
  const [
    mode,
    setMode,
  ] =
    useState("file");

  const [
    kind,
    setKind,
  ] =
    useState("json");

  const [
    rawText,
    setRawText,
  ] =
    useState("");

  const [
    fileName,
    setFileName,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    importMode,
    setImportMode,
  ] =
    useState("add");

  const [
    scopeArea,
    setScopeArea,
  ] =
    useState("");

  const [
    scopeStart,
    setScopeStart,
  ] =
    useState("");

  const [
    scopeEnd,
    setScopeEnd,
  ] =
    useState("");

  const [
    preserveCompleted,
    setPreserveCompleted,
  ] =
    useState(true);

  const fileRef =
    useRef(null);


  const parsed =
    useMemo(
      () => {
        if (
          !rawText.trim()
        ) {
          return {
            tasks: [],
            errors: [],
            directives: {
              mode: "add",
              scope:
                normalizeScope(
                  {}
                ),
            },
          };
        }

        return kind ===
          "csv"
          ? parseCsv(
              rawText
            )
          : parseJson(
              rawText
            );
      },
      [
        rawText,
        kind,
      ]
    );


  const dates =
    parsed.tasks
      .map(
        (task) =>
          task.dueDate
      )
      .sort();


  const areaNames =
    [
      ...new Set(
        parsed.tasks
          .map(
            (task) =>
              task.areaName
          )
          .filter(Boolean)
      ),
    ];


  const high =
    parsed.tasks.filter(
      (task) =>
        task.priority ===
        "high"
    ).length;

  const med =
    parsed.tasks.filter(
      (task) =>
        task.priority ===
        "med"
    ).length;

  const low =
    parsed.tasks.filter(
      (task) =>
        task.priority ===
        "low"
    ).length;


  const applyDirectives = (
    result
  ) => {
    const directives =
      result?.directives;

    if (!directives) {
      return;
    }

    setImportMode(
      normalizeMode(
        directives.mode
      )
    );

    if (
      directives.scope
        ?.area
    ) {
      setScopeArea(
        directives.scope
          .area
      );
    }

    if (
      directives.scope
        ?.startDate
    ) {
      setScopeStart(
        directives.scope
          .startDate
      );
    }

    if (
      directives.scope
        ?.endDate
    ) {
      setScopeEnd(
        directives.scope
          .endDate
      );
    }

    setPreserveCompleted(
      directives.scope
        ?.preserveCompleted !==
        false
    );
  };


  const readFile =
    async (file) => {
      if (!file) {
        return;
      }

      const nextKind =
        file.name
          .toLowerCase()
          .endsWith(".csv")
          ? "csv"
          : "json";

      setKind(nextKind);

      setFileName(
        file.name
      );

      setMessage("");

      try {
        const text =
          await file.text();

        setRawText(text);

        const result =
          nextKind ===
          "csv"
            ? parseCsv(text)
            : parseJson(text);

        applyDirectives(
          result
        );
      } catch {
        setMessage(
          "Abide could not read that file."
        );
      }
    };


  const effectiveAreas =
    scopeArea
      ? [
          scopeArea,
        ]
      : areaNames;


  const effectiveStart =
    scopeStart ||
    dates[0] ||
    "";

  const effectiveEnd =
    scopeEnd ||
    dates[
      dates.length - 1
    ] ||
    "";


  const replacements =
    useMemo(
      () => {
        if (
          importMode ===
          "add"
        ) {
          return [];
        }

        const wantedAreas =
          new Set(
            effectiveAreas
              .map(
                (name) =>
                  String(
                    name
                  )
                    .trim()
                    .toLowerCase()
              )
              .filter(Boolean)
          );

        return (
          Array.isArray(
            tasks
          )
            ? tasks
            : []
        ).filter(
          (task) => {
            if (
              preserveCompleted &&
              (
                task.done ||
                task.progress ===
                  "completed"
              )
            ) {
              return false;
            }

            const taskArea =
              areaNameForTask(
                task,
                areas
              )
                .trim()
                .toLowerCase();

            if (
              wantedAreas.size &&
              !wantedAreas.has(
                taskArea
              )
            ) {
              return false;
            }

            if (
              importMode ===
              "replace-range"
            ) {
              const date =
                String(
                  task.dueDate ||
                  ""
                );

              if (
                effectiveStart &&
                date <
                  effectiveStart
              ) {
                return false;
              }

              if (
                effectiveEnd &&
                date >
                  effectiveEnd
              ) {
                return false;
              }
            }

            return true;
          }
        );
      },
      [
        importMode,
        tasks,
        areas,
        preserveCompleted,
        scopeArea,
        scopeStart,
        scopeEnd,
        parsed.tasks,
      ]
    );


  const importTasks =
    () => {
      if (
        !parsed.tasks
          .length ||
        parsed.errors
          .length
      ) {
        setMessage(
          parsed.errors[0] ||
          "No valid tasks found."
        );

        return;
      }

      if (
        importMode !==
          "add" &&
        !onDeleteTask
      ) {
        setMessage(
          "This Abide screen cannot safely replace existing tasks yet because task deletion is not available here."
        );

        return;
      }

      if (
        importMode ===
          "replace-range" &&
        (
          !effectiveStart ||
          !effectiveEnd
        )
      ) {
        setMessage(
          "Replace Range needs a start and end date."
        );

        return;
      }

      const summary =
        importMode ===
        "add"
          ? `Import ${parsed.tasks.length} new task${
              parsed.tasks
                .length ===
              1
                ? ""
                : "s"
            }?`
          : `This will remove ${replacements.length} existing incomplete task${
              replacements
                .length ===
              1
                ? ""
                : "s"
            } and import ${parsed.tasks.length} replacement task${
              parsed.tasks
                .length ===
              1
                ? ""
                : "s"
            }.\n\n${
              preserveCompleted
                ? "Completed tasks will be preserved."
                : "Completed tasks may also be removed."
            }\n\nContinue?`;

      if (
        !window.confirm(
          summary
        )
      ) {
        return;
      }


      if (
        importMode !==
        "add"
      ) {
        replacements.forEach(
          (task) => {
            onDeleteTask(
              task.id
            );
          }
        );
      }


      const createdAreas =
        {};


      parsed.tasks.forEach(
        (item) => {
          let areaId =
            findAreaId(
              areas,
              item.areaName
            );

          if (
            !areaId &&
            item.areaName &&
            onCreateArea
          ) {
            const key =
              item.areaName
                .toLowerCase();

            if (
              !createdAreas[
                key
              ]
            ) {
              createdAreas[
                key
              ] =
                onCreateArea({
                  name:
                    item.areaName,
                  color:
                    "#7C93C9",
                });
            }

            areaId =
              createdAreas[
                key
              ];
          }


          onCreateTask({
            title:
              item.title,

            dueDate:
              item.dueDate,

            dueTime:
              item.dueTime ||
              null,

            due:
              dueLabel(
                item.dueDate,
                item.dueTime
              ),

            targetDate:
              item.targetDate ||
              null,

            priority:
              item.priority,

            area:
              areaId ||
              null,

            goal: null,

            notes:
              item.notes,

            activities:
              item.notes
                ? [
                    {
                      id:
                        `import_activity_${Date.now()}_${Math.random()}`,
                      text:
                        item.notes,
                      createdAt:
                        new Date()
                          .toISOString(),
                    },
                  ]
                : [],

            repeat: null,

            recurrence: null,

            reminder:
              item.reminder,

            reminderAt:
              item.reminderAt ||
              null,

            subtasks:
              item.subtasks,

            done: false,

            progress:
              item.progress ||
              "not_started",

            status:
              item.status,

            bypassProtected:
              false,
          });
        }
      );


      onClose();
    };


  const copyInstructions =
    async () => {
      await copyText(
        aiInstructions(
          areas
        )
      );

      setMessage(
        "AI import instructions copied. Paste them into any new ChatGPT conversation."
      );
    };


  const copyContext =
    async () => {
      await copyText(
        currentContext(
          tasks,
          areas
        )
      );

      setMessage(
        "AI context copied. Paste it into a new ChatGPT conversation and describe what you want changed."
      );
    };


  return (
    <div className="card composer-card">
      <div
        style={{
          padding:
            "10px 11px",
          borderRadius: 12,
          background:
            "rgba(124,147,201,.08)",
          border:
            "1px solid rgba(124,147,201,.18)",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 750,
            color:
              "var(--text)",
          }}
        >
          Build plans with AI
        </div>

        <div
          style={{
            fontSize: 10.75,
            lineHeight: 1.45,
            color:
              "var(--text3)",
            marginTop: 4,
          }}
        >
          Start a completely new ChatGPT conversation and paste one of these
          prompts first. The new chat will know Abide’s schema, Areas, and
          replacement rules.
        </div>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap:
              "wrap",
            marginTop: 9,
          }}
        >
          <div
            className="filter-chip"
            onClick={
              copyInstructions
            }
          >
            Copy AI Instructions
          </div>

          <div
            className="filter-chip active"
            onClick={
              copyContext
            }
          >
            Copy AI Context
          </div>
        </div>
      </div>


      <div
        className="segmented"
        style={{
          margin:
            "0 0 12px 0",
        }}
      >
        <div
          className={`seg-btn ${
            mode === "file"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setMode("file")
          }
        >
          Upload File
        </div>

        <div
          className={`seg-btn ${
            mode === "paste"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setMode("paste")
          }
        >
          Paste
        </div>
      </div>


      {mode === "file" ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            style={{
              display: "none",
            }}
            onChange={(e) =>
              readFile(
                e.target
                  .files?.[0]
              )
            }
          />

          <div
            className="import-drop"
            onClick={() =>
              fileRef.current
                ?.click()
            }
          >
            <div className="import-drop-title">
              {fileName ||
                "Choose an Abide JSON or CSV file"}
            </div>

            <div className="import-drop-copy">
              JSON is recommended for AI-created plans because it preserves
              replacement instructions, reminders, target dates, notes, and
              subtasks.
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="filter-row"
            style={{
              padding:
                "0 0 8px",
            }}
          >
            <div
              className={`filter-chip ${
                kind === "json"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setKind(
                  "json"
                )
              }
            >
              JSON
            </div>

            <div
              className={`filter-chip ${
                kind === "csv"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setKind(
                  "csv"
                )
              }
            >
              CSV
            </div>
          </div>

          <textarea
            className="import-textarea"
            value={
              rawText
            }
            onChange={(e) => {
              const value =
                e.target.value;

              setRawText(
                value
              );

              setMessage(
                ""
              );

              if (
                kind ===
                  "json" &&
                value.trim()
              ) {
                const result =
                  parseJson(
                    value
                  );

                if (
                  !result.errors
                    .length
                ) {
                  applyDirectives(
                    result
                  );
                }
              }
            }}
            placeholder={
              kind === "json"
                ? '{"format":"abide-task-import","version":2,"mode":"add","scope":{"preserveCompleted":true},"tasks":[...]}'
                : "Title,Due Date,Due Time,Priority,Area,Notes,Reminder,Target Date,Subtasks"
            }
          />
        </>
      )}


      <div className="section-label">
        Import Behavior
      </div>

      <div
        className="filter-row"
        style={{
          padding: 0,
          flexWrap: "wrap",
          overflowX:
            "visible",
        }}
      >
        {[
          [
            "add",
            "Add",
          ],
          [
            "replace-area",
            "Replace Area",
          ],
          [
            "replace-range",
            "Replace Area + Dates",
          ],
        ].map(
          ([
            key,
            label,
          ]) => (
            <div
              key={key}
              className={`filter-chip ${
                importMode ===
                key
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setImportMode(
                  key
                )
              }
            >
              {label}
            </div>
          )
        )}
      </div>


      {importMode !==
        "add" && (
        <div
          style={{
            marginTop: 10,
            padding:
              "10px 11px",
            borderRadius: 12,
            border:
              "1px solid var(--divider)",
            background:
              "var(--subtleBg)",
          }}
        >
          <div className="fb-label">
            Replacement Area
          </div>

          <select
            className="input-line"
            value={
              scopeArea
            }
            onChange={(e) =>
              setScopeArea(
                e.target.value
              )
            }
          >
            <option value="">
              Use Areas from imported tasks
            </option>

            {Object.values(
              areas || {}
            ).map(
              (area) => (
                <option
                  key={
                    area.name
                  }
                  value={
                    area.name
                  }
                >
                  {area.name}
                </option>
              )
            )}
          </select>


          {importMode ===
            "replace-range" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              <div>
                <div className="fb-label">
                  Start
                </div>

                <input
                  type="date"
                  className="input-line"
                  value={
                    scopeStart ||
                    effectiveStart
                  }
                  onChange={(e) =>
                    setScopeStart(
                      e.target
                        .value
                    )
                  }
                />
              </div>

              <div>
                <div className="fb-label">
                  End
                </div>

                <input
                  type="date"
                  className="input-line"
                  value={
                    scopeEnd ||
                    effectiveEnd
                  }
                  onChange={(e) =>
                    setScopeEnd(
                      e.target
                        .value
                    )
                  }
                />
              </div>
            </div>
          )}


          <div
            className="settings-row"
            style={{
              marginTop: 8,
              padding: 0,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    "var(--text)",
                }}
              >
                Preserve completed tasks
              </div>

              <div
                style={{
                  fontSize: 10.5,
                  color:
                    "var(--text3)",
                  marginTop: 2,
                }}
              >
                Recommended. Finished work stays in your history.
              </div>
            </div>

            <input
              type="checkbox"
              checked={
                preserveCompleted
              }
              onChange={(e) =>
                setPreserveCompleted(
                  e.target
                    .checked
                )
              }
            />
          </div>


          <div
            style={{
              marginTop: 8,
              fontSize: 10.75,
              color:
                replacements.length
                  ? "#E8B45C"
                  : "var(--text3)",
              lineHeight: 1.45,
            }}
          >
            {replacements.length} existing task
            {replacements.length ===
            1
              ? ""
              : "s"}{" "}
            would be replaced with the current settings.
          </div>
        </div>
      )}


      {(rawText.trim() ||
        message) && (
        <div className="import-summary">
          <div
            style={{
              fontSize: 13,
              fontWeight: 750,
              color:
                parsed.errors
                  .length
                  ? "#E68080"
                  : "var(--text)",
            }}
          >
            {parsed.errors
              .length
              ? `${
                  parsed.errors
                    .length
                } issue${
                  parsed.errors
                    .length ===
                  1
                    ? ""
                    : "s"
                } to fix`
              : `${
                  parsed.tasks
                    .length
                } task${
                  parsed.tasks
                    .length ===
                  1
                    ? ""
                    : "s"
                } ready`}
          </div>


          {!parsed.errors
            .length &&
            parsed.tasks
              .length >
              0 && (
              <>
                <div className="import-stat-row">
                  <span
                    className="chip"
                    style={{
                      background:
                        "#E8B45C22",
                      color:
                        "#E8B45C",
                    }}
                  >
                    {high} high
                  </span>

                  <span
                    className="chip"
                    style={{
                      background:
                        "#7C93C922",
                      color:
                        "#7C93C9",
                    }}
                  >
                    {med} medium
                  </span>

                  <span
                    className="chip"
                    style={{
                      background:
                        "#8FA88A22",
                      color:
                        "#8FA88A",
                    }}
                  >
                    {low} low
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 11.5,
                    color:
                      "var(--text3)",
                    marginTop: 8,
                  }}
                >
                  {dates.length
                    ? `${formatDate(
                        dates[0]
                      )} → ${formatDate(
                        dates[
                          dates.length -
                            1
                        ]
                      )}`
                    : "No dates"}

                  {areaNames.length
                    ? ` · ${areaNames.join(
                        ", "
                      )}`
                    : ""}
                </div>

                <div
                  style={{
                    fontSize: 11.5,
                    color:
                      "var(--text3)",
                    marginTop: 5,
                  }}
                >
                  Nothing changes until you confirm the import.
                </div>
              </>
            )}


          {parsed.errors
            .slice(0, 4)
            .map(
              (
                error,
                index
              ) => (
                <div
                  className="import-error"
                  key={index}
                >
                  {error}
                </div>
              )
            )}


          {message && (
            <div
              className={
                message
                  .toLowerCase()
                  .includes(
                    "copied"
                  )
                  ? ""
                  : "import-error"
              }
              style={{
                marginTop: 7,
                fontSize: 11.5,
                color:
                  message
                    .toLowerCase()
                    .includes(
                      "copied"
                    )
                    ? "#8FA88A"
                    : undefined,
              }}
            >
              {message}
            </div>
          )}
        </div>
      )}


      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 12,
        }}
      >
        <div
          className="filter-chip active"
          style={{
            flex: 1,
            justifyContent:
              "center",
            opacity:
              parsed.tasks
                .length &&
              !parsed.errors
                .length
                ? 1
                : 0.5,
          }}
          onClick={
            importTasks
          }
        >
          {importMode ===
          "add"
            ? `Import ${
                parsed.tasks
                  .length ||
                ""
              } Tasks`
            : `Replace & Import ${
                parsed.tasks
                  .length ||
                ""
              }`}
        </div>

        <div
          className="filter-chip"
          style={{
            flex: 1,
            justifyContent:
              "center",
          }}
          onClick={
            onClose
          }
        >
          Cancel
        </div>
      </div>
    </div>
  );
}
