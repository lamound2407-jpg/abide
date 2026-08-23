#!/usr/bin/env python3
from pathlib import Path
import re
import shutil

ROOT = Path.cwd()
APP = ROOT / "src" / "App.jsx"
ARCH = ROOT / "ARCHITECTURE.md"

if not APP.exists():
    raise SystemExit("Run this from the root of the Abide repo (the folder containing src/App.jsx).")
if not ARCH.exists():
    raise SystemExit("ARCHITECTURE.md was not found. Abide's architecture file is required before this upgrade.")

app = APP.read_text()
arch = ARCH.read_text()

required_markers = [
    "function EventEditor({ event, areas, onSave, onCancel })",
    "function CalendarsPanel({ accounts, setAccounts, configured, onConnect, onRefresh, onDisconnect, onToggleCalendar, error })",
    "function InsightsTab(",
    'const tabs = [',
    '{tab === "insights" && <InsightsTab',
]
missing = [m for m in required_markers if m not in app]
if missing:
    raise SystemExit("The current App.jsx does not match the expected Abide version. Missing: " + ", ".join(missing))

shutil.copy2(APP, APP.with_suffix(".jsx.before-review-upgrade"))
shutil.copy2(ARCH, ARCH.with_suffix(".md.before-review-upgrade"))

sidebar_anchor = '''function Sidebar({ tabs, tab, setTab, viewport, theme, setTheme }) {'''
if "const MORE_TAB_IDS" not in app:
    app = app.replace(
        sidebar_anchor,
        '''const MORE_TAB_IDS = new Set(["goals", "scratch", "reminders", "insights"]);

function navTabIsActive(currentTab, itemId) {
  return currentTab === itemId || (itemId === "more" && MORE_TAB_IDS.has(currentTab));
}

''' + sidebar_anchor,
        1
    )

app = app.replace(
    '''          const active = tab === t.id;''',
    '''          const active = navTabIsActive(tab, t.id);''',
    1
)
app = app.replace(
    '''{tabs.map((t) => { const Icon = t.icon; const active = tab === t.id; return <div key={t.id} className={`tab ${active ? "active" : ""}`}''',
    '''{tabs.map((t) => { const Icon = t.icon; const active = navTabIsActive(tab, t.id); return <div key={t.id} className={`tab ${active ? "active" : ""}`}''',
    1
)

review_css_anchor = '''  .review-count { background:rgba(232,180,92,0.18); color:#E8B45C; font-weight:700; font-size:12px; padding:2px 9px; border-radius:8px; }
'''
review_css = review_css_anchor + r'''
  .review-hero { padding:16px; margin:10px 0 14px; }
  .review-kicker { font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#E8B45C; }
  .review-hero-title { font-size:21px; font-weight:750; letter-spacing:-0.25px; color:var(--text); margin-top:5px; }
  .review-hero-copy { font-size:13px; line-height:1.55; color:var(--body); margin-top:6px; }
  .review-progress { height:6px; border-radius:999px; background:var(--track); overflow:hidden; margin-top:13px; }
  .review-progress-fill { height:100%; border-radius:999px; background:#E8B45C; transition:width .2s ease; }
  .review-step-card { padding:16px; margin-bottom:12px; }
  .review-phase { font-size:10.5px; font-weight:800; letter-spacing:.9px; text-transform:uppercase; color:#8FA88A; }
  .review-step-title { font-size:18px; font-weight:750; color:var(--text); margin-top:4px; }
  .review-step-copy { font-size:13px; line-height:1.55; color:var(--body); margin-top:7px; }
  .review-check { display:flex; align-items:flex-start; gap:10px; padding:11px 0; border-bottom:1px solid var(--divider); cursor:pointer; }
  .review-check:last-child { border-bottom:none; }
  .review-check-dot { width:21px; height:21px; border-radius:50%; border:1.5px solid var(--text3); flex-shrink:0; display:flex; align-items:center; justify-content:center; margin-top:1px; }
  .review-check.done .review-check-dot { background:#E8B45C; border-color:#E8B45C; }
  .review-check-text { font-size:13.5px; line-height:1.4; color:var(--body2); }
  .review-check.done .review-check-text { color:var(--text3); text-decoration:line-through; }
  .review-note { width:100%; min-height:88px; background:var(--inputBg); border:1px solid var(--inputBorder); border-radius:12px; padding:11px 12px; color:var(--text); font:inherit; font-size:13.5px; line-height:1.5; resize:vertical; outline:none; }
  .review-focus-grid { display:grid; gap:8px; margin-top:8px; }
  .review-focus-input { width:100%; background:var(--inputBg); border:1px solid var(--inputBorder); border-radius:10px; padding:10px 12px; color:var(--text); font:inherit; font-size:13.5px; }
  .review-nav { display:flex; gap:8px; margin:12px 0 18px; }
  .review-nav .filter-chip { flex:1; justify-content:center; min-height:38px; }
  .review-shortcuts { display:flex; gap:7px; flex-wrap:wrap; margin-top:10px; }
  .review-history-row { padding:12px 14px; border-bottom:1px solid var(--divider); }
  .review-history-row:last-child { border-bottom:none; }
  .review-history-title { font-size:13.5px; font-weight:650; color:var(--text); }
  .review-history-meta { font-size:11.5px; color:var(--text3); margin-top:3px; }
  .more-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
  .more-card { padding:15px; min-height:104px; cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; }
  .more-card-title { font-size:14px; font-weight:700; color:var(--text); margin-top:12px; }
  .more-card-copy { font-size:11.5px; line-height:1.4; color:var(--text3); margin-top:3px; }
'''
if ".review-hero {" not in app:
    app = app.replace(review_css_anchor, review_css, 1)

