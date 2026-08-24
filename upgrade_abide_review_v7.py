#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

APP = Path("src/App.jsx")
ARCH = Path("ARCHITECTURE.md")

if not APP.exists() or not ARCH.exists():
    sys.exit("Run this from the root of the Abide repo (the folder containing src/App.jsx and ARCHITECTURE.md).")

app = APP.read_text()
arch = ARCH.read_text()

shutil.copy2(APP, APP.with_suffix(APP.suffix + ".before-review-live-actions"))
shutil.copy2(ARCH, ARCH.with_suffix(ARCH.suffix + ".before-review-live-actions"))

old_create = '  const createTask = (task) => setTasks((prev) => [{ id: Date.now(), ...task }, ...prev]);'
new_create = '''  const createTask = (task) => {
    const id = Date.now();
    setTasks((prev) => [{ id, ...task }, ...prev]);
    return id;
  };'''
if old_create not in app:
    sys.exit("Could not find createTask. The repo may have changed; stop rather than applying an unsafe patch.")
app = app.replace(old_create, new_create, 1)

monthly_start = app.index("const MONTHLY_REVIEW_BLUEPRINT = [")
review_start = app.index("function ReviewTab", monthly_start)

new_monthly = r'''const MONTHLY_REVIEW_BLUEPRINT = [
  {
    phase: "Close",
    title: "Close the previous month briefly",
    copy: "Look back only long enough to learn. This is not a scorecard; it is a clean handoff into the month ahead.",
    checks: ["Notice what actually moved forward", "Identify open loops that should not drift into the new month", "Decide what should be dropped instead of carried forward"],
    noteLabel: "What from last month should inform the month ahead?",
  },
  {
    phase: "Clear the Deck",
    title: "Clear before you plan",
    copy: "GTD works best when the system is current. Clean up stale commitments before adding new ones.",
    checks: ["Review overdue and unassigned tasks", "Review waiting-fors and follow-ups", "Clarify, delegate, defer, archive, or delete stale items", "Capture anything still living only in your head"],
    noteLabel: "What needs a decision before I plan the month?",
    shortcut: "today",
    shortcutLabel: "Open Today",
  },
  {
    phase: "Survey the Month",
    title: "Look at the next four to six weeks",
    copy: "The calendar is the hard landscape. Start with what is already true before deciding what else belongs.",
    checks: ["Review the next 4–6 weeks of commitments", "Notice travel, deadlines, events, and preparation needs", "Notice unusually heavy weeks", "Identify recovery or buffer time that should exist around demanding commitments"],
    noteLabel: "What is already true about this month?",
    shortcut: "calendar",
    shortcutLabel: "Open Calendar",
  },
  {
    phase: "Areas",
    title: "Review the major areas of life",
    copy: "Scan responsibilities and relationships so the month is not shaped only by the loudest deadline.",
    checks: ["Review each active Area for needed attention", "Notice anything being neglected", "Notice anything taking disproportionate energy", "Create a next action where attention is required"],
    noteLabel: "Where does life need appropriate attention this month?",
    shortcut: "goals",
    shortcutLabel: "Open Goals & Areas",
  },
  {
    phase: "Focus",
    title: "Choose the month's few meaningful outcomes",
    copy: "Choose no more than three outcomes. They are directional outcomes, not a list of every important responsibility.",
    checks: ["These outcomes fit the season I am actually in", "They reflect real responsibilities and values", "There is enough capacity to pursue them without chronic hurry"],
    noteLabel: "What would make the coming month meaningful and well-lived?",
    focusLabel: "Three monthly outcomes at most",
  },
  {
    phase: "Next Actions",
    title: "Turn outcomes into real next actions",
    copy: "GTD keeps intentions from staying abstract. Every outcome that matters should have a concrete next physical action in Abide.",
    checks: ["Each active monthly outcome has a next action", "Time-specific actions are on the calendar", "Delegated items are clear waiting-fors", "Preparation work exists before the event or deadline that triggers it"],
    noteLabel: "What still needs a concrete next action?",
  },
  {
    phase: "Rule of Life",
    title: "Protect the rhythms that shape the month",
    copy: "Practicing the Way treats a Rule of Life as a set of intentional rhythms. Use it here as a practical structure for the life you want your calendar to support.",
    checks: ["Review daily rhythms", "Review weekly rhythms such as Sabbath/rest, community, relationships, prayer, exercise, and home life", "Review monthly relational, spiritual, financial, and restorative rhythms", "Adjust the rhythm to the season instead of forcing an ideal schedule"],
    noteLabel: "Which rhythms most need protection this month?",
  },
  {
    phase: "Subtract & Protect",
    title: "Make room before adding more",
    copy: "An unhurried month is created by subtraction and margin as much as by organization.",
    checks: ["Name at least one thing to stop, pause, simplify, delegate, or decline", "Protect genuine rest", "Leave unscheduled margin", "Check overloaded weeks before committing more"],
    noteLabel: "What am I intentionally saying no to, and where do I need margin?",
  },
  {
    phase: "Commit",
    title: "Enter the month with a trustworthy plan",
    copy: "Finish when the system is clear enough to live. The goal is not a perfect month; it is a month with direction, next actions, and room to remain human.",
    checks: ["My commitments fit the calendar I actually have", "My important outcomes have real next actions", "My rhythms and rest are visible", "I know what can move if reality changes", "I am finished planning for now"],
    noteLabel: "One sentence for the kind of month I want to live",
    complete: true,
  },
];

'''

