# Abide — Architecture & Roadmap

## Why "Abide"

You asked me to name it based on what I know about you, so — **Abide**.

It's pulled straight from your own words: in the very first journal entry this prototype seeded for you, on John 15:5, you wrote *"Abiding, not hustling."* That's the thesis of this entire app in two words — GTD's "engage with confidence" and Comer's "unhurried" aren't competing ideas, they're both downstream of abiding instead of hustling. It's also short, calm, and reads like something Apple would actually name an app (Notes, Reminders, Freeform, Journal) — not a productivity-bro name, not churchy jargon. And it doesn't collide with The Margin, which is already its own distinct brand.

If it doesn't stick, two runners-up for the same reason — pulled from your own language rather than invented: **Keep** (as in "the LORD bless you and keep you" — also just means to maintain a record) and **Trellis** (structure that supports organic growth — goals, milestones, and journal entries all growing along something that holds them up).



## 1. Why the prototype looks the way it does

You said "iPhone app built by Apple," and you already have a stated preference (from past builds) for **calm and dark: deep navy, warm gold, sage**. That's what the prototype uses — near-black navy background, translucent blur tab bar, SF-style system font, grouped inset lists, large titles that behave like native iOS. This is a *design direction*, not a locked decision — trivial to swap to light mode or a different accent later.

Two of your existing systems are already baked in on purpose:
- **The five-color highlight system** (yellow/green/pink/blue/orange) shows up as the tagging system in **Time with the Lord**, instead of inventing a new tagging scheme.
- **Areas** (Chi Alpha, The Margin, Personal, Wedding, Project Oἰκία) mirror how your Notion Command Center is already split by Work/Ministry/Personal.

## 1.5 One app, three shells — phone, iPad, laptop

The prototype now detects its own width and switches shell, not just scale:

- **Phone (< 760px):** the iPhone mockup you've already seen — bottom tab bar, bezel frame, single column.
- **iPad (760–1119px):** the phone bezel disappears; a compact icon sidebar (like Reminders or Files on iPad) replaces the bottom tab bar, content runs edge-to-edge, and grids widen (stat cards go 4-across, scratch pages 3-across).
- **Laptop (≥ 1120px):** same sidebar, now with text labels (like Mail or Notes on Mac), content is capped at a readable max-width and centered rather than stretching edge-to-edge, and Goals lays out as a two-column grid instead of one long stack.

This mirrors how Apple's own apps actually behave — Reminders and Notes don't just scale up the phone layout on iPad/Mac, they swap the *navigation model* (tab bar → sidebar) while keeping every card, list, and interaction identical underneath. In the real build this maps directly to CSS container queries plus a `useViewport()` hook, exactly as prototyped — no separate codebase per platform, since it's one PWA that reads its own rendered width.

| Getting Things Done principle | How it shows up in the app |
|---|---|
| **Capture everything, instantly, frictionlessly** | The capture bar is pinned at the top of Today, plus a floating `+` button reachable from *every* tab. Capturing never requires picking a project or area first — that happens later. |
| **Clarify before you organize** | New captures land in an implicit "Inbox" state (area = unset) until you assign one — so nothing forces a decision at 11pm that should happen at your weekly review. |
| **Organize by context/area, not by list** | Everything carries an Area tag (Work, Margin, Personal, Wedding, Home) instead of living in siloed lists per app, the way Notion/ClickUp/Reminders never quite agreed with each other for you. |
| **Reflect — the weekly review is the engine that keeps the system trusted** | Insights tab now has an expandable **Weekly Review** card: overdue items to reschedule, untagged captures to clarify, Someday/Maybe to revisit, goals with no movement. This is the literal GTD review checklist, surfaced instead of assumed. |
| **Engage with confidence** | Today view shows Overdue + Today + a *toggleable* upcoming window (This Week / Next 2 Weeks) — bounded either way, so upcoming items don't create noise, but also never silently disappear and "pop up" on you later, which was one of your explicit complaints. |
| **Someday/Maybe** | Its own collapsed section at the bottom of Today — closed by default so it doesn't compete with actionable items, but one tap away instead of buried in a separate app. |
| **Filter by context** | GTD's "context" (@calls, @computer, @errands) maps most naturally for you onto **Area** (Chi Alpha / Margin / Personal / Wedding / Home) — the filter chips on Today let you collapse everything down to just one area when you're in "Margin mode" for the evening. |

