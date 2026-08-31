import React, { useEffect, useMemo, useState } from "react";

/* ABIDE REPORT BUILDER V2
   Multi-subject reporting · per-section filters/columns/sort/group · presets
   CSV · Excel · Word · PDF · ZIP
*/

const SUBJECTS = ["tasks", "goals", "areas", "journal", "notes", "insights"];

const LABELS = {
  tasks: "Tasks",
  goals: "Goals",
  areas: "Areas",
  journal: "Journal",
  notes: "Notes",
  insights: "Insights",
};

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromKey(value) {
  const text = String(value || "").slice(0, 10);
  const [y, m, d] = text.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function shiftDate(key, amount) {
  const d = dateFromKey(key);
  if (!d) return key;
  d.setDate(d.getDate() + Number(amount || 0));
  return dateKey(d);
}

function weekRange() {
  const today = dateFromKey(dateKey());
  let startDay = 0;
  try {
    startDay = JSON.parse(localStorage.getItem("abide-week-start")) === "monday" ? 1 : 0;
  } catch {}
  const offset = (today.getDay() - startDay + 7) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: dateKey(start), end: dateKey(end) };
}

function notePlainText(note) {
  if (Array.isArray(note?.blocks)) {
    return note.blocks.map((block) => {
      if (typeof block === "string") return block;
      if (typeof block?.text === "string") return block.text;
      if (typeof block?.content === "string") return block.content;
      if (Array.isArray(block?.content)) {
        return block.content.map((part) =>
          typeof part === "string" ? part : part?.text || ""
        ).join("");
      }
      return "";
    }).filter(Boolean).join("\n\n");
  }
  return String(note?.content || note?.body || note?.text || "");
}

function readNotes() {
  if (typeof window === "undefined") return [];
  const results = [];
  const seen = new Set();

  const visit = (value, storageKey) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, storageKey));
      return;
    }

    if (typeof value !== "object") return;

    const looksLikeNote =
      value.title || value.blocks || value.content || value.body || value.text;

    if (looksLikeNote) {
      const identity = String(
        value.id ||
        value.noteId ||
        value.title ||
        JSON.stringify(value.blocks || value.content || value.body || value.text || "")
      );

      if (!seen.has(identity)) {
        seen.add(identity);
        results.push({
          ...value,
          _storageKey: storageKey,
          _plainText: notePlainText(value),
        });
      }
      return;
    }

    Object.values(value).forEach((child) => visit(child, storageKey));
  };

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    const lower = key.toLowerCase();
    if (!lower.includes("note") && !lower.includes("scratch")) continue;

    try {
      visit(JSON.parse(localStorage.getItem(key)), key);
    } catch {}
  }

  return results;
}

function csvValue(value) {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows, fields) {
  return [
    fields.map((field) => csvValue(field.label)).join(","),
    ...rows.map((row) =>
      fields.map((field) => csvValue(row[field.key])).join(",")
    ),
  ].join("\n");
}

function download(filename, content, mime = "application/octet-stream") {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: `${mime};charset=utf-8` });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function booleanValue(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "yes";
}

function defaultOperator(type) {
  if (type === "date") return "on";
  if (type === "number") return "eq";
  if (type === "boolean") return "true";
  if (type === "select") return "equals";
  return "contains";
}

function operatorsFor(type) {
  if (type === "date") {
    return [
      ["on", "is"],
      ["before", "is before"],
      ["after", "is after"],
      ["between", "is between"],
      ["next_n_days", "is within the next"],
      ["previous_n_days", "is within the previous"],
      ["more_than_n_overdue", "is more than"],
      ["today", "is today"],
      ["tomorrow", "is tomorrow"],
      ["this_week", "is this week"],
      ["next_week", "is next week"],
      ["this_month", "is this month"],
      ["empty", "has no date"],
      ["not_empty", "has a date"],
    ];
  }

  if (type === "number") {
    return [
      ["eq", "equals"],
      ["neq", "does not equal"],
      ["gt", "is greater than"],
      ["gte", "is at least"],
      ["lt", "is less than"],
      ["lte", "is at most"],
      ["between", "is between"],
    ];
  }

  if (type === "boolean") {
    return [["true", "is yes"], ["false", "is no"]];
  }

  if (type === "select") {
    return [
      ["equals", "is"],
      ["not_equals", "is not"],
      ["one_of", "is any of"],
      ["not_one_of", "is none of"],
      ["empty", "is empty"],
      ["not_empty", "is not empty"],
    ];
  }

  return [
    ["contains", "contains"],
    ["not_contains", "does not contain"],
    ["equals", "equals"],
    ["not_equals", "does not equal"],
    ["starts_with", "starts with"],
    ["ends_with", "ends with"],
    ["empty", "is empty"],
    ["not_empty", "is not empty"],
  ];
}