app = app[:monthly_start] + new_monthly + app[review_start:]

review_start = app.index("function ReviewTab")
more_start = app.index("function MoreTab", review_start)

new_review = r'''function ReviewTab({ tasks, goals, protectedBlocks, areas, onOpen, onOpenAdd, onCreateTask, onUpdateTask, onDeleteTask, onCreateArea }) {
  const [cadence, setCadence] = usePersistentState("abide-review-cadence", "weekly");
  const [workspace, setWorkspace] = usePersistentState("abide-review-workspace-v2", {
    weekly: { step: 0, checked: {}, notes: {}, focus: ["", "", ""], linkedTaskIdsByStep: {} },
    monthly: { step: 0, checked: {}, notes: {}, focus: ["", "", ""], linkedTaskIdsByStep: {} },
  });
  const [history, setHistory] = usePersistentState("abide-review-history-v1", []);
  const [editingHistory, setEditingHistory] = useState(null);
  const [addingTask, setAddingTask] = useState(false);
  const [linkingTask, setLinkingTask] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [editingTask, setEditingTask] = useState(null);

  const blueprint = cadence === "weekly" ? WEEKLY_REVIEW_BLUEPRINT : MONTHLY_REVIEW_BLUEPRINT;
  const state = workspace[cadence] || { step: 0, checked: {}, notes: {}, focus: ["", "", ""], linkedTaskIdsByStep: {} };
  const stepIndex = Math.min(state.step || 0, blueprint.length - 1);
  const step = blueprint[stepIndex];

  const overdue = tasks.filter((t) => !t.done && taskDateKey(t) < REFERENCE_DATE_KEY).length;
  const unassigned = tasks.filter((t) => !t.done && !t.area).length;
  const someday = tasks.filter((t) => !t.done && t.status === "someday").length;
  const openGoals = goals.length;
  const weekKeys = buildWeekKeys(REFERENCE_DATE_KEY);
  const weekEnd = weekKeys[weekKeys.length - 1];
  const nextMonthDate = new Date(dateFromKey(REFERENCE_DATE_KEY));
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1, 1);
  const monthLabel = nextMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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

  const linkedIds = state.linkedTaskIdsByStep?.[stepIndex] || [];
  const linkedTasks = linkedIds.map((id) => tasks.find((t) => String(t.id) === String(id))).filter(Boolean);

  const setLinkedIds = (ids) => updateState({
    linkedTaskIdsByStep: {
      ...(state.linkedTaskIdsByStep || {}),
      [stepIndex]: ids,
    },
  });

  const linkTask = (id) => {
    if (id == null) return;
    const normalized = String(id);
    if (linkedIds.some((x) => String(x) === normalized)) return;
    setLinkedIds([...linkedIds, id]);
  };

  const unlinkTask = (id) => setLinkedIds(linkedIds.filter((x) => String(x) !== String(id)));

  const createAndLinkTask = (task) => {
    const id = onCreateTask(task);
    linkTask(id);
    setAddingTask(false);
  };

  const candidateTasks = tasks
    .filter((t) => !t.done && !linkedIds.some((id) => String(id) === String(t.id)))
    .filter((t) => !linkSearch.trim() || String(t.title || "").toLowerCase().includes(linkSearch.trim().toLowerCase()))
    .slice(0, 12);

  const next = () => {
    setAddingTask(false);
    setLinkingTask(false);
    updateState({ step: Math.min(stepIndex + 1, blueprint.length - 1) });
  };
  const back = () => {
    setAddingTask(false);
    setLinkingTask(false);
    updateState({ step: Math.max(stepIndex - 1, 0) });
  };

  const completeReview = () => {
    const entry = {
      id: `review_${Date.now()}`,
      cadence,
      periodLabel,
      completedAt: new Date().toISOString(),
      notes: state.notes || {},
      focus: (state.focus || []).filter((x) => x?.trim()),
      linkedTaskIdsByStep: state.linkedTaskIdsByStep || {},
    };
    setHistory((prev) => [entry, ...prev].slice(0, 24));
    setWorkspace((prev) => ({
      ...prev,
      [cadence]: { step: 0, checked: {}, notes: {}, focus: ["", "", ""], linkedTaskIdsByStep: {} },
    }));
  };

  const saveHistoryEntry = (updated) => {
    setHistory((prev) => prev.map((item) => item.id === updated.id ? updated : item));
    setEditingHistory(null);
  };

  const deleteHistoryEntry = (id) => {
    if (!window.confirm("Delete this completed review? This cannot be undone.")) return;
    setHistory((prev) => prev.filter((item) => item.id !== id));
    setEditingHistory(null);
  };

  const checkedInStep = step.checks.filter((_, i) => state.checked?.[checkKey(i)]).length;
  const totalChecks = blueprint.reduce((sum, s) => sum + s.checks.length, 0);
  const checkedTotal = blueprint.reduce((sum, s, sIndex) => sum + s.checks.filter((_, i) => state.checked?.[`${sIndex}:${i}`]).length, 0);
  const progress = Math.round((checkedTotal / Math.max(1, totalChecks)) * 100);

  return (
    <>
      <Header eyebrow={cadence === "weekly" ? "Reflect, then engage" : "Prepare the month ahead"} title="Review" />
      <div className="scroll">
        <div className="segmented">
          <div className={`seg-btn ${cadence === "weekly" ? "active" : ""}`} onClick={() => { setCadence("weekly"); setAddingTask(false); setLinkingTask(false); }}>Weekly Review</div>
          <div className={`seg-btn ${cadence === "monthly" ? "active" : ""}`} onClick={() => { setCadence("monthly"); setAddingTask(false); setLinkingTask(false); }}>Monthly Prep</div>
        </div>

        <div className="card review-hero">
          <div className="review-kicker">{cadence === "weekly" ? "Weekly reset" : "Plan the month ahead"}</div>
          <div className="review-hero-title">{periodLabel}</div>
          <div className="review-hero-copy">{cadence === "weekly" ? "Get clear, get current, get creative, and protect an unhurried pace before the week begins." : "Use last month only as information. Clear the system, survey the next 4–6 weeks, choose a few outcomes, create their next actions, and protect the rhythms and margin that make the month livable."}</div>
          <div className="review-progress"><div className="review-progress-fill" style={{ width: `${progress}%` }} /></div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>{progress}% checked · step {stepIndex + 1} of {blueprint.length}</div>
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

          <div className="fb-label" style={{ marginTop: 14 }}>Take action without duplicating it</div>
          <div className="review-shortcuts" style={{ flexWrap: "wrap" }}>
            <div className={`filter-chip ${addingTask ? "active" : ""}`} onClick={() => { setAddingTask(!addingTask); setLinkingTask(false); }}><Plus size={12} />Add Task</div>
            <div className={`filter-chip ${linkingTask ? "active" : ""}`} onClick={() => { setLinkingTask(!linkingTask); setAddingTask(false); }}><ChevronRight size={12} />Link Existing</div>
            <div className="filter-chip" onClick={onOpenAdd}><CalendarDays size={12} />Add Event</div>
            {step.shortcut && <div className="filter-chip" onClick={() => onOpen(step.shortcut)}><ChevronRight size={12} />{step.shortcutLabel}</div>}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 7 }}>Tasks created or linked here are the real Abide tasks. Completing or editing them anywhere in the app updates what you see here.</div>

          {addingTask && (
            <div style={{ marginTop: 12 }}>
              <AddSheet
                goals={goals}
                areas={areas}
                initialDate={REFERENCE_DATE_KEY}
                allowEvents={false}
                onClose={() => setAddingTask(false)}
                onCreateTask={createAndLinkTask}
                onCreateEvent={async () => {}}
                googleConnected={false}
                onCreateArea={onCreateArea}
              />
            </div>
          )}

          {linkingTask && (
            <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--subtleBg)" }}>
              <div className="fb-label" style={{ marginTop: 0 }}>Link an existing open task</div>
              <input className="input-line" style={{ margin: "0 0 8px" }} value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Search tasks…" />
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {candidateTasks.length ? candidateTasks.map((task) => (
                  <div key={task.id} className="nav-row" onClick={() => linkTask(task.id)} style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600 }}>{task.title}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>{formatDateLabel(taskDateKey(task))}{task.area && areas[task.area] ? ` · ${areas[task.area].name}` : ""}</div>
                    </div>
                    <Plus size={15} color="#E8B45C" />
                  </div>
                )) : <div className="insight-line">No matching open tasks.</div>}
              </div>
            </div>
          )}

          {linkedTasks.length > 0 && (
            <>
              <div className="fb-label">Linked real tasks</div>
              <div className="card" style={{ background: "var(--subtleBg)" }}>
                {linkedTasks.map((task) => (
                  <div key={task.id} className="review-history-row" style={{ cursor: "pointer" }} onClick={() => setEditingTask(task)}>
                    <div className={`checkbox ${task.done ? "done" : ""}`} style={{ width: 18, height: 18, marginTop: 1 }}>{task.done && <Check size={11} color="#14100A" strokeWidth={3} />}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="review-history-title" style={{ textDecoration: task.done ? "line-through" : "none", opacity: task.done ? .65 : 1 }}>{task.title}</div>
                      <div className="review-history-meta">{formatDateLabel(taskDateKey(task))}{task.area && areas[task.area] ? ` · ${areas[task.area].name}` : ""}</div>
                    </div>
                    <X size={15} color="var(--text3)" onClick={(e) => { e.stopPropagation(); unlinkTask(task.id); }} />
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="fb-label" style={{ marginTop: 14 }}>{step.noteLabel}</div>
          <textarea className="review-note" value={state.notes?.[stepIndex] || ""} onChange={(e) => setNote(e.target.value)} placeholder="Write only what belongs in the review itself. Actionable commitments should become tasks or events above." />

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
          {step.complete ? <div className="filter-chip active" onClick={completeReview}><Check size={13} />{cadence === "weekly" ? "Complete Review" : "Complete Monthly Prep"}</div> : <div className="filter-chip active" onClick={next}>Next<ChevronRight size={13} /></div>}
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
            <div className="review-history-row" key={item.id} onClick={() => setEditingHistory({ ...item, focus: [...(item.focus || [])], notes: { ...(item.notes || {}) } })} style={{ cursor: "pointer" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="review-history-title">{item.cadence === "weekly" ? "Weekly Review" : "Monthly Prep"} · {item.periodLabel}</div>
                <div className="review-history-meta">{new Date(item.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}{item.focus?.length ? ` · ${item.focus.length} focus outcome${item.focus.length === 1 ? "" : "s"}` : ""}</div>
              </div>
              <ChevronRight size={17} color="var(--text3)" style={{ flexShrink: 0 }} />
            </div>
          )) : <div className="insight-line">Completed reviews and monthly preps will appear here.</div>}
        </div>
      </div>

      {editingTask && <TaskEditor task={editingTask} goals={goals} areas={areas} onSave={(updated) => { onUpdateTask(updated); setEditingTask(null); }} onCancel={() => setEditingTask(null)} onDelete={(id) => { onDeleteTask(id); setEditingTask(null); }} onCreateArea={onCreateArea} />}

      {editingHistory && createPortal(
        <div className="modal-backdrop" onClick={() => setEditingHistory(null)}>
          <div className="card composer-card task-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="editor-shell">
              <div className="editor-header">
                <div className="editor-title">Edit {editingHistory.cadence === "weekly" ? "Weekly Review" : "Monthly Prep"}</div>
                <div className="editor-close" onClick={() => setEditingHistory(null)}><X size={17} /></div>
              </div>

              <div className="editor-scroll">
                <div className="fb-label">Review period</div>
                <input className="notes-box" style={{ minHeight: 0, marginTop: 0 }} value={editingHistory.periodLabel || ""} onChange={(e) => setEditingHistory((prev) => ({ ...prev, periodLabel: e.target.value }))} />

                <div className="fb-label">Completed</div>
                <div style={{ fontSize: 13.5, color: "var(--text2)", padding: "2px 0 6px" }}>
                  {new Date(editingHistory.completedAt).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>

                <div className="fb-label">Focus outcomes</div>
                <div className="review-focus-grid">
                  {[0, 1, 2].map((i) => (
                    <input key={i} className="review-focus-input" value={editingHistory.focus?.[i] || ""} onChange={(e) => {
                      const next = [...(editingHistory.focus || [])];
                      next[i] = e.target.value;
                      setEditingHistory((prev) => ({ ...prev, focus: next }));
                    }} placeholder={`${i + 1}. Outcome`} />
                  ))}
                </div>

                <div className="fb-label">Review notes</div>
                {(editingHistory.cadence === "weekly" ? WEEKLY_REVIEW_BLUEPRINT : MONTHLY_REVIEW_BLUEPRINT).map((reviewStep, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>{i + 1}. {reviewStep.title}</div>
                    <textarea className="review-note" value={editingHistory.notes?.[i] || ""} onChange={(e) => setEditingHistory((prev) => ({ ...prev, notes: { ...(prev.notes || {}), [i]: e.target.value } }))} placeholder="No notes saved for this step." />
                  </div>
                ))}

                <div className="filter-chip editor-delete" onClick={() => deleteHistoryEntry(editingHistory.id)}><Trash2 size={14} />Delete {editingHistory.cadence === "weekly" ? "Review" : "Monthly Prep"}</div>
              </div>

              <div className="editor-footer">
                <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={() => setEditingHistory(null)}>Cancel</div>
                <div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={() => saveHistoryEntry({ ...editingHistory, focus: (editingHistory.focus || []).map((x) => x || "") })}><Check size={14} />Save Changes</div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

'''