## 3. *The Ruthless Elimination of Hurry* → app decisions

| Comer's principle | How it shows up in the app |
|---|---|
| **Hurry is the enemy of depth, not a neutral scheduling problem** | The app deliberately does *not* show you an infinite scrolling task list. Today shows a small, bounded set. Volume is hidden until you ask for it (Calendar → Week/Month). |
| **Unhurried time with God is a category, not a task** | Time with the Lord is its own tab, not a task type inside "Personal." It has its own streak, its own view, its own composer — protected space, not another checkbox. |
| **Silence, solitude, sabbath need to be visible, not just theoretical** | Visible on the Calendar day agenda as a **Protected — Time with the Lord** block (dashed sage border). The point isn't rigidity — it's that this time doesn't run on anxiety, and work doesn't get to follow you into it. "Schedule Anyway" is always one tap away if life genuinely requires it; the block is a guardrail, not a cage. |
| **Freedom from "more, faster, easier, and never enough"** | The dynamic filter system (build and save your own combinations — "Margin only," "high priority only," whatever you need in the moment) exists so you can *choose* to see less, on purpose, instead of the app always showing you everything at once. |
| **Notice your own pace, don't just track output** | The "Pattern Noticed" card in Insights is intentionally about *rhythm*, not just completion count — e.g. noticing Margin tasks get skipped on high-Chi-Alpha-load days. This is where "see when I'm *not* productive" lives. |

---

## 3.5 What "flexible and editable" means structurally

Every task, goal, and milestone in the data model below carries `dueDate`, `priority`, and `status` as first-class, always-editable fields — not baked into which list something lives in (which is why ClickUp/Asana-style rigid status columns tend to fight you). Moving a due date or bumping priority is a property edit, never a "move to a different board" operation.

---

## 4. Data model (Firestore)

```
users/{uid}
  displayName, timezone, weekStartsOn, theme

areas/{areaId}
  name, color, ownerUid, archived

tasks/{taskId}
  title, notes, areaId, goalId (nullable),
  kind: task|milestone,
  dueDate, dueTime (nullable), priority: low|med|high,
  status: inbox|next|scheduled|done|someday,
  progress: not_started|in_progress|completed,
  subtasks: [{ id, label, done, dueDate (nullable), dueTime (nullable) }],
  recurrence: { freq: daily|weekly|monthly|yearly, interval: number, days: [], endDate },
  parentRecurringId (nullable — links generated instances back to their rule),
  createdAt, completedAt, reminders: [{ offsetMinutes }]

goals/{goalId}
  name, areaId, targetDate, progressMode: manual|computedFromMilestones,
  progressPct, archived

Milestones are stored in `tasks/{taskId}` with `kind: milestone` and a non-null
`goalId`. A milestone is therefore a real actionable task rather than a separate
checklist record. It uses the same dueDate, progress, completion metadata,
Area, reminders, Calendar placement, Today placement, and global search behavior
as any other task.

journalEntries/{entryId}          // "Time with the Lord"
  date, scriptureRef, note, richTextHtml, tag: yellow|green|pink|blue|orange,
  linkedTaskId (nullable — e.g. link a Margin devotional task to the entry that inspired it)

habits/{habitId}                  // reading, Bible, writing, gym streaks
  name, cadence, targetPerWeek, areaId
habitLogs/{logId}
  habitId, date, value (minutes/pages/boolean)

calendarEvents/{eventId}          // synced from Google Calendar, or native
  title, start, end, source: google|native, googleEventId

reviews/{reviewId}                // GTD weekly review record
  weekOf, tasksReviewed, notes, completedAt
```