function filterMatches(row, filter, field) {
  const raw = row?.[filter.field];
  const op = filter.operator;

  if (field.type === "boolean") {
    return op === "true" ? booleanValue(raw) : !booleanValue(raw);
  }

  if (field.type === "number") {
    const current = Number(raw);
    const a = Number(filter.value);
    const b = Number(filter.value2);
    if (Number.isNaN(current)) return false;
    if (op === "eq") return current === a;
    if (op === "neq") return current !== a;
    if (op === "gt") return current > a;
    if (op === "gte") return current >= a;
    if (op === "lt") return current < a;
    if (op === "lte") return current <= a;
    if (op === "between") return current >= a && current <= b;
    return true;
  }

  if (field.type === "date") {
    const current = raw ? String(raw).slice(0, 10) : "";
    const today = dateKey();

    if (op === "empty") return !current;
    if (op === "not_empty") return Boolean(current);
    if (!current) return false;

    if (op === "on") return current === filter.value;
    if (op === "before") return current < filter.value;
    if (op === "after") return current > filter.value;
    if (op === "between") return current >= filter.value && current <= filter.value2;

    if (op === "next_n_days") {
      const n = Math.max(0, Number(filter.value || 0));
      return current >= today && current <= shiftDate(today, n);
    }

    if (op === "previous_n_days") {
      const n = Math.max(0, Number(filter.value || 0));
      return current <= today && current >= shiftDate(today, -n);
    }

    if (op === "more_than_n_overdue") {
      const n = Math.max(0, Number(filter.value || 0));
      return current < shiftDate(today, -n);
    }

    if (op === "today") return current === today;
    if (op === "tomorrow") return current === shiftDate(today, 1);

    if (op === "this_week") {
      const range = weekRange();
      return current >= range.start && current <= range.end;
    }

    if (op === "next_week") {
      const range = weekRange();
      const start = shiftDate(range.end, 1);
      const end = shiftDate(start, 6);
      return current >= start && current <= end;
    }

    if (op === "this_month") {
      return current.slice(0, 7) === today.slice(0, 7);
    }

    return true;
  }

  const current = normalized(raw);
  const expected = normalized(filter.value);

  if (op === "empty") return !current;
  if (op === "not_empty") return Boolean(current);

  if (op === "one_of" || op === "not_one_of") {
    const options = String(filter.value || "")
      .split(",")
      .map(normalized)
      .filter(Boolean);
    const match = options.includes(current);
    return op === "one_of" ? match : !match;
  }

  if (op === "contains") return current.includes(expected);
  if (op === "not_contains") return !current.includes(expected);
  if (op === "equals") return current === expected;
  if (op === "not_equals") return current !== expected;
  if (op === "starts_with") return current.startsWith(expected);
  if (op === "ends_with") return current.endsWith(expected);
  return true;
}

function applyFilters(rows, filters, fields) {
  if (!filters.length) return rows;

  const fieldMap = Object.fromEntries(
    fields.map((field) => [field.key, field])
  );

  return rows.filter((row) => {
    let result = null;

    filters.forEach((filter, index) => {
      const field = fieldMap[filter.field];
      if (!field) return;

      const current = filterMatches(row, filter, field);

      if (index === 0 || result === null) {
        result = current;
      } else if (filter.join === "or") {
        result = result || current;
      } else {
        result = result && current;
      }
    });

    return result !== false;
  });
}

function sortRows(rows, field, direction) {
  if (!field) return rows;
  const factor = direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const left = a?.[field];
    const right = b?.[field];

    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }

    return String(left ?? "").localeCompare(
      String(right ?? ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    ) * factor;
  });
}

function groupRows(rows, field) {
  if (!field) return [{ label: "", rows }];

  const map = new Map();

  rows.forEach((row) => {
    const label = String(row?.[field] || "Unassigned");
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(row);
  });

  return Array.from(map.entries()).map(([label, items]) => ({
    label,
    rows: items,
  }));
}

function makeFilter(field, index = 0) {
  return {
    id: `${Date.now()}_${Math.random()}`,
    join: index === 0 ? "and" : "and",
    field: field.key,
    operator: defaultOperator(field.type),
    value: field.type === "date" ? dateKey() : "",
    value2: "",
  };
}