app = app[:review_start] + new_review + app[more_start:]

old_invocation = '{tab === "review" && <ReviewTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} onOpen={setTab} />}'
new_invocation = '{tab === "review" && <ReviewTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} areas={areas} onOpen={setTab} onOpenAdd={openGlobalAdd} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateArea={createArea} />}'
if old_invocation not in app:
    sys.exit("Could not find the ReviewTab root invocation. Stop rather than applying an unsafe patch.")
app = app.replace(old_invocation, new_invocation, 1)

model_old = '''  focusOutcomes: [string, string, string]
  startedAt
  completedAt
```'''
model_new = '''  focusOutcomes: [string, string, string]
  linkedTaskIdsByStep: { [stepIndex]: [taskId, ...] }
  linkedEventIdsByStep: { [stepIndex]: [eventId, ...] }   // durable backend target
  startedAt
  completedAt
```'''
if model_old in arch:
    arch = arch.replace(model_old, model_new, 1)

anchor = '''The current prototype persists this workspace and its completion history in localStorage. When the rest of Abide's core data moves to Firestore, these records should move to the `reviews` collection above without changing the user-facing workflow.
'''
addition = '''The current prototype persists this workspace and its completion history in localStorage. When the rest of Abide's core data moves to Firestore, these records should move to the `reviews` collection above without changing the user-facing workflow.

### Review as a live operating layer

Review must not become a second task list. Actionable commitments discovered during a review are created as real `tasks` or `calendarEvents`, or linked to existing ones. The review stores only references to those canonical objects. Editing or completing a linked task anywhere in Abide is immediately reflected when the review is reopened.

Current prototype behavior:
- **Add Task** creates a real Abide task and stores its task id on the current review step.
- **Link Existing** attaches an existing real task without copying it.
- Linked tasks can be opened in the normal Task Editor directly from Review.
- Removing a task from a review only removes the link; it does not delete the task.
- **Add Event** opens Calendar's real event composer and preserves the in-progress review workspace.
- Durable Firestore architecture should add linked event ids the same way once Calendar event state is lifted into the shared data layer.

Review notes are reserved for reflection/context. They should not be used as a duplicate place to store actionable tasks or events.
'''
if anchor in arch:
    arch = arch.replace(anchor, addition, 1)