**Recurrence engine:** recurrence rules support an interval plus an optional weekday, so rules can express patterns like every third Sunday, every seventh Wednesday, or every third year. A Cloud Function runs nightly, looks at `recurrence` rules, and materializes the next `task` instance a few days ahead — so "recurring" is just regular tasks under the hood, and your history of completions is a real, queryable log (this is what powers the streaks and the bar charts in Insights, and it's the same pattern your Iron Log already uses for workouts).

**Calendar sync — multiple Google accounts and multiple calendars
**
Abide supports multiple independent Google OAuth grants for the same Abide user. A user can connect a personal Google account, a work Google Workspace account, and additional Google accounts. Each connected Google account is treated as an account container, and each account can expose multiple calendars through calendarList.list().

Data shape

users/{uid}/googleAccounts/{googleAccountId}
  email, displayLabel, connectedAt, lastSyncAt, status

users/{uid}/googleAccounts/{googleAccountId}/calendars/{calendarId}
  label, color, primary, enabled

calendarEvents/{eventId}
  title, start, end, source: google|native,
  googleAccountId (nullable), calendarId (nullable), googleEventId (nullable)

OAuth access/refresh credentials must not be stored in client-readable Firestore. In the durable production architecture, OAuth credentials are stored server-side and Google Calendar calls run through Cloud Functions. The current browser prototype is an interim implementation: it can hold more than one short-lived Google access token in sessionStorage, keyed by the primary calendar/account email, and merges events from all connected accounts into the same Calendar UI.

Connect: + Add Google Account always invokes Google's account chooser so a second or third Google account can be authorized without replacing the first one.

Identify account: after authorization, Abide calls calendarList.list(). The primary calendar ID is used as the Google account identifier/email.

Calendars: every connected account owns its own calendar list and per-calendar visibility toggles. Calendar identity in the client is composite: googleAccountId::calendarId, preventing collisions when the same shared calendar is visible from more than one Google account.

Pull: Abide fetches events for enabled/visible calendars from every connected account and merges them into one agenda. Imported events retain googleAccountId, account label, calendarId, calendar label, and Google event ID.

Create: when creating an event, the user chooses which connected Google account receives it; Abide creates the event on that account's primary calendar.

Disconnect: disconnecting one account removes only that account's live Google events/tokens. Other connected Google accounts remain active.

Workspace policy: a managed Google Workspace administrator may block Abide's OAuth client. In that case the account cannot be connected until the administrator permits the app.

Token expiry: browser prototype access tokens are short-lived. If one expires, only that account needs to be reconnected. Durable multi-account sync requires the server-side Cloud Functions OAuth flow described above.

**Scratchbook:** `scratchPages/{pageId}` — `{ type: "draw" | "type", content, contentHtml (typed pages), uid, createdAt }`. Typed pages support rich text (bold, italic, underline, font selection, and highlight colors). Drawings save as PNG (canvas `toDataURL()` client-side → uploaded to **Firebase Storage**, with the Firestore doc just holding the storage URL — don't store base64 PNGs directly in Firestore, it blows past the 1MB document limit fast). On iPad this is standard HTML5 Pointer Events (`pointerdown/move/up`), which already report Apple Pencil `pressure` and `tiltX/tiltY` natively in Safari — no extra SDK needed, which is what the prototype's canvas is already wired for.

**Filtering and search:** Area, priority, progress, and completed-visibility filters are client-side state against whatever the current Firestore query already returned — no new backend is required. Tasks carry a separate `progress: not_started|in_progress|completed` property in addition to GTD `status`; `status` answers where an item belongs in the GTD system, while `progress` answers whether work has started. Marking a task complete sets `progress: completed` and completion metadata; reopening it restores an actionable progress state. Working views hide completed items by default but provide a persistent "Show completed" control, similar to a database property filter. **Saved custom filters** may persist areas[], priorities[], progress[], and showCompleted so useful views can be restored across devices.

**Global search:** Abide provides a unified search surface across tasks, scheduled subtasks, native events, and currently loaded Google Calendar events. Search matches user-facing text such as title, subtask label, Area, goal, notes/activity text, and calendar/event labels. Completed tasks remain searchable even when hidden from normal working views. Search is presentation/query behavior and does not duplicate task or event records.

**Goals, fully editable:** `goals/{goalId}` includes `notes` and a real ISO `targetDate` selected with a date control rather than free-form text. Milestones follow an Asana-style task model: each milestone is a real task with `kind: milestone`, a non-null `goalId`, and its own due date and editable task properties. Milestones appear inside their Goal as major checkpoints, but they also appear in Today, Calendar, filters, and global search like any other actionable task. Completing a milestone from any surface updates that same task. Goal progress may be computed from the completion state of its milestone tasks. Existing embedded milestone data should be migrated into milestone tasks rather than duplicated.

**Journal and Scratchbook CRUD:** both are now full create/read/update/delete, not just append-only logs. Journal entries get inline edit (reference, note, tag) and delete. Scratch pages get edit and delete too — typed notes reopen in the text composer; drawings reload onto the canvas (`ctx.drawImage()` from the saved PNG) so you can keep adding strokes to an old page instead of only ever starting fresh.

**Protected time — soft, not hard:** the `protected: true` flag on `calendarEvents` is a *default warning*, not a lock. Every new task or event carries a `bypassProtected: boolean` (surfaced as a toggle right in the capture flow) — on, it schedules without asking; off (the default), the app just checks before letting something land in that window. The blocks themselves (`day`, `start`, `end`, `label`) are user-editable data, not hardcoded — add, edit, or delete them from **Settings**.

**Reminders / Notification Center vs. Settings:** Reminders is a first-class navigation tab and the Notification Center can also be reached from Insights. It is about *what already happened / what's about to* (a feed + per-category on/off toggles: task reminders, calendar alerts, weekly review nudge, journal streak, goal milestones). Settings is about *configuration* (appearance, protected time blocks, calendar management shortcut, account). In Firestore: `users/{uid}.notificationPrefs: {...}` and the `protectedBlocks` collection already described above.

**Reminders/alerts:** each task's `reminders: [{ offsetMinutes }]` array (already in the model above) drives **Firebase Cloud Messaging** push notifications — a Cloud Function runs on a schedule, finds tasks whose reminder time has arrived, and pushes a notification to whichever devices you're logged into (phone, iPad, laptop via web push). No separate reminders system to maintain — it's the same task data, just watched.

**Tasks without goals:** `goalId` on a task is nullable by design (see model above) — a task only needs an `areaId`. Goals are an optional organizing layer on top, never a requirement to capture something.

**Scheduled subtasks:** subtasks may optionally carry their own `dueDate` and `dueTime`. A dated subtask remains structurally owned by its parent task, but it also appears as an actionable item in Today/upcoming views and on Calendar according to the subtask's own date. Calendar and task-list presentations must identify the parent task so the subtask never appears detached from its larger outcome. Completing the subtask from any surface updates the same embedded subtask record. Undated subtasks remain visible only within their parent task. Subtasks inherit the parent task's Area and Goal rather than duplicating those fields.


**Theme:** `users/{uid}.theme: "light" | "dark" | "system"` — stored once, applied instantly on load via CSS custom properties (exactly how the prototype does it), so it's consistent across phone/iPad/laptop without a flash of the wrong theme.

**Quick Links (Iron Log / Trophé):** `users/{uid}.quickLinks: [{ name, url, icon }]` — trivial to store, and intentionally *not* an iframe embed; both are your own separate apps, so a tappable link out is more honest than trying to nest them inside this one.

---


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
  linkedTaskIdsByStep: { [stepIndex]: [taskId, ...] }
  linkedEventIdsByStep: { [stepIndex]: [eventId, ...] }   // durable backend target
  startedAt
  completedAt
```

The current prototype persists this workspace and its completion history in localStorage. When the rest of Abide's core data moves to Firestore, these records should move to the `reviews` collection above without changing the user-facing workflow.

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

### Weekly review methodology

The Weekly Review keeps GTD's **Get Clear → Get Current → Get Creative** sequence, then deliberately adds an unhurried planning layer:

- **Arrive:** become present before planning; clarity is the goal, not maximum output.
- **Get Clear:** collect inputs, process capture points, and do a mind sweep.
- **Get Current:** review the previous calendar, upcoming calendar, open actions, waiting-fors, goals/outcomes, and ensure active work has a next action.
- **Protect the Pace:** confirm protected time and Sabbath/rest rhythms, identify overload, leave buffers, and explicitly choose what will *not* be done.
- **Get Creative:** review Someday/Maybe and allow quieter ideas to surface.
- **Commit:** name no more than three meaningful weekly outcomes and stop planning once the system is trustworthy.

### Monthly Prep methodology

Monthly Prep is primarily forward-looking. A brief look back exists only to inform the month ahead:

- **Close briefly:** notice what moved, what remains open, and what should not be carried forward.
- **Clear the deck:** process stale open loops, waiting-fors, and uncaptured commitments.
- **Survey the next 4–6 weeks:** treat the calendar as the hard landscape and identify preparation, travel, deadlines, heavy weeks, and recovery needs.
- **Review Areas:** scan responsibilities and relationships so planning is not driven only by urgency.
- **Choose up to three outcomes:** name the few results that deserve disproportionate attention this month.
- **Define next actions:** every active outcome gets a real next physical action in the canonical task/calendar system.
- **Review Rule-of-Life rhythms:** daily, weekly, and monthly practices may be spiritual or ordinary; the purpose is to arrange life intentionally rather than reactively.
- **Subtract and protect:** stop, pause, simplify, delegate, or decline; protect rest and unscheduled margin before adding optional volume.
- **Commit:** enter the month with a trustworthy system, visible rhythms, and flexibility for reality to change.

This design intentionally combines GTD's trusted-system discipline with Abide's existing principle that hurry should not become the governing logic of the schedule.



## 4.6 Transitional cross-device sync bridge

Before the feature-by-feature Firestore normalization is complete, Abide uses an authenticated real-time sync bridge so the existing application can work across laptop, phone, and tablet without rewriting every feature at once.

### Authentication

Firebase Authentication is the identity boundary. A person signs into the same Abide account on each device. Firestore rules restrict every sync document to `request.auth.uid == userId`.

### Transitional state shape

```text
users/{uid}/syncState/{encodedLocalStateKey}
  key
  value
  deviceId
  updatedAt
```

The bridge intentionally preserves the existing `usePersistentState` feature code during this transition. On first sign-in:

1. If a cloud state key already exists, the cloud version wins.
2. If the cloud key does not exist, the current device uploads its existing local value.
3. After initialization, local changes are written to Firestore and Firestore changes from another device are applied locally.
4. Because the legacy state hooks read localStorage at mount time, a remote update triggers a small page reload so every existing feature receives the new state consistently.

This is an intermediate migration layer, not the final normalized database. The long-term collections already defined in this architecture (`tasks`, `goals`, `journalEntries`, `reviews`, etc.) remain the target data model.

### Explicit exclusions

- Scratchbook drawings are not mirrored into Firestore state documents because base64 drawing data can exceed Firestore's document-size limit. Scratchbook cross-device sync must use Firebase Storage plus Firestore metadata as already specified above.
- Google OAuth access tokens remain device/session-local and are never written to Firestore.
- Device notification-fired history and one-time migration flags remain device-local.

This bridge makes core Abide data (tasks, Areas, goals, journal entries, review workspace/history, protected time, preferences, and other normal JSON state) available across signed-in devices immediately while the normalized Firestore migration continues safely.


## 5. Tech stack (matches what you already run)

- **Frontend:** React + Vite, deployed as a installable **PWA** — "Add to Home Screen" gets you a full-screen, icon-on-homescreen app on iPhone and iPad with zero App Store friction, and it's the same shell on your laptop in a browser tab. (Native wrap via Capacitor is a viable later step if you ever want push notifications beyond what web push allows on iOS.)
- **Backend:** Firebase — **Auth** (just you + Beth, so simple email/passkey auth is enough), **Firestore** for data, **Cloud Functions** for recurrence generation + nightly streak/insight rollups, **Cloud Messaging** for reminders.
- **Charts:** Recharts (as in the prototype).
- **Hosting/CI:** GitHub repo → Firebase Hosting, deploy on push to `main` via GitHub Actions.

---

## 6. Suggested build order

1. **Repo scaffold + Firebase project + Auth** — you, logged in, empty shell deployed.
2. **Tasks CRUD against Firestore** — capture, edit, complete, delete; this alone should already feel better than juggling five apps.
3. **Areas + Goals + Milestones** — the structure layer.
4. **Recurrence engine (Cloud Function)** — this is the trickiest backend piece; worth its own focused session.
5. **Google Calendar two-way sync.**
6. **Time with the Lord journal** — its own simple CRUD, deliberately built after the task engine so it doesn't get treated as "just another task type."
7. **Insights** — once you have a few weeks of real completion data to chart.
8. **Weekly Review flow** — the GTD engine that keeps the whole system trustworthy long-term.

This is a real multi-week build, not a single-session one — happy to keep going right now on whichever piece you want first (I'd lean toward #1–2, since everything else depends on it), or this is also a great point to hand off to **Claude Code**, since from here it's mostly file-by-file implementation work against the repo rather than more prototyping.