new_event_editor = r'''function EventEditor({ event, areas, onSave, onCancel }) {
  const modalRef = useRef(null);
  const isGoogle = event.source === "google";
  const [title, setTitle] = useState(event.title || "");
  const [date, setDate] = useState(event.date || REFERENCE_DATE_KEY);
  const [area, setArea] = useState(event.area && areas[event.area] ? event.area : "");
  const [activities, setActivities] = useState(() => normalizeActivity(event));
  const [activityDraft, setActivityDraft] = useState("");

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      if (modalRef.current) {
        modalRef.current.scrollTop = 0;
        modalRef.current.scrollLeft = 0;
      }
      window.scrollTo(0, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, []);

  const addActivity = () => {
    if (!activityDraft.trim()) return;
    setActivities((p) => [...p, { id: `act_${Date.now()}`, text: activityDraft.trim(), createdAt: new Date().toISOString() }]);
    setActivityDraft("");
  };

  const save = () => {
    const nextTitle = isGoogle ? event.title : title.trim();
    if (!nextTitle) return;
    onSave({
      ...event,
      title: nextTitle,
      date: isGoogle ? event.date : date,
      area: isGoogle ? event.area : (area || null),
      notes: "",
      activities,
    });
  };

  return createPortal(
    <div ref={modalRef} className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="task-editor-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="editor-shell">
          <div className="editor-header">
            <div>
              <div className="editor-title">Edit Event</div>
              {isGoogle && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>Google details are read-only. Abide activity stays editable.</div>}
            </div>
            <div className="editor-close" onClick={onCancel}><X size={17} /></div>
          </div>

          <div className="editor-scroll">
            <div className="fb-label">Event</div>
            <input className="input-line" style={{ marginTop: 0 }} value={title} disabled={isGoogle} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />

            {isGoogle ? (
              <div className="card" style={{ padding: 12, marginTop: 10 }}>
                <div className="field-row"><span className="field-label">Date</span><span className="field-value">{event.date ? formatDateLabel(event.date) : "No date"}</span></div>
                <div className="field-row"><span className="field-label">Time</span><span className="field-value">{event.time || "All day"}</span></div>
                <div className="field-row"><span className="field-label">Calendar</span><span className="field-value">{event.calendarLabel || "Google Calendar"}</span></div>
              </div>
            ) : (
              <>
                <div className="fb-label">Date</div>
                <input type="date" className="input-line" style={{ marginTop: 0 }} value={date} onChange={(e) => setDate(e.target.value)} />
                <div className="fb-label">Area</div>
                <QuickAreaPicker areas={areas} value={area} onChange={setArea} />
              </>
            )}

            <div className="fb-label">Activity</div>
            <div className="activity-list">
              {activities.length ? activities.map((a) => (
                <div className="activity-item" key={a.id}>
                  <div className="activity-time">{activityTimeLabel(a.createdAt)}</div>
                  <div className="activity-text">{a.text}</div>
                </div>
              )) : <div style={{ fontSize: 12, color: "var(--text3)" }}>No activity yet.</div>}
            </div>
            <div className="activity-compose">
              <textarea className="notes-box" rows={2} value={activityDraft} onChange={(e) => setActivityDraft(e.target.value)} placeholder="Add an update or comment…" />
              <div className="filter-chip active" onClick={addActivity}>Add</div>
            </div>
          </div>

          <div className="editor-footer">
            <div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={save}>Save Changes</div>
            <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

'''
app, count = re.subn(
    r'function EventEditor\(\{ event, areas, onSave, onCancel \}\) \{.*?\n\}\n\n(?=function CalendarsPanel)',
    new_event_editor,
    app,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit("Could not replace EventEditor safely.")

app = app.replace(
    'function CalendarsPanel({ accounts, setAccounts, configured, onConnect, onRefresh, onDisconnect, onToggleCalendar, error }) {',
    'function CalendarsPanel({ accounts, setAccounts, configured, onConnect, onRefresh, onDisconnect, onToggleCalendar, onRenameAccount, error }) {',
    1
)

old_account_header = '''              <div className="cal-account-title">{account.label || account.id}</div>
              <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>{account.calendars?.length || 0} calendar{account.calendars?.length === 1 ? "" : "s"}</div>'''
new_account_header = '''              <div className="cal-account-title" style={{ display: "flex", alignItems: "center", gap: 7 }}>{account.displayName || "Google Account"}<Pencil size={12} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => onRenameAccount?.(account.id)} /></div>
              <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>{account.calendars?.length || 0} calendar{account.calendars?.length === 1 ? "" : "s"} · email hidden</div>'''
app = app.replace(old_account_header, new_account_header, 1)

toggle_anchor = '''  const toggleGoogleCalendar = (accountId, calendarId) => {'''
if "const renameGoogleAccount" not in app:
    app = app.replace(
        toggle_anchor,
        '''  const renameGoogleAccount = (accountId) => {
    const account = googleAccounts.find((a) => a.id === accountId);
    const next = window.prompt("Name this Google account in Abide (for example, Personal or Work):", account?.displayName || "Google Account");
    if (!next?.trim()) return;
    setGoogleAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, displayName: next.trim() } : a));
  };

''' + toggle_anchor,
        1
    )

app = app.replace(
    '''      const accountLabel = primary.id;
      const existingAccount = googleAccounts.find((a) => a.id === accountId);''',
    '''      const accountLabel = primary.id;
      const existingAccount = googleAccounts.find((a) => a.id === accountId);
      const displayName = existingAccount?.displayName || `Google Account ${Math.max(1, googleAccounts.filter((a) => a.id !== "legacy").length + (existingAccount ? 0 : 1))}`;''',
    1
)
app = app.replace(
    '''        const nextAccount = { id: accountId, label: accountLabel, token, calendars: nextCalendars };''',
    '''        const nextAccount = { id: accountId, label: accountLabel, displayName, token, calendars: nextCalendars };''',
    1
)
app = app.replace(
    '''onDisconnect={disconnectGoogleAccount} onToggleCalendar={toggleGoogleCalendar} error={googleError} />''',
    '''onDisconnect={disconnectGoogleAccount} onToggleCalendar={toggleGoogleCalendar} onRenameAccount={renameGoogleAccount} error={googleError} />''',
    1
)
app = app.replace(
    '''{e.source === "google" ? `${e.calendarLabel || "Google Calendar"}${e.accountLabel ? ` · ${e.accountLabel}` : ""}` : "Abide"}''',
    '''{e.source === "google" ? (e.calendarLabel || "Google Calendar") : "Abide"}''',
    1
)
app = app.replace(
    '''>{account.label || account.id}</div>)}</div></>}''',
    '''>{account.displayName || "Google Account"}</div>)}</div></>}''',
    1
)
app = app.replace(
    '''googleAccounts.find((a) => a.id === targetGoogleAccountId)?.label || "the selected Google account"''',
    '''googleAccounts.find((a) => a.id === targetGoogleAccountId)?.displayName || "the selected Google account"''',
    1
)
app = app.replace(
    '''setGoogleError(`${targetAccount.label} authorization expired. Reconnect it and try again.`);''',
    '''setGoogleError(`${targetAccount.displayName || "Google account"} authorization expired. Reconnect it and try again.`);''',
    1
)
app = app.replace(
    '''setGoogleError(`The event could not be added to ${targetAccount.label}.`);''',
    '''setGoogleError(`The event could not be added to ${targetAccount.displayName || "the selected Google account"}.`);''',
    1
)

review_components = r'''
const WEEKLY_REVIEW_BLUEPRINT = [
  {
    phase: "Arrive",
    title: "Become present before you plan",
    copy: "Start from peace, not pressure. This review is here to make the system trustworthy and the coming week humane.",
    checks: ["Close the other tabs and distractions you can", "Name what is carrying the most mental weight", "Decide that the goal is clarity, not squeezing more into the week"],
    noteLabel: "What am I carrying into this review?",
  },
  {
    phase: "Get Clear",
    title: "Gather every open loop",
    copy: "Use GTD's first movement: collect, process, and empty your head so nothing has to keep shouting for attention.",
    checks: ["Collect loose notes, messages, papers, and stray commitments", "Process your capture points and inboxes", "Do a mind sweep for uncaptured tasks, waiting-fors, and ideas"],
    noteLabel: "Loose ends or things I still need to capture",
    shortcut: "today",
    shortcutLabel: "Open Today",
  },
  {
    phase: "Get Current",
    title: "Bring the system back to reality",
    copy: "Review what actually happened, what is coming, and whether every active outcome has a real next action.",
    checks: ["Review the previous week for follow-ups you missed", "Review the next two weeks of calendar commitments", "Review open tasks, waiting-fors, goals, and larger outcomes", "Make sure each active goal or project has a next action"],
    noteLabel: "What needs to change because reality changed?",
    shortcut: "calendar",
    shortcutLabel: "Open Calendar",
  },
  {
    phase: "Protect the Pace",
    title: "Make room before adding more",
    copy: "An unhurried week needs constraints. Protect worship, rest, relationships, deep work, and ordinary margin before filling the remaining space.",
    checks: ["Confirm your protected time and Sabbath/rest rhythm", "Look for back-to-back days or overloaded stretches", "Leave buffer around high-energy commitments", "Choose what will not be done this week"],
    noteLabel: "What do I need to protect or say no to?",
  },
  {
    phase: "Get Creative",
    title: "Look beyond urgency",
    copy: "Now that the system is clear, let quieter ideas surface. Revisit Someday/Maybe and anything that deserves fresh imagination.",
    checks: ["Review Someday / Maybe", "Notice ideas that now feel timely", "Delete or defer things that no longer belong"],
    noteLabel: "Ideas, possibilities, or courageous next moves",
  },
  {
    phase: "Commit",
    title: "Choose a small, faithful week",
    copy: "Name the few outcomes that would make this week meaningful. They are guideposts, not a quota.",
    checks: ["My calendar and task list agree", "My protected rhythms are visible", "I know the few things that matter most", "I can enter the week without carrying the whole system in my head"],
    noteLabel: "One sentence for the kind of week I want to live",
    focusLabel: "Three weekly outcomes at most",
    complete: true,
  },
];

const MONTHLY_REVIEW_BLUEPRINT = [
  {
    phase: "Arrive",
    title: "Look at the month without judgment",
    copy: "Monthly planning is not a performance review. It is a wider horizon for noticing what is forming you and what is crowding your life.",
    checks: ["Slow down enough to tell the truth about the month", "Notice gratitude, grief, energy, and fatigue", "Separate what was important from what was merely loud"],
    noteLabel: "What stands out as I look back?",
  },
  {
    phase: "Clear",
    title: "Close loops that should not cross months",
    copy: "Sweep the system for stale commitments, lingering waiting-fors, and unfinished work that needs a conscious decision.",
    checks: ["Review overdue and unassigned tasks", "Review waiting-fors and follow-ups", "Archive, defer, delegate, or recommit stale items"],
    noteLabel: "What needs a decision before I move forward?",
    shortcut: "today",
    shortcutLabel: "Open Today",
  },
  {
    phase: "Horizons",
    title: "Review goals, areas, and responsibilities",
    copy: "GTD's higher horizons keep the month connected to the life you are actually trying to live, not just the next deadline.",
    checks: ["Review each active goal and its next meaningful milestone", "Review each Area for imbalance or neglect", "Pause anything that is no longer active"],
    noteLabel: "What needs more or less attention next month?",
    shortcut: "goals",
    shortcutLabel: "Open Goals",
  },
  {
    phase: "Look Ahead",
    title: "Scan the next four to six weeks",
    copy: "The calendar is the hard landscape. See travel, deadlines, events, preparation, and recovery needs early enough to respond calmly.",
    checks: ["Review the next 4–6 weeks of calendar commitments", "Capture preparation work triggered by those commitments", "Notice weeks that need extra margin or recovery"],
    noteLabel: "What is coming that I should prepare for now?",
    shortcut: "calendar",
    shortcutLabel: "Open Calendar",
  },
  {
    phase: "Rule of Life",
    title: "Protect the rhythms that make life livable",
    copy: "Practicing the Way frames a Rule of Life as daily, weekly, and monthly rhythms that create space for formation. Plan those rhythms before optional volume.",
    checks: ["Review daily rhythms that need attention", "Review weekly Sabbath, community, prayer, and rest rhythms", "Review monthly relational, spiritual, and restorative rhythms", "Adjust protected time blocks where the season has changed"],
    noteLabel: "Which rhythm most needs protection this month?",
  },
  {
    phase: "Subtract",
    title: "Decide what not to carry",
    copy: "A month becomes unhurried by subtraction as much as organization. Make conscious room for what matters.",
    checks: ["Name one commitment to stop, pause, or decline", "Name one thing to simplify or delegate", "Leave unscheduled margin instead of filling every open space"],
    noteLabel: "What am I intentionally not doing?",
  },
  {
    phase: "Focus",
    title: "Choose the month's few meaningful outcomes",
    copy: "Choose up to three outcomes that deserve disproportionate attention. Everything important does not have to become a monthly priority.",
    checks: ["These outcomes reflect my real responsibilities and season", "There is enough space to pursue them without chronic hurry", "Each outcome has a concrete next action"],
    noteLabel: "What would make this month feel faithful and well-lived?",
    focusLabel: "Three monthly outcomes at most",
  },
  {
    phase: "Close",
    title: "Enter the month with open hands",
    copy: "Finish with a trustworthy system, protected rhythms, and enough flexibility for life to remain human.",
    checks: ["My commitments fit the calendar I actually have", "Rest and formation are planned, not leftover", "I know what can move if the month changes", "I am finished planning for now"],
    noteLabel: "Closing reflection",
    complete: true,
  },
];

function ReviewTab({ tasks, goals, protectedBlocks, onOpen }) {
  const [cadence, setCadence] = usePersistentState("abide-review-cadence", "weekly");
  const [workspace, setWorkspace] = usePersistentState("abide-review-workspace-v1", {
    weekly: { step: 0, checked: {}, notes: {}, focus: ["", "", ""] },
    monthly: { step: 0, checked: {}, notes: {}, focus: ["", "", ""] },
  });
  const [history, setHistory] = usePersistentState("abide-review-history-v1", []);

  const blueprint = cadence === "weekly" ? WEEKLY_REVIEW_BLUEPRINT : MONTHLY_REVIEW_BLUEPRINT;
  const state = workspace[cadence] || { step: 0, checked: {}, notes: {}, focus: ["", "", ""] };
  const stepIndex = Math.min(state.step || 0, blueprint.length - 1);
  const step = blueprint[stepIndex];

  const overdue = tasks.filter((t) => !t.done && taskDateKey(t) < REFERENCE_DATE_KEY).length;
  const unassigned = tasks.filter((t) => !t.done && !t.area).length;
  const someday = tasks.filter((t) => !t.done && t.status === "someday").length;
  const openGoals = goals.length;
  const weekKeys = buildWeekKeys(REFERENCE_DATE_KEY);
  const weekEnd = weekKeys[weekKeys.length - 1];
  const monthLabel = dateFromKey(REFERENCE_DATE_KEY).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const periodLabel = cadence === "weekly" ? `${formatDateLabel(weekKeys[0])} – ${formatDateLabel(weekEnd)}` : monthLabel;

  const updateState = (patch) => setWorkspace((prev) => ({
    ...prev,
    [cadence]: { ...(prev[cadence] || {}), ...patch },
  }));

  const checkKey = (index) => `${stepIndex}:${index}`;
  const toggleCheck = (index) => {
    const key = checkKey(index);
    updateState({ checked: { ...(state.checked || {}), [key]: !state.checked?.[key] } });
  };

  const setNote = (value) => updateState({ notes: { ...(state.notes || {}), [stepIndex]: value } });
  const setFocus = (index, value) => {
    const next = [...(state.focus || ["", "", ""])];
    next[index] = value;
    updateState({ focus: next });
  };

  const next = () => updateState({ step: Math.min(stepIndex + 1, blueprint.length - 1) });
  const back = () => updateState({ step: Math.max(stepIndex - 1, 0) });

  const completeReview = () => {
    const entry = {
      id: `review_${Date.now()}`,
      cadence,
      periodLabel,
      completedAt: new Date().toISOString(),
      notes: state.notes || {},
      focus: (state.focus || []).filter((x) => x?.trim()),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 24));
    setWorkspace((prev) => ({
      ...prev,
      [cadence]: { step: 0, checked: {}, notes: {}, focus: ["", "", ""] },
    }));
  };

  const checkedInStep = step.checks.filter((_, i) => state.checked?.[checkKey(i)]).length;
  const totalChecks = blueprint.reduce((sum, s) => sum + s.checks.length, 0);
  const checkedTotal = blueprint.reduce((sum, s, sIndex) => sum + s.checks.filter((_, i) => state.checked?.[`${sIndex}:${i}`]).length, 0);
  const progress = Math.round((checkedTotal / Math.max(1, totalChecks)) * 100);

  return (
    <>
      <Header eyebrow="Reflect, then engage" title="Review" />
      <div className="scroll">
        <div className="segmented">
          <div className={`seg-btn ${cadence === "weekly" ? "active" : ""}`} onClick={() => setCadence("weekly")}>Weekly</div>
          <div className={`seg-btn ${cadence === "monthly" ? "active" : ""}`} onClick={() => setCadence("monthly")}>Monthly</div>
        </div>

        <div className="card review-hero">
          <div className="review-kicker">{cadence === "weekly" ? "Weekly reset" : "Monthly horizon"}</div>
          <div className="review-hero-title">{periodLabel}</div>
          <div className="review-hero-copy">{cadence === "weekly" ? "Get clear, get current, get creative, and protect an unhurried pace before the week begins." : "Review the wider horizon, subtract before adding, and build the next month around faithful rhythms rather than maximum volume."}</div>
          <div className="review-progress"><div className="review-progress-fill" style={{ width: `${progress}%` }} /></div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>{progress}% of this review checked · step {stepIndex + 1} of {blueprint.length}</div>
        </div>

        <div className="stat-grid" style={{ marginTop: 0 }}>
          <div className="stat-card"><div className="stat-num">{overdue}</div><div className="stat-label">Overdue</div></div>
          <div className="stat-card"><div className="stat-num">{unassigned}</div><div className="stat-label">No Area</div></div>
          <div className="stat-card"><div className="stat-num">{someday}</div><div className="stat-label">Someday / Maybe</div></div>
          <div className="stat-card"><div className="stat-num">{openGoals}</div><div className="stat-label">Active goals</div></div>
        </div>

        <div className="card review-step-card">
          <div className="review-phase">{step.phase}</div>
          <div className="review-step-title">{step.title}</div>
          <div className="review-step-copy">{step.copy}</div>

          <div style={{ marginTop: 12 }}>
            {step.checks.map((item, i) => {
              const done = Boolean(state.checked?.[checkKey(i)]);
              return (
                <div key={i} className={`review-check ${done ? "done" : ""}`} onClick={() => toggleCheck(i)}>
                  <div className="review-check-dot">{done && <Check size={12} color="#14100A" strokeWidth={3} />}</div>
                  <div className="review-check-text">{item}</div>
                </div>
              );
            })}
          </div>

          {step.shortcut && (
            <div className="review-shortcuts">
              <div className="filter-chip" onClick={() => onOpen(step.shortcut)}><ChevronRight size={12} />{step.shortcutLabel}</div>
            </div>
          )}

          <div className="fb-label" style={{ marginTop: 14 }}>{step.noteLabel}</div>
          <textarea className="review-note" value={state.notes?.[stepIndex] || ""} onChange={(e) => setNote(e.target.value)} placeholder="Write what you notice…" />

          {step.focusLabel && (
            <>
              <div className="fb-label">{step.focusLabel}</div>
              <div className="review-focus-grid">
                {[0, 1, 2].map((i) => <input key={i} className="review-focus-input" value={state.focus?.[i] || ""} onChange={(e) => setFocus(i, e.target.value)} placeholder={`${i + 1}. Outcome`} />)}
              </div>
            </>
          )}

          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 11 }}>{checkedInStep} of {step.checks.length} checks complete in this step.</div>
        </div>

        <div className="review-nav">
          <div className="filter-chip" style={{ opacity: stepIndex === 0 ? .45 : 1, pointerEvents: stepIndex === 0 ? "none" : "auto" }} onClick={back}><ChevronLeft size={13} />Previous</div>
          {step.complete ? <div className="filter-chip active" onClick={completeReview}><Check size={13} />Complete Review</div> : <div className="filter-chip active" onClick={next}>Next<ChevronRight size={13} /></div>}
        </div>

        <div className="section-label">Quick Access</div>
        <div className="card">
          <div className="nav-row" onClick={() => onOpen("today")}><div className="nav-row-left"><ListTodo size={16} color="#E8B45C" />Today & open loops</div><ChevronRight size={16} color="var(--text3)" /></div>
          <div className="nav-row" onClick={() => onOpen("calendar")}><div className="nav-row-left"><CalendarDays size={16} color="#8FA88A" />Calendar hard landscape</div><ChevronRight size={16} color="var(--text3)" /></div>
          <div className="nav-row" onClick={() => onOpen("goals")}><div className="nav-row-left"><Target size={16} color="#7C93C9" />Goals & horizons</div><ChevronRight size={16} color="var(--text3)" /></div>
        </div>

        <div className="section-label">Review History</div>
        <div className="card">
          {history.length ? history.slice(0, 6).map((item) => (
            <div className="review-history-row" key={item.id}>
              <div className="review-history-title">{item.cadence === "weekly" ? "Weekly Review" : "Monthly Review"} · {item.periodLabel}</div>
              <div className="review-history-meta">{new Date(item.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}{item.focus?.length ? ` · ${item.focus.length} focus outcome${item.focus.length === 1 ? "" : "s"}` : ""}</div>
            </div>
          )) : <div className="insight-line">Completed reviews will appear here.</div>}
        </div>
      </div>
    </>
  );
}

function MoreTab({ onOpen, theme, setTheme, protectedBlocks, setProtectedBlocks, areas, setAreas, onDeleteArea, onOpenCalendar }) {
  const [screen, setScreen] = useState("more");
  if (screen === "settings") return <SettingsScreen onBack={() => setScreen("more")} theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={onDeleteArea} onOpenCalendar={onOpenCalendar} />;

  const cards = [
    { id: "goals", label: "Goals", copy: "Projects, outcomes, and higher horizons", icon: Target, tint: "#7C93C9" },
    { id: "scratch", label: "Scratchbook", copy: "Thinking space that does not become a task list", icon: PenTool, tint: "#D98595" },
    { id: "reminders", label: "Reminders", copy: "Upcoming alerts and notification controls", icon: Bell, tint: "#E8B45C" },
    { id: "insights", label: "Insights", copy: "Patterns and history, not another scoreboard", icon: BarChart3, tint: "#8FA88A" },
  ];

  return (
    <>
      <Header eyebrow="Utilities & configuration" title="More" />
      <div className="scroll">
        <div className="card review-hero">
          <div className="review-kicker">Out of the way, still available</div>
          <div className="review-hero-title">Keep the main navigation quiet.</div>
          <div className="review-hero-copy">These tools matter, but they do not need to compete with Today, Calendar, Review, and Journal every time you open Abide.</div>
        </div>
        <div className="more-grid">
          {cards.map((item) => {
            const Icon = item.icon;
            return (
              <div className="card more-card" key={item.id} onClick={() => onOpen(item.id)}>
                <Icon size={20} color={item.tint} />
                <div>
                  <div className="more-card-title">{item.label}</div>
                  <div className="more-card-copy">{item.copy}</div>
                </div>
              </div>
            );
          })}
          <div className="card more-card" onClick={() => setScreen("settings")}>
            <SettingsIcon size={20} color="#E8B45C" />
            <div>
              <div className="more-card-title">Settings</div>
              <div className="more-card-copy">Appearance, Areas, protected time, and calendar management</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

'''
if "const WEEKLY_REVIEW_BLUEPRINT" not in app:
    app = app.replace("function InsightsTab(", review_components + "\nfunction InsightsTab(", 1)

old_tabs = '''  const tabs = [
    { id: "today", label: "Today", icon: ListTodo }, { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "goals", label: "Goals", icon: Target }, { id: "journal", label: "Journal", icon: BookOpen },
    { id: "scratch", label: "Scratch", icon: PenTool }, { id: "reminders", label: "Reminders", icon: Bell }, { id: "insights", label: "Insights", icon: BarChart3 },
  ];'''
new_tabs = '''  const tabs = [
    { id: "today", label: "Today", icon: ListTodo },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "review", label: "Review", icon: RefreshCw },
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "more", label: "More", icon: SettingsIcon },
  ];'''
if old_tabs not in app:
    raise SystemExit("Could not find the current navigation list.")
app = app.replace(old_tabs, new_tabs, 1)

active_anchor = '''      {tab === "calendar" && <CalendarTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} areas={areas} toggleDone={toggleDone} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateTask={createTask} openAddSignal={quickAddSignal} onCreateArea={createArea} />}
'''
app = app.replace(
    active_anchor,
    active_anchor + '''      {tab === "review" && <ReviewTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} onOpen={setTab} />}
''',
    1
)

insights_line = '''      {tab === "insights" && <InsightsTab theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={deleteArea} tasks={tasks} goals={goals} journalEntries={journalEntries} setJournalEntries={setJournalEntries} onOpenJournal={() => setTab("journal")} onOpenCalendar={() => setTab("calendar")} />}
'''
if insights_line not in app:
    raise SystemExit("Could not find the Insights route.")
app = app.replace(
    insights_line,
    insights_line + '''      {tab === "more" && <MoreTab onOpen={setTab} theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={deleteArea} onOpenCalendar={() => setTab("calendar")} />}
''',
    1
)

arch_marker = "## 5. Tech stack"
arch_update = r'''
## 4.5 Review workspace — weekly and monthly

Abide treats **Review** as a first-class workflow, not an analytics widget.

### Navigation hierarchy

Primary navigation is intentionally limited to the surfaces that support the core rhythm of the app:

1. **Today** — engage with the next trusted actions.
2. **Calendar** — the hard landscape of time-specific commitments.
3. **Review** — reflect, regain perspective, and prepare the week/month.
4. **Journal** — protected spiritual reflection that is not reduced to productivity.
5. **More** — secondary utilities and configuration.

**Goals, Scratchbook, Reminders, Insights, and Settings** live under More. They remain fully functional and reachable, but no longer compete for primary-navigation attention. Goals are also linked directly from Review when the process reaches higher-horizon reflection.

### Review data model

```text
reviews/{reviewId}
  cadence: weekly|monthly
  periodKey
  periodLabel
  status: in_progress|completed
  currentStep
  checklistState: { [stepItemKey]: boolean }
  notes: { [stepIndex]: string }
  focusOutcomes: [string, string, string]
  startedAt
  completedAt
```

The current prototype persists this workspace and its completion history in localStorage. When the rest of Abide's core data moves to Firestore, these records should move to the `reviews` collection above without changing the user-facing workflow.

### Weekly review methodology

The Weekly Review keeps GTD's **Get Clear → Get Current → Get Creative** sequence, then deliberately adds an unhurried planning layer:

- **Arrive:** become present before planning; clarity is the goal, not maximum output.
- **Get Clear:** collect inputs, process capture points, and do a mind sweep.
- **Get Current:** review the previous calendar, upcoming calendar, open actions, waiting-fors, goals/outcomes, and ensure active work has a next action.
- **Protect the Pace:** confirm protected time and Sabbath/rest rhythms, identify overload, leave buffers, and explicitly choose what will *not* be done.
- **Get Creative:** review Someday/Maybe and allow quieter ideas to surface.
- **Commit:** name no more than three meaningful weekly outcomes and stop planning once the system is trustworthy.

### Monthly review methodology

The Monthly Review is a wider-horizon planning process:

- Arrive and reflect on the month without turning it into a performance score.
- Clear stale open loops and make conscious defer/delegate/archive decisions.
- Review goals, Areas, and higher horizons.
- Scan the next 4–6 weeks of the Calendar for deadlines, preparation, travel, and recovery needs.
- Review the user's Rule-of-Life rhythms: daily, weekly, and monthly practices that create space for formation.
- **Subtract before adding:** stop, pause, simplify, or delegate before committing new volume.
- Choose no more than three meaningful monthly outcomes.
- Close the review with protected rhythms visible and enough unscheduled margin for the month to remain human.

This design intentionally combines GTD's trusted-system discipline with Abide's existing principle that hurry should not become the governing logic of the schedule.

'''
if "## 4.5 Review workspace" not in arch:
    if arch_marker not in arch:
        raise SystemExit("Could not find the architecture insertion point.")
    arch = arch.replace(arch_marker, arch_update + "\n" + arch_marker, 1)

APP.write_text(app)
ARCH.write_text(arch)

print("Abide review upgrade applied.")
print("Backups created:")
print(" - src/App.jsx.before-review-upgrade")
print(" - ARCHITECTURE.md.before-review-upgrade")
print()
print("Next: npm run build")