arch = arch.replace("### Monthly review methodology", "### Monthly Prep methodology", 1)

old_monthly_arch = '''The Monthly Review is a wider-horizon planning process:

- Arrive and reflect on the month without turning it into a performance score.
- Clear stale open loops and make conscious defer/delegate/archive decisions.
- Review goals, Areas, and higher horizons.
- Scan the next 4–6 weeks of the Calendar for deadlines, preparation, travel, and recovery needs.
- Review the user's Rule-of-Life rhythms: daily, weekly, and monthly practices that create space for formation.
- **Subtract before adding:** stop, pause, simplify, or delegate before committing new volume.
- Choose no more than three meaningful monthly outcomes.
- Close the review with protected rhythms visible and enough unscheduled margin for the month to remain human.
'''
new_monthly_arch = '''Monthly Prep is primarily forward-looking. A brief look back exists only to inform the month ahead:

- **Close briefly:** notice what moved, what remains open, and what should not be carried forward.
- **Clear the deck:** process stale open loops, waiting-fors, and uncaptured commitments.
- **Survey the next 4–6 weeks:** treat the calendar as the hard landscape and identify preparation, travel, deadlines, heavy weeks, and recovery needs.
- **Review Areas:** scan responsibilities and relationships so planning is not driven only by urgency.
- **Choose up to three outcomes:** name the few results that deserve disproportionate attention this month.
- **Define next actions:** every active outcome gets a real next physical action in the canonical task/calendar system.
- **Review Rule-of-Life rhythms:** daily, weekly, and monthly practices may be spiritual or ordinary; the purpose is to arrange life intentionally rather than reactively.
- **Subtract and protect:** stop, pause, simplify, delegate, or decline; protect rest and unscheduled margin before adding optional volume.
- **Commit:** enter the month with a trustworthy system, visible rhythms, and flexibility for reality to change.
'''
if old_monthly_arch in arch:
    arch = arch.replace(old_monthly_arch, new_monthly_arch, 1)

APP.write_text(app)
ARCH.write_text(arch)

print("Abide live Review actions + forward-looking Monthly Prep applied.")
print("Changed:")
print(" - src/App.jsx")
print(" - ARCHITECTURE.md")
print("")
print("Next: npm run build")