function makeDefinitions({ tasks, goals, areas, journalEntries, notes }) {
  const areaName = (id) => areas?.[id]?.name || "";

  const goalMap = Object.fromEntries(
    goals.map((goal) => [String(goal.id), goal.name || ""])
  );

  const taskDate = (task) => {
    if (task.dueDate) return task.dueDate;

    if (Number.isFinite(Number(task.dueOffsetDays))) {
      return shiftDate(dateKey(), Number(task.dueOffsetDays));
    }

    return "";
  };

  const areaOptions = Object.values(areas || {})
    .map((area) => area.name)
    .filter(Boolean);

  const goalOptions = goals
    .map((goal) => goal.name)
    .filter(Boolean);

  const taskRows = tasks.map((task) => {
    const dueDate = taskDate(task);

    return {
      id: task.id || "",
      title: task.title || "",
      area: areaName(task.area),
      areaId: task.area || "",
      goal: goalMap[String(task.goal)] || "",
      goalId: task.goal || "",
      dueDate,
      dueTime: task.dueTime || "",
      finishBy: task.targetDate || "",
      priority: task.priority || "",
      status: task.status || "",
      progress: task.done ? "completed" : task.progress || "not_started",
      completed: Boolean(task.done),
      overdue: Boolean(!task.done && dueDate && dueDate < dateKey()),
      isSubtask: Boolean(task.parentTaskId),
      parentTaskId: task.parentTaskId || "",
      hasGoal: Boolean(task.goal),
      reminder: task.reminder || "",
      recurrence: task.recurrence || task.repeat || "",
      notes: task.notes || "",
      createdAt: task.createdAt ? String(task.createdAt).slice(0, 10) : "",
      updatedAt: task.updatedAt ? String(task.updatedAt).slice(0, 10) : "",
      completedAt: task.completedAt ? String(task.completedAt).slice(0, 10) : "",
    };
  });

  const goalRows = goals.map((goal) => {
    const linked = tasks.filter(
      (task) => String(task.goal || "") === String(goal.id || "")
    );

    return {
      id: goal.id || "",
      goal: goal.name || "",
      area: areaName(goal.area),
      targetDate: goal.targetDate || "",
      progress: goal.progress ?? 0,
      notes: goal.notes || "",
      linkedTasks: linked.length,
      overdueTasks: linked.filter((task) => {
        const due = taskDate(task);
        return !task.done && due && due < dateKey();
      }).length,
      createdAt: goal.createdAt ? String(goal.createdAt).slice(0, 10) : "",
      updatedAt: goal.updatedAt ? String(goal.updatedAt).slice(0, 10) : "",
    };
  });

  const journalRows = journalEntries.map((entry) => ({
    id: entry.id || "",
    date:
      entry.dateKey ||
      (/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "") ? entry.date : ""),
    scripture: entry.ref || entry.scriptureRef || "",
    entry: entry.note || "",
    favorite: Boolean(entry.favorite),
    tag: entry.tag || "",
    createdAt: entry.createdAt ? String(entry.createdAt).slice(0, 10) : "",
    updatedAt: entry.updatedAt ? String(entry.updatedAt).slice(0, 10) : "",
  }));

  const noteRows = notes.map((note, index) => {
    const text = note._plainText || "";
    const blocks = Array.isArray(note.blocks) ? note.blocks : [];

    return {
      id: note.id || `note-${index + 1}`,
      title: note.title || note.name || `Note ${index + 1}`,
      text,
      createdAt: note.createdAt ? String(note.createdAt).slice(0, 10) : "",
      updatedAt: note.updatedAt ? String(note.updatedAt).slice(0, 10) : "",
      hasLinks: /https?:\/\//i.test(text),
      hasImages: blocks.some((block) =>
        String(block?.type || "").toLowerCase().includes("image")
      ),
      hasChecklist: blocks.some((block) =>
        ["todo", "to-do", "checklist"].includes(
          String(block?.type || "").toLowerCase()
        )
      ),
      hasHeadings: blocks.some((block) =>
        String(block?.type || "").toLowerCase().includes("heading")
      ),
    };
  });

  const areaRows = Object.entries(areas || {}).map(([id, area]) => {
    const items = tasks.filter((task) => task.area === id);
    const top = items.filter((task) => !task.parentTaskId);

    return {
      id,
      area: area.name,
      independentTasks: top.length,
      subtasks: items.filter((task) => Boolean(task.parentTaskId)).length,
      totalRecords: items.length,
      openTasks: top.filter((task) => !task.done).length,
      overdueTasks: top.filter((task) => {
        const due = taskDate(task);
        return !task.done && due && due < dateKey();
      }).length,
      completedTasks: top.filter((task) => task.done).length,
      goals: goals.filter((goal) => goal.area === id).length,
    };
  });

  const completed = tasks.filter((task) => task.done).length;

  const insightRows = [
    { metric: "Total task records", value: tasks.length },
    { metric: "Independent tasks", value: tasks.filter((task) => !task.parentTaskId).length },
    { metric: "Subtasks", value: tasks.filter((task) => Boolean(task.parentTaskId)).length },
    { metric: "Completed task records", value: completed },
    {
      metric: "Completion rate",
      value: tasks.length
        ? `${Math.round((completed / tasks.length) * 100)}%`
        : "0%",
    },
    { metric: "Goals", value: goals.length },
    { metric: "Journal entries", value: journalEntries.length },
    {
      metric: "Favorite journal entries",
      value: journalEntries.filter((entry) => entry.favorite).length,
    },
    { metric: "Notes", value: notes.length },
    { metric: "Areas", value: Object.keys(areas || {}).length },
  ];

  return {
    tasks: {
      rows: taskRows,
      fields: [
        ["title", "Title", "text", true],
        ["area", "Area", "select", true, areaOptions],
        ["goal", "Goal", "select", true, goalOptions],
        ["dueDate", "Due Date", "date", true],
        ["dueTime", "Due Time", "text", false],
        ["finishBy", "Finish By", "date", true],
        ["priority", "Priority", "select", true, ["high", "med", "low"]],
        ["status", "Status", "text", true],
        ["progress", "Progress", "select", true, ["not_started", "in_progress", "completed"]],
        ["completed", "Completed", "boolean", true],
        ["overdue", "Overdue", "boolean", false],
        ["isSubtask", "Is Subtask", "boolean", false],
        ["parentTaskId", "Parent Task ID", "text", false],
        ["hasGoal", "Has Goal", "boolean", false],
        ["reminder", "Reminder", "text", false],
        ["recurrence", "Recurrence", "text", false],
        ["notes", "Notes", "text", true],
        ["createdAt", "Created", "date", false],
        ["updatedAt", "Updated", "date", false],
        ["completedAt", "Completed Date", "date", false],
      ],
    },

    goals: {
      rows: goalRows,
      fields: [
        ["goal", "Goal", "text", true],
        ["area", "Area", "select", true, areaOptions],
        ["targetDate", "Target Date", "date", true],
        ["progress", "Progress", "number", true],
        ["linkedTasks", "Linked Tasks", "number", true],
        ["overdueTasks", "Overdue Tasks", "number", true],
        ["notes", "Notes", "text", true],
        ["createdAt", "Created", "date", false],
        ["updatedAt", "Updated", "date", false],
      ],
    },

    journal: {
      rows: journalRows,
      fields: [
        ["date", "Date", "date", true],
        ["scripture", "Scripture", "text", true],
        ["entry", "Entry", "text", true],
        ["favorite", "Favorite", "boolean", true],
        ["tag", "Tag", "text", false],
        ["createdAt", "Created", "date", false],
        ["updatedAt", "Updated", "date", false],
      ],
    },

    notes: {
      rows: noteRows,
      fields: [
        ["title", "Title", "text", true],
        ["text", "Content", "text", true],
        ["createdAt", "Created", "date", false],
        ["updatedAt", "Updated", "date", true],
        ["hasLinks", "Has Links", "boolean", false],
        ["hasImages", "Has Images", "boolean", false],
        ["hasChecklist", "Has Checklist", "boolean", false],
        ["hasHeadings", "Has Headings", "boolean", false],
      ],
    },

    areas: {
      rows: areaRows,
      fields: [
        ["area", "Area", "select", true, areaOptions],
        ["independentTasks", "Independent Tasks", "number", true],
        ["subtasks", "Subtasks", "number", true],
        ["totalRecords", "Total Records", "number", true],
        ["openTasks", "Open Tasks", "number", true],
        ["overdueTasks", "Overdue Tasks", "number", true],
        ["completedTasks", "Completed Tasks", "number", true],
        ["goals", "Goals", "number", true],
      ],
    },

    insights: {
      rows: insightRows,
      fields: [
        ["metric", "Metric", "text", true],
        ["value", "Value", "text", true],
      ],
    },
  };
}

