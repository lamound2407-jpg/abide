import React, { useMemo, useRef, useState } from "react";

function normalizePriority(value) {
  const p = String(value || "med").trim().toLowerCase();
  if (p === "medium") return "med";
  return ["high", "med", "low"].includes(p) ? p : "med";
}

function normalizeTask(raw, index) {
  const title = String(raw?.title || "").trim();
  const dueDate = String(raw?.dueDate || raw?.due || "").trim();
  const errors = [];
  if (!title) errors.push(`Task ${index + 1}: title is required.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.push(`${title || `Task ${index + 1}`}: dueDate must be YYYY-MM-DD.`);

  const subtasks = (Array.isArray(raw?.subtasks) ? raw.subtasks : []).map((item, subIndex) => {
    if (typeof item === "string") return { id: `import_sub_${Date.now()}_${index}_${subIndex}`, label: item.trim(), done: false };
    return {
      id: item?.id || `import_sub_${Date.now()}_${index}_${subIndex}`,
      label: String(item?.label || item?.title || "").trim(),
      done: Boolean(item?.done),
    };
  }).filter((x) => x.label);

  return {
    errors,
    task: {
      title,
      dueDate,
      dueTime: raw?.dueTime || null,
      priority: normalizePriority(raw?.priority),
      areaName: String(raw?.area || raw?.areaName || "").trim(),
      notes: String(raw?.notes || "").trim(),
      subtasks,
      reminder: raw?.reminder || "None",
      status: raw?.status || "next",
    },
  };
}

function parseJson(text) {
  try {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : parsed?.tasks;
    if (!Array.isArray(list)) return { tasks: [], errors: ["JSON must contain a tasks array."] };
    const tasks = [];
    const errors = [];
    list.forEach((item, index) => {
      const normalized = normalizeTask(item, index);
      errors.push(...normalized.errors);
      if (!normalized.errors.length) tasks.push(normalized.task);
    });
    return { tasks, errors };
  } catch {
    return { tasks: [], errors: ["That file is not valid JSON."] };
  }
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return { tasks: [], errors: ["CSV needs a header row and at least one task."] };
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const get = (row, ...names) => {
    const index = headers.findIndex((h) => names.includes(h));
    return index >= 0 ? row[index] || "" : "";
  };
  const tasks = [];
  const errors = [];
  rows.slice(1).forEach((row, index) => {
    const normalized = normalizeTask({
      title: get(row, "title", "task"),
      dueDate: get(row, "duedate", "due"),
      dueTime: get(row, "duetime", "time"),
      priority: get(row, "priority"),
      area: get(row, "area"),
      notes: get(row, "notes"),
      reminder: get(row, "reminder"),
      status: get(row, "status"),
      subtasks: get(row, "subtasks") ? get(row, "subtasks").split("|").map((x) => x.trim()).filter(Boolean) : [],
    }, index);
    errors.push(...normalized.errors);
    if (!normalized.errors.length) tasks.push(normalized.task);
  });
  return { tasks, errors };
}

function findAreaId(areas, name) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return "";
  return Object.entries(areas).find(([, area]) => String(area?.name || "").trim().toLowerCase() === wanted)?.[0] || "";
}

function formatDate(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(d.getTime()) ? dateKey : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dueLabel(dateKey, time) {
  if (time) {
    const [h, m] = String(time).split(":").map(Number);
    const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return formatDate(dateKey);
}

export default function ImportTasksPanel({ areas, onCreateArea, onCreateTask, onClose }) {
  const [mode, setMode] = useState("file");
  const [kind, setKind] = useState("json");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);

  const parsed = useMemo(() => {
    if (!rawText.trim()) return { tasks: [], errors: [] };
    return kind === "csv" ? parseCsv(rawText) : parseJson(rawText);
  }, [rawText, kind]);

  const dates = parsed.tasks.map((t) => t.dueDate).sort();
  const areaNames = [...new Set(parsed.tasks.map((t) => t.areaName).filter(Boolean))];
  const high = parsed.tasks.filter((t) => t.priority === "high").length;
  const med = parsed.tasks.filter((t) => t.priority === "med").length;
  const low = parsed.tasks.filter((t) => t.priority === "low").length;

  const readFile = async (file) => {
    if (!file) return;
    setKind(file.name.toLowerCase().endsWith(".csv") ? "csv" : "json");
    setFileName(file.name);
    setMessage("");
    try { setRawText(await file.text()); }
    catch { setMessage("Abide could not read that file."); }
  };

  const importTasks = () => {
    if (!parsed.tasks.length || parsed.errors.length) {
      setMessage(parsed.errors[0] || "No valid tasks found.");
      return;
    }
    const createdAreas = {};
    parsed.tasks.forEach((item) => {
      let areaId = findAreaId(areas, item.areaName);
      if (!areaId && item.areaName && onCreateArea) {
        const key = item.areaName.toLowerCase();
        if (!createdAreas[key]) createdAreas[key] = onCreateArea({ name: item.areaName, color: "#7C93C9" });
        areaId = createdAreas[key];
      }
      onCreateTask({
        title: item.title,
        dueDate: item.dueDate,
        dueTime: item.dueTime || null,
        due: dueLabel(item.dueDate, item.dueTime),
        priority: item.priority,
        area: areaId || null,
        goal: null,
        notes: item.notes,
        activities: [],
        repeat: null,
        recurrence: null,
        reminder: item.reminder,
        subtasks: item.subtasks,
        done: false,
        status: item.status,
        bypassProtected: false,
      });
    });
    onClose();
  };

  return (
    <div className="card composer-card">
      <div className="segmented" style={{ margin: "0 0 12px 0" }}>
        <div className={`seg-btn ${mode === "file" ? "active" : ""}`} onClick={() => setMode("file")}>Upload File</div>
        <div className={`seg-btn ${mode === "paste" ? "active" : ""}`} onClick={() => setMode("paste")}>Paste</div>
      </div>

      {mode === "file" ? <>
        <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" style={{ display: "none" }} onChange={(e) => readFile(e.target.files?.[0])} />
        <div className="import-drop" onClick={() => fileRef.current?.click()}>
          <div className="import-drop-title">{fileName || "Choose an Abide JSON or CSV file"}</div>
          <div className="import-drop-copy">JSON is best for AI-created plans because it preserves notes and subtasks. CSV is supported for spreadsheets.</div>
        </div>
      </> : <>
        <div className="filter-row" style={{ padding: "0 0 8px" }}>
          <div className={`filter-chip ${kind === "json" ? "active" : ""}`} onClick={() => setKind("json")}>JSON</div>
          <div className={`filter-chip ${kind === "csv" ? "active" : ""}`} onClick={() => setKind("csv")}>CSV</div>
        </div>
        <textarea className="import-textarea" value={rawText} onChange={(e) => { setRawText(e.target.value); setMessage(""); }} placeholder={kind === "json" ? '{"format":"abide-task-import","version":1,"tasks":[...]}' : 'Title,Due Date,Priority,Area,Notes'} />
      </>}

      {(rawText.trim() || message) && <div className="import-summary">
        <div style={{ fontSize: 13, fontWeight: 750, color: parsed.errors.length ? "#E68080" : "var(--text)" }}>
          {parsed.errors.length ? `${parsed.errors.length} issue${parsed.errors.length === 1 ? "" : "s"} to fix` : `${parsed.tasks.length} task${parsed.tasks.length === 1 ? "" : "s"} ready`}
        </div>
        {!parsed.errors.length && parsed.tasks.length > 0 && <>
          <div className="import-stat-row">
            <span className="chip" style={{ background: "#E8B45C22", color: "#E8B45C" }}>{high} high</span>
            <span className="chip" style={{ background: "#7C93C922", color: "#7C93C9" }}>{med} medium</span>
            <span className="chip" style={{ background: "#8FA88A22", color: "#8FA88A" }}>{low} low</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>{dates.length ? `${formatDate(dates[0])} → ${formatDate(dates[dates.length - 1])}` : "No dates"}{areaNames.length ? ` · ${areaNames.join(", ")}` : ""}</div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 5 }}>Nothing is created until you tap Import Tasks.</div>
        </>}
        {parsed.errors.slice(0, 4).map((error, index) => <div className="import-error" key={index}>{error}</div>)}
        {message && <div className="import-error">{message}</div>}
      </div>}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div className="filter-chip active" style={{ flex: 1, justifyContent: "center", opacity: parsed.tasks.length && !parsed.errors.length ? 1 : .5 }} onClick={importTasks}>Import {parsed.tasks.length || ""} Tasks</div>
        <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</div>
      </div>
    </div>
  );
}