function normalizeDefinitions(definitions) {
  return Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => [
      key,
      {
        ...definition,
        fields: definition.fields.map(
          ([fieldKey, label, type, defaultSelected, options]) => ({
            key: fieldKey,
            label,
            type,
            default: defaultSelected,
            options: options || [],
          })
        ),
      },
    ])
  );
}

function defaultSectionConfig(definition) {
  const fields = definition?.fields || [];

  return {
    filters: [],
    columns: fields
      .filter((field) => field.default)
      .map((field) => field.key),
    sortField: fields[0]?.key || "",
    sortDirection: "asc",
    groupField: "",
    open: true,
  };
}

function Button({ children, active = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        appearance: "none",
        border: active
          ? "1px solid #E8B45C"
          : "1px solid var(--divider)",
        background: active
          ? "rgba(232,180,92,.12)"
          : "var(--pillBg)",
        color: active ? "#E8B45C" : "var(--text2)",
        opacity: disabled ? .45 : 1,
        borderRadius: 9,
        padding: "8px 10px",
        fontFamily: "inherit",
        fontSize: 11.5,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "var(--inputBg)",
        border: "1px solid var(--inputBorder)",
        color: "var(--text)",
        borderRadius: 9,
        padding: "9px 10px",
        fontFamily: "inherit",
        fontSize: 12,
        outline: "none",
        ...(props.style || {}),
      }}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "var(--inputBg)",
        border: "1px solid var(--inputBorder)",
        color: "var(--text)",
        borderRadius: 9,
        padding: "9px 10px",
        fontFamily: "inherit",
        fontSize: 12,
        outline: "none",
        ...(props.style || {}),
      }}
    >
      {children}
    </select>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        border: "1px solid var(--divider)",
        background: "var(--card, rgba(255,255,255,.03))",
        borderRadius: 14,
        padding: 15,
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function JournalFavoriteDock({ entries, setEntries }) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) =>
        String(b.dateKey || b.date || "").localeCompare(
          String(a.dateKey || a.date || "")
        )
      ),
    [entries]
  );

  const count = entries.filter((entry) => entry.favorite).length;

  const toggle = (id) => {
    setEntries((current) =>
      current.map((entry) =>
        String(entry.id) === String(id)
          ? {
              ...entry,
              favorite: !entry.favorite,
              updatedAt: new Date().toISOString(),
            }
          : entry
      )
    );
  };

  return (
    <div style={{ position: "fixed", right: 16, bottom: 88, zIndex: 140 }}>
      {open && (
        <div
          style={{
            width: "min(360px, calc(100vw - 32px))",
            maxHeight: "55vh",
            overflowY: "auto",
            marginBottom: 9,
            background: "var(--appBg)",
            border: "1px solid var(--divider)",
            borderRadius: 14,
            boxShadow: "0 16px 50px rgba(0,0,0,.28)",
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 750,
                  color: "var(--text)",
                }}
              >
                Journal Favorites
              </div>

              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text3)",
                  marginTop: 2,
                }}
              >
                {count} favorite{count === 1 ? "" : "s"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text3)",
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              ×
            </button>
          </div>

          {sorted.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                gap: 10,
                padding: "10px 4px",
                borderTop: "1px solid var(--divider)",
              }}
            >
              <button
                type="button"
                onClick={() => toggle(entry.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: entry.favorite ? "#E8B45C" : "var(--text3)",
                  cursor: "pointer",
                  fontSize: 20,
                  padding: 0,
                }}
              >
                {entry.favorite ? "★" : "☆"}
              </button>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 650,
                    color: "var(--text)",
                  }}
                >
                  {entry.dateKey || entry.date || "Undated"}
                  {entry.ref ? ` · ${entry.ref}` : ""}
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 10.5,
                    color: "var(--text3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.note || "Journal check-in"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          border: "1px solid rgba(232,180,92,.35)",
          background: "var(--appBg)",
          color: "#E8B45C",
          borderRadius: 999,
          padding: "10px 13px",
          boxShadow: "0 8px 28px rgba(0,0,0,.24)",
          fontFamily: "inherit",
          fontSize: 11.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ★ Favorites{count ? ` · ${count}` : ""}
      </button>
    </div>
  );
}

function SectionEditor({
  subject,
  definition,
  config,
  updateConfig,
}) {
  const fields = definition.fields;
  const rows = definition.rows;

  const selectedFields = fields.filter((field) =>
    config.columns.includes(field.key)
  );

  const filtered = useMemo(
    () =>
      sortRows(
        applyFilters(rows, config.filters, fields),
        config.sortField,
        config.sortDirection
      ),
    [rows, config, fields]
  );

  const updateFilter = (id, changes) => {
    updateConfig({
      filters: config.filters.map((filter) =>
        filter.id === id
          ? { ...filter, ...changes }
          : filter
      ),
    });
  };

  const addFilter = () => {
    const field = fields[0];
    if (!field) return;

    updateConfig({
      filters: [
        ...config.filters,
        makeFilter(field, config.filters.length),
      ],
    });
  };

  const changeField = (filter, key) => {
    const field = fields.find((candidate) => candidate.key === key);
    if (!field) return;

    updateFilter(filter.id, {
      field: key,
      operator: defaultOperator(field.type),
      value: field.type === "date" ? dateKey() : "",
      value2: "",
    });
  };

  return (
    <Card>
      <button
        type="button"
        onClick={() =>
          updateConfig({ open: !config.open })
        }
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          color: "var(--text)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 15, fontWeight: 760 }}>
            {LABELS[subject]}
          </div>

          <div
            style={{
              fontSize: 10.5,
              color: "var(--text3)",
              marginTop: 2,
            }}
          >
            {filtered.length} record{filtered.length === 1 ? "" : "s"} match ·{" "}
            {selectedFields.length} field{selectedFields.length === 1 ? "" : "s"}
          </div>
        </div>

        <span style={{ color: "var(--text3)", fontSize: 16 }}>
          {config.open ? "⌃" : "⌄"}
        </span>
      </button>

      {config.open && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--divider)",
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text3)",
              marginBottom: 8,
            }}
          >
            Filters
          </div>

          {!config.filters.length && (
            <div
              style={{
                padding: 10,
                border: "1px dashed var(--divider)",
                borderRadius: 9,
                color: "var(--text3)",
                fontSize: 10.5,
                marginBottom: 8,
              }}
            >
              No filters applied. All {LABELS[subject].toLowerCase()} are included.
            </div>
          )}

          {config.filters.map((filter, index) => {
            const field =
              fields.find((candidate) => candidate.key === filter.field) ||
              fields[0];

            const noValue = [
              "empty",
              "not_empty",
              "today",
              "tomorrow",
              "this_week",
              "next_week",
              "this_month",
              "true",
              "false",
            ].includes(filter.operator);

            const relative = [
              "next_n_days",
              "previous_n_days",
              "more_than_n_overdue",
            ].includes(filter.operator);

            return (
              <div
                key={filter.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    index > 0
                      ? "70px minmax(120px,1fr) minmax(135px,1fr) minmax(120px,1fr) auto"
                      : "minmax(120px,1fr) minmax(135px,1fr) minmax(120px,1fr) auto",
                  gap: 7,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                {index > 0 && (
                  <Select
                    value={filter.join}
                    onChange={(event) =>
                      updateFilter(filter.id, {
                        join: event.target.value,
                      })
                    }
                  >
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                  </Select>
                )}

                <Select
                  value={filter.field}
                  onChange={(event) =>
                    changeField(filter, event.target.value)
                  }
                >
                  {fields.map((candidate) => (
                    <option
                      key={candidate.key}
                      value={candidate.key}
                    >
                      {candidate.label}
                    </option>
                  ))}
                </Select>

                <Select
                  value={filter.operator}
                  onChange={(event) =>
                    updateFilter(filter.id, {
                      operator: event.target.value,
                    })
                  }
                >
                  {operatorsFor(field.type).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>

                {!noValue && (
                  <div
                    style={{
                      display: "flex",
                      gap: 5,
                      alignItems: "center",
                    }}
                  >
                    {field.type === "select" &&
                    !["one_of", "not_one_of"].includes(filter.operator) ? (
                      <Select
                        value={filter.value}
                        onChange={(event) =>
                          updateFilter(filter.id, {
                            value: event.target.value,
                          })
                        }
                      >
                        <option value="">Choose…</option>

                        {(field.options || []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type={
                          relative || field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        min={relative ? "0" : undefined}
                        value={filter.value}
                        placeholder={
                          ["one_of", "not_one_of"].includes(filter.operator)
                            ? "Comma-separated values"
                            : relative
                              ? "Number of days"
                              : "Value"
                        }
                        onChange={(event) =>
                          updateFilter(filter.id, {
                            value: event.target.value,
                          })
                        }
                      />
                    )}

                    {filter.operator === "between" && (
                      <>
                        <span
                          style={{
                            color: "var(--text3)",
                            fontSize: 10,
                          }}
                        >
                          and
                        </span>

                        <Input
                          type={
                            field.type === "date"
                              ? "date"
                              : field.type === "number"
                                ? "number"
                                : "text"
                          }
                          value={filter.value2}
                          onChange={(event) =>
                            updateFilter(filter.id, {
                              value2: event.target.value,
                            })
                          }
                        />
                      </>
                    )}

                    {relative && (
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          color: "var(--text3)",
                          fontSize: 10,
                        }}
                      >
                        days
                        {filter.operator === "more_than_n_overdue"
                          ? " overdue"
                          : ""}
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    updateConfig({
                      filters: config.filters.filter(
                        (item) => item.id !== filter.id
                      ),
                    })
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text3)",
                    cursor: "pointer",
                    fontSize: 17,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}

          <div
            style={{
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <Button active onClick={addFilter}>
              + Add a filter
            </Button>

            {config.filters.length > 0 && (
              <Button
                onClick={() =>
                  updateConfig({ filters: [] })
                }
              >
                Clear filters
              </Button>
            )}
          </div>

          <div
            style={{
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text3)",
              marginBottom: 8,
            }}
          >
            Fields
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 9,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() =>
                updateConfig({
                  columns: fields.map((field) => field.key),
                })
              }
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text2)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Select all
            </button>

            <span style={{ color: "var(--text3)" }}>·</span>

            <button
              type="button"
              onClick={() =>
                updateConfig({ columns: [] })
              }
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text2)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Clear
            </button>

            <span style={{ color: "var(--text3)" }}>·</span>

            <button
              type="button"
              onClick={() =>
                updateConfig({
                  columns: fields
                    .filter((field) => field.default)
                    .map((field) => field.key),
                })
              }
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text2)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Defaults
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 6,
            }}
          >
            {fields.map((field) => {
              const checked = config.columns.includes(field.key);

              return (
                <label
                  key={field.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 8px",
                    borderRadius: 7,
                    background: checked
                      ? "rgba(232,180,92,.07)"
                      : "transparent",
                    color: "var(--body)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      updateConfig({
                        columns: checked
                          ? config.columns.filter(
                              (key) => key !== field.key
                            )
                          : [
                              ...config.columns,
                              field.key,
                            ],
                      })
                    }
                  />

                  {field.label}
                </label>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 8,
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--divider)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text3)",
                  marginBottom: 5,
                }}
              >
                Sort by
              </div>

              <Select
                value={config.sortField}
                onChange={(event) =>
                  updateConfig({
                    sortField: event.target.value,
                  })
                }
              >
                <option value="">No sorting</option>

                {fields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text3)",
                  marginBottom: 5,
                }}
              >
                Direction
              </div>

              <Select
                value={config.sortDirection}
                onChange={(event) =>
                  updateConfig({
                    sortDirection: event.target.value,
                  })
                }
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text3)",
                  marginBottom: 5,
                }}
              >
                Group by
              </div>

              <Select
                value={config.groupField}
                onChange={(event) =>
                  updateConfig({
                    groupField: event.target.value,
                  })
                }
              >
                <option value="">No grouping</option>

                {fields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 7,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text2)",
                }}
              >
                Preview · {filtered.length} match
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "var(--text3)",
                }}
              >
                First 5 records
              </div>
            </div>

            <div
              style={{
                overflowX: "auto",
                border: "1px solid var(--divider)",
                borderRadius: 9,
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 480,
                  borderCollapse: "collapse",
                  fontSize: 10,
                  color: "var(--body)",
                }}
              >
                <thead>
                  <tr>
                    {selectedFields.slice(0, 5).map((field) => (
                      <th
                        key={field.key}
                        style={{
                          textAlign: "left",
                          padding: 8,
                          borderBottom: "1px solid var(--divider)",
                          color: "var(--text2)",
                        }}
                      >
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filtered.slice(0, 5).map((row, index) => (
                    <tr key={row.id || index}>
                      {selectedFields.slice(0, 5).map((field) => (
                        <td
                          key={field.key}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid var(--divider)",
                            maxWidth: 220,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {typeof row[field.key] === "boolean"
                            ? row[field.key]
                              ? "Yes"
                              : "No"
                            : String(row[field.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ReportBuilder({
  tasks = [],
  goals = [],
  areas = {},
  journalEntries = [],
  onBack,
}) {
  const notes = useMemo(() => readNotes(), []);

  const definitions = useMemo(
    () =>
      normalizeDefinitions(
        makeDefinitions({
          tasks,
          goals,
          areas,
          journalEntries,
          notes,
        })
      ),
    [
      tasks,
      goals,
      areas,
      journalEntries,
      notes,
    ]
  );

  const [selectedSubjects, setSelectedSubjects] =
    useState(["tasks"]);

  const [configs, setConfigs] =
    useState(() => ({}));

  const [format, setFormat] =
    useState("xlsx");

  const [presetName, setPresetName] =
    useState("");

  const [presets, setPresets] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem("abide-report-presets-v2") || "[]"
        );
      } catch {
        return [];
      }
    });

  useEffect(() => {
    setConfigs((current) => {
      const next = { ...current };

      SUBJECTS.forEach((subject) => {
        if (!next[subject]) {
          next[subject] =
            defaultSectionConfig(definitions[subject]);
        }
      });

      return next;
    });
  }, [definitions]);

  useEffect(() => {
    localStorage.setItem(
      "abide-report-presets-v2",
      JSON.stringify(presets)
    );
  }, [presets]);

  const updateSubjectConfig = (subject, changes) => {
    setConfigs((current) => ({
      ...current,
      [subject]: {
        ...(
          current[subject] ||
          defaultSectionConfig(definitions[subject])
        ),
        ...changes,
      },
    }));
  };

  const toggleSubject = (subject) => {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  };

  const sections = useMemo(() => {
    return selectedSubjects.map((subject) => {
      const definition = definitions[subject];

      const config =
        configs[subject] ||
        defaultSectionConfig(definition);

      const fields = definition.fields.filter((field) =>
        config.columns.includes(field.key)
      );

      const rows = sortRows(
        applyFilters(
          definition.rows,
          config.filters,
          definition.fields
        ),
        config.sortField,
        config.sortDirection
      );

      return {
        key: subject,
        title: LABELS[subject],
        fields,
        rows,
        groupField: config.groupField,
      };
    });
  }, [
    selectedSubjects,
    definitions,
    configs,
  ]);

  const totalMatches =
    sections.reduce(
      (sum, section) =>
        sum + section.rows.length,
      0
    );

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;

    setPresets((current) => [
      {
        id: `${Date.now()}`,
        name,
        selectedSubjects,
        configs,
        format,
      },
      ...current,
    ]);

    setPresetName("");
  };

  const loadPreset = (preset) => {
    setSelectedSubjects(
      preset.selectedSubjects || ["tasks"]
    );

    setConfigs(
      preset.configs || {}
    );

    setFormat(
      preset.format || "xlsx"
    );
  };

  const deletePreset = (id) => {
    setPresets((current) =>
      current.filter((preset) =>
        preset.id !== id
      )
    );
  };

  const exportCsv = () => {
    if (sections.length !== 1) return;

    const section = sections[0];

    download(
      `abide-${section.key}-${dateKey()}.csv`,
      toCsv(section.rows, section.fields),
      "text/csv"
    );
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();

    sections.forEach((section) => {
      const rows = section.rows.map((row) =>
        Object.fromEntries(
          section.fields.map((field) => [
            field.label,
            row[field.key],
          ])
        )
      );

      const sheet =
        XLSX.utils.json_to_sheet(rows);

      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        section.title.slice(0, 31)
      );
    });

    XLSX.writeFile(
      workbook,
      `abide-report-${dateKey()}.xlsx`
    );
  };

  const exportWord = async () => {
    const {
      Document,
      Packer,
      Paragraph,
      HeadingLevel,
    } = await import("docx");

    const children = [
      new Paragraph({
        text: "Abide Report",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        text: `Generated ${new Date().toLocaleString()}`,
      }),
    ];

    sections.forEach((section) => {
      children.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_2,
        })
      );

      const groups = section.groupField
        ? groupRows(
            section.rows,
            section.groupField
          )
        : [
            {
              label: "",
              rows: section.rows,
            },
          ];

      groups.forEach((group) => {
        if (group.label) {
          children.push(
            new Paragraph({
              text: group.label,
              heading: HeadingLevel.HEADING_3,
            })
          );
        }

        group.rows.forEach((row) => {
          children.push(
            new Paragraph({
              text: section.fields
                .map(
                  (field) =>
                    `${field.label}: ${row[field.key] ?? ""}`
                )
                .join(" · "),
            })
          );
        });
      });
    });

    const document = new Document({
      sections: [{ children }],
    });

    const blob =
      await Packer.toBlob(document);

    download(
      `abide-report-${dateKey()}.docx`,
      blob,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  };

  const exportPdf = async () => {
    const { jsPDF } =
      await import("jspdf");

    const doc = new jsPDF();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    let y = 18;

    const ensure = (height = 10) => {
      if (y + height > pageHeight - 15) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFontSize(18);
    doc.text("Abide Report", 18, y);
    y += 9;

    doc.setFontSize(8);
    doc.text(
      `Generated ${new Date().toLocaleString()}`,
      18,
      y
    );
    y += 11;

    sections.forEach((section) => {
      ensure(12);
      doc.setFontSize(14);
      doc.text(section.title, 18, y);
      y += 8;

      const groups = section.groupField
        ? groupRows(
            section.rows,
            section.groupField
          )
        : [
            {
              label: "",
              rows: section.rows,
            },
          ];

      groups.forEach((group) => {
        if (group.label) {
          ensure(9);
          doc.setFontSize(11);
          doc.text(group.label, 18, y);
          y += 6;
        }

        group.rows.forEach((row) => {
          const text = section.fields
            .map(
              (field) =>
                `${field.label}: ${row[field.key] ?? ""}`
            )
            .join(" | ");

          const lines =
            doc.splitTextToSize(text, 175);

          ensure(lines.length * 4.3 + 3);

          doc.setFontSize(8.5);
          doc.text(lines, 18, y);

          y += lines.length * 4.3 + 3;
        });

        y += 2;
      });

      y += 4;
    });

    doc.save(
      `abide-report-${dateKey()}.pdf`
    );
  };

  const exportZip = async () => {
    const JSZipModule =
      await import("jszip");

    const JSZip =
      JSZipModule.default ||
      JSZipModule;

    const zip = new JSZip();

    sections.forEach((section) => {
      zip.file(
        `${section.title}.csv`,
        toCsv(section.rows, section.fields)
      );
    });

    zip.file(
      "Report Configuration.json",
      JSON.stringify(
        {
          exportedAt:
            new Date().toISOString(),
          selectedSubjects,
          configs,
          totalMatches,
        },
        null,
        2
      )
    );

    zip.file(
      "Abide Report Data.json",
      JSON.stringify(
        Object.fromEntries(
          sections.map((section) => [
            section.key,
            section.rows,
          ])
        ),
        null,
        2
      )
    );

    const blob =
      await zip.generateAsync({
        type: "blob",
      });

    download(
      `abide-report-${dateKey()}.zip`,
      blob,
      "application/zip"
    );
  };

  const generate = async () => {
    if (!selectedSubjects.length) return;
    if (format === "csv") return exportCsv();
    if (format === "xlsx") return exportExcel();
    if (format === "docx") return exportWord();
    if (format === "pdf") return exportPdf();
    return exportZip();
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        paddingBottom: 100,
      }}
    >
      <div
        style={{
          padding: "18px 18px 12px",
          borderBottom: "1px solid var(--divider)",
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text3)",
            padding: 0,
            marginBottom: 11,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← Export Center
        </button>

        <div
          style={{
            fontSize: 9.5,
            letterSpacing: 1.1,
            textTransform: "uppercase",
            color: "#E8B45C",
          }}
        >
          Data & Reporting
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: 24,
            fontWeight: 780,
            color: "var(--text)",
          }}
        >
          Report Builder
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 11.5,
            color: "var(--text3)",
            lineHeight: 1.5,
          }}
        >
          Combine as many parts of Abide as you want in one report.
          Every selected section gets its own filters, fields, sorting,
          grouping, and preview.
        </div>
      </div>

      <div
        style={{
          padding: "0 16px",
          maxWidth: 1050,
          margin: "0 auto",
        }}
      >
        {presets.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 9.5,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "var(--text3)",
                marginBottom: 7,
              }}
            >
              Saved Reports
            </div>

            <div
              style={{
                display: "flex",
                gap: 7,
                overflowX: "auto",
                paddingBottom: 4,
              }}
            >
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    border: "1px solid var(--divider)",
                    borderRadius: 9,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      loadPreset(preset)
                    }
                    style={{
                      border: "none",
                      background: "var(--pillBg)",
                      color: "var(--text2)",
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {preset.name}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deletePreset(preset.id)
                    }
                    style={{
                      border: "none",
                      borderLeft:
                        "1px solid var(--divider)",
                      background: "var(--pillBg)",
                      color: "var(--text3)",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Card>
          <div
            style={{
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text3)",
            }}
          >
            Step 1
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 760,
              color: "var(--text)",
              marginTop: 3,
            }}
          >
            What would you like a report on?
          </div>

          <div
            style={{
              fontSize: 10.5,
              color: "var(--text3)",
              marginTop: 4,
              marginBottom: 11,
            }}
          >
            Choose one, several, or all sections.
          </div>

          <div
            style={{
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            {SUBJECTS.map((subject) => {
              const active =
                selectedSubjects.includes(subject);

              return (
                <Button
                  key={subject}
                  active={active}
                  onClick={() =>
                    toggleSubject(subject)
                  }
                >
                  {active ? "✓ " : ""}
                  {LABELS[subject]}
                </Button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 11,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setSelectedSubjects([...SUBJECTS])
              }
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text2)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Select all
            </button>

            <span style={{ color: "var(--text3)" }}>
              ·
            </span>

            <button
              type="button"
              onClick={() =>
                setSelectedSubjects([])
              }
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text2)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Clear
            </button>

            <span
              style={{
                marginLeft: "auto",
                color: "var(--text3)",
                fontSize: 10.5,
              }}
            >
              {selectedSubjects.length} of {SUBJECTS.length} selected
            </span>
          </div>
        </Card>

        {selectedSubjects.length > 0 && (
          <>
            <div
              style={{
                fontSize: 9.5,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "var(--text3)",
                margin: "16px 3px 8px",
              }}
            >
              Step 2 · Customize each section
            </div>

            {selectedSubjects.map((subject) => (
              <SectionEditor
                key={subject}
                subject={subject}
                definition={definitions[subject]}
                config={
                  configs[subject] ||
                  defaultSectionConfig(
                    definitions[subject]
                  )
                }
                updateConfig={(changes) =>
                  updateSubjectConfig(
                    subject,
                    changes
                  )
                }
              />
            ))}
          </>
        )}

        <Card>
          <div
            style={{
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text3)",
            }}
          >
            Step 3
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 760,
              color: "var(--text)",
              marginTop: 3,
            }}
          >
            Save or download
          </div>

          <div
            style={{
              marginTop: 10,
              padding: 11,
              border: "1px solid var(--divider)",
              borderRadius: 9,
              background: "var(--subtleBg)",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 760,
                color: "var(--text)",
              }}
            >
              {totalMatches} total matching records
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 10.5,
                color: "var(--text3)",
              }}
            >
              {sections
                .map(
                  (section) =>
                    `${section.title}: ${section.rows.length}`
                )
                .join(" · ") ||
                "Choose at least one section"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0,1fr) auto",
              gap: 7,
              marginTop: 12,
            }}
          >
            <Input
              value={presetName}
              placeholder="Preset name — e.g. Margin Launch Report"
              onChange={(event) =>
                setPresetName(event.target.value)
              }
            />

            <Button onClick={savePreset}>
              Save preset
            </Button>
          </div>

          <div
            style={{
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text3)",
              marginTop: 14,
              marginBottom: 7,
            }}
          >
            File format
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(120px,1fr))",
              gap: 7,
            }}
          >
            {[
              ["csv", "CSV", "Single section only"],
              ["xlsx", "Excel", "One sheet per section"],
              ["docx", "Word", "Combined document"],
              ["pdf", "PDF", "Combined report"],
              ["zip", "ZIP Bundle", "CSVs + JSON"],
            ].map(([key, label, description]) => {
              const disabled =
                key === "csv" &&
                selectedSubjects.length !== 1;

              return (
                <button
                  type="button"
                  key={key}
                  disabled={disabled}
                  onClick={() =>
                    !disabled &&
                    setFormat(key)
                  }
                  style={{
                    textAlign: "left",
                    border:
                      format === key
                        ? "1px solid #E8B45C"
                        : "1px solid var(--divider)",
                    background:
                      format === key
                        ? "rgba(232,180,92,.08)"
                        : "var(--subtleBg)",
                    borderRadius: 10,
                    padding: 11,
                    opacity: disabled ? .4 : 1,
                    cursor: disabled
                      ? "not-allowed"
                      : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color:
                        format === key
                          ? "#E8B45C"
                          : "var(--text)",
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 9.5,
                      color: "var(--text3)",
                    }}
                  >
                    {description}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={
              !selectedSubjects.length ||
              sections.some(
                (section) =>
                  !section.fields.length
              )
            }
            style={{
              width: "100%",
              marginTop: 14,
              border: "none",
              background: "#E8B45C",
              color: "#1A160F",
              borderRadius: 10,
              padding: "12px 14px",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: 780,
              cursor: "pointer",
              opacity:
                !selectedSubjects.length ||
                sections.some(
                  (section) =>
                    !section.fields.length
                )
                  ? .45
                  : 1,
            }}
          >
            Generate combined report
          </button>
        </Card>
      </div>
    </div>
  );
}
