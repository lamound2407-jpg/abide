import ImportTasksPanel from "./ImportTasksPanel.jsx";
import WorkspaceEditor from "./blockWorkspace/WorkspaceEditor.jsx";
import {
  normalizeWorkspaceBlocks,
  workspaceBlocksToHtml,
  workspaceBlocksToPlainText,
  workspaceBlockReferences,
} from "./blockWorkspace/contentBridge.js";
import {
  AbideCommandLayer,
  sendToNotesAndOfferOpen,
  extractAbideReferences,
} from "./ConnectedSystem.jsx";
import {
  disableBackgroundPush,
  enableBackgroundPush,
  getBackgroundPushStatus,
} from "./pushNotifications.js";
import { registerSW } from "virtual:pwa-register";
import packageInfo from "../package.json";
import ReportBuilder, { JournalFavoriteDock } from "./ReportBuilder.jsx";
import { auth, db } from "./firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
} from "firebase/auth";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import {
  ListTodo, CalendarDays, Target, BookOpen, BarChart3, Plus, X,
  Flag, Repeat, ChevronRight, ChevronDown, ChevronLeft, Flame, TrendingUp,
  Check, Clock, Pencil, Sparkles, Filter, PenTool, Type, Trash2,
  RefreshCw, ShieldCheck, Archive, Bell, SlidersHorizontal, Sun, Moon,
  Dumbbell, Salad, ExternalLink, Search, Settings as SettingsIcon,
  Maximize2, Minimize2, Undo2, Redo2, LifeBuoy, Download
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, PieChart, Pie, Cell, Tooltip
} from "recharts";

/* ---------------------------------------------------------------
   THEME TOKENS
----------------------------------------------------------------*/
const THEME = {
  dark: {
    pageBg: "#05070C", appBg: "#0B0F19", shadow: "0 0 0 8px #05070C, 0 20px 60px rgba(0,0,0,0.5)",
    card: "#141A28", cardBorder: "rgba(255,255,255,0.05)",
    text: "#F7F6F1", text2: "#8E97A8", text3: "#6E7686",
    body: "#C5CAD3", body2: "#D8DAE0",
    pillBg: "rgba(255,255,255,0.06)", pillBorder: "rgba(255,255,255,0.1)",
    inputBg: "rgba(255,255,255,0.05)", inputBorder: "rgba(255,255,255,0.08)",
    track: "rgba(255,255,255,0.08)", divider: "rgba(255,255,255,0.055)",
    subtleBg: "rgba(255,255,255,0.02)", tabbarBg: "rgba(15,19,30,0.86)",
    segActive: "#2A3245", protectedText: "#B7CBB2", emptyHeat: "rgba(255,255,255,0.05)",
  },
  light: {
    pageBg: "#DEDBD1", appBg: "#FAF9F5", shadow: "0 0 0 8px #DEDBD1, 0 20px 50px rgba(30,25,15,0.18)",
    card: "#FFFFFF", cardBorder: "rgba(20,20,25,0.07)",
    text: "#1C1F27", text2: "#65697A", text3: "#8B8F9C",
    body: "#3A3F4C", body2: "#2B2F3A",
    pillBg: "rgba(20,20,30,0.045)", pillBorder: "rgba(20,20,30,0.1)",
    inputBg: "rgba(20,20,30,0.035)", inputBorder: "rgba(20,20,30,0.1)",
    track: "rgba(20,20,30,0.08)", divider: "rgba(20,20,30,0.07)",
    subtleBg: "rgba(20,20,30,0.025)", tabbarBg: "rgba(255,255,255,0.85)",
    segActive: "#EDEBE4", protectedText: "#41603E", emptyHeat: "rgba(20,20,30,0.06)",
  },
};

const APP_NAME = "Abide";
const APP_VERSION = packageInfo.version;
const APP_BUILD_DATE = __APP_BUILD_DATE__;

const GOOGLE_CALENDAR_START_ENDPOINT =
  "https://us-central1-abide-809d9.cloudfunctions.net/googleCalendarStart";

const GOOGLE_CALENDAR_TOKEN_ENDPOINT =
  "https://us-central1-abide-809d9.cloudfunctions.net/googleCalendarToken";

const GOOGLE_CALENDAR_DISCONNECT_ENDPOINT =
  "https://us-central1-abide-809d9.cloudfunctions.net/googleCalendarDisconnect";


const PRIMARY_NAV_DESTINATIONS = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "review", label: "Review", icon: RefreshCw },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "scratch", label: "Notes", icon: PenTool },
  { id: "goals", label: "Goals", icon: Target },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "insights", label: "Insights", icon: BarChart3 },
];

const MAX_PRIMARY_NAV = 7;

const DEFAULT_PRIMARY_NAV = [
  "calendar",
  "review",
  "journal",
  "scratch",
];

function normalizePrimaryNav(value) {
  const validIds = new Set(
    PRIMARY_NAV_DESTINATIONS.map(
      (destination) => destination.id
    )
  );

  const next = [];

  if (Array.isArray(value)) {
    value.forEach((id) => {
      if (
        typeof id === "string" &&
        validIds.has(id) &&
        !next.includes(id) &&
        next.length < MAX_PRIMARY_NAV
      ) {
        next.push(id);
      }
    });
  }

  if (!next.length) {
    DEFAULT_PRIMARY_NAV.forEach((id) => {
      if (
        validIds.has(id) &&
        !next.includes(id) &&
        next.length < MAX_PRIMARY_NAV
      ) {
        next.push(id);
      }
    });
  }

  return next.slice(
    0,
    MAX_PRIMARY_NAV
  );
}

const MICROSOFT_CLIENT_ID =
  import.meta.env.VITE_MICROSOFT_CLIENT_ID ||
  "db533aef-a678-412d-bb74-b1774bc24c7f";

const MICROSOFT_CALENDAR_SCOPES = [
  "User.Read",
  "Calendars.ReadWrite",
];

const microsoftAuth = new PublicClientApplication({
  auth: {
    clientId: MICROSOFT_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
  },
  cache: {
    // Keep Microsoft authentication across Abide reloads,
    // PWA updates, tab closes, and normal browser restarts.
    cacheLocation: "localStorage",
  },
});

const microsoftAuthReady = microsoftAuth.initialize();

let pwaUpdateAvailable = false;
let pwaUpdateSW = null;
let pwaUpdateRegistration = null;
const pwaUpdateListeners = new Set();

function emitPwaUpdateState() {
  pwaUpdateListeners.forEach((listener) => listener(pwaUpdateAvailable));
}

function initPwaUpdateRegistration() {
  if (
    pwaUpdateSW ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) return;

  pwaUpdateSW = registerSW({
    immediate: true,

    onNeedRefresh() {
      pwaUpdateAvailable = true;
      emitPwaUpdateState();
    },

    onRegisteredSW(_swUrl, registration) {
      pwaUpdateRegistration = registration || null;

      registration?.update().catch(() => {});

      window.setInterval(() => {
        registration?.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
  });
}

async function checkForPwaUpdate() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) return false;

  initPwaUpdateRegistration();

  let registration = pwaUpdateRegistration;

  if (!registration) {
    try {
      registration = await navigator.serviceWorker.getRegistration();
      pwaUpdateRegistration = registration || null;
    } catch {}
  }

  if (!registration) return false;

  try {
    await registration.update();
  } catch {}

  pwaUpdateAvailable = Boolean(registration.waiting);

  if (!pwaUpdateAvailable) {
    emitPwaUpdateState();
  }

  return pwaUpdateAvailable;
}

function usePwaUpdateStatus() {
  const [available, setAvailable] = useState(pwaUpdateAvailable);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    initPwaUpdateRegistration();

    const listener = (next) => setAvailable(next);
    pwaUpdateListeners.add(listener);

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        checkForPwaUpdate().catch(() => {});
      }
    };

    const checkWhenFocused = () => {
      checkForPwaUpdate().catch(() => {});
    };

    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("focus", checkWhenFocused);

    checkForPwaUpdate().catch(() => {});

    return () => {
      pwaUpdateListeners.delete(listener);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("focus", checkWhenFocused);
    };
  }, []);

  const checkNow = async () => {
    setChecking(true);
    setMessage("Checking for updates…");

    await checkForPwaUpdate();

    window.setTimeout(() => {
      setAvailable(pwaUpdateAvailable);
      setMessage(
        pwaUpdateAvailable
          ? "A newer version of Abide is ready."
          : "Update check complete."
      );
      setChecking(false);
    }, 1200);
  };

  const updateNow = async () => {
    setMessage("Updating Abide…");

    let registration = pwaUpdateRegistration;

    if (!registration) {
      try {
        registration = await navigator.serviceWorker.getRegistration();
        pwaUpdateRegistration = registration || null;
      } catch {}
    }

    const waitingWorker = registration?.waiting;

    if (waitingWorker) {
      let reloaded = false;

      const reloadOnce = () => {
        if (reloaded) return;
        reloaded = true;
        pwaUpdateAvailable = false;
        emitPwaUpdateState();
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });

      try {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      } catch {}

      window.setTimeout(reloadOnce, 1800);
      return;
    }

    if (pwaUpdateSW) {
      try {
        await pwaUpdateSW(true);
        window.setTimeout(() => window.location.reload(), 800);
        return;
      } catch {}
    }

    window.location.reload();
  };

  return {
    available,
    checking,
    message,
    checkNow,
    updateNow,
  };
}

function PwaUpdateBanner() {
  const { available, updateNow } = usePwaUpdateStatus();

  if (!available) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 86,
        width: "min(92vw, 420px)",
        zIndex: 9999,
        background: "var(--card)",
        border: "1px solid rgba(232,180,92,0.45)",
        boxShadow: "0 14px 40px rgba(0,0,0,0.32)",
        borderRadius: 15,
        padding: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          Update available
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text3)",
            marginTop: 2,
          }}
        >
          A newer version of Abide is ready.
        </div>
      </div>

      <div
        className="filter-chip active"
        style={{ flexShrink: 0 }}
        onClick={updateNow}
      >
        <RefreshCw size={12} />
        Update now
      </div>
    </div>
  );
}

const styles = `
  /* ABIDE NOTION DEPTH */

  .abide-command-overlay {
    overscroll-behavior: contain;
    scrollbar-width: none;
  }

  .abide-command-overlay::-webkit-scrollbar {
    display: none;
  }

  .abide-command-result {
    transition:
      background 100ms ease,
      transform 100ms ease;
  }

  .abide-command-result:active {
    transform: scale(.995);
  }

  .abide-mention[data-abide-type="date"],
  .abide-mention[data-abide-type="datetime"],
  .abide-mention[data-abide-type="time"] {
    background: rgba(124,147,201,.13);
    border-color: rgba(124,147,201,.25);
  }

  .abide-mention[data-abide-type="reminder"] {
    background: rgba(232,180,92,.11);
    border-color: rgba(232,180,92,.28);
  }


  /* ABIDE CONNECTED SYSTEM */

  .tabbar {
    overflow-x: auto !important;
    overflow-y: hidden !important;
    justify-content: flex-start !important;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .tabbar::-webkit-scrollbar {
    display: none;
  }

  .tab-item {
    flex: 0 0 68px !important;
    min-width: 68px !important;
  }

  .abide-mention {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    border-radius: 6px;
    padding: 1px 4px;
    margin: 0 1px;
    background: rgba(124,147,201,.13);
    border: 1px solid rgba(124,147,201,.22);
    color: var(--text);
    font-weight: 650;
    cursor: pointer;
  }

  .abide-command-overlay {
    position: fixed;
    z-index: 30000;
    max-height: min(52vh, 440px);
    overflow-y: auto;
    background: var(--card);
    border: 1px solid var(--pillBorder);
    border-radius: 14px;
    box-shadow: 0 18px 52px rgba(0,0,0,.30);
    padding: 6px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
      "SF Pro Display", system-ui, sans-serif;
  }

  .abide-command-result {
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--text);
    padding: 9px 10px;
    border-radius: 10px;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .abide-command-result:hover,
  .abide-command-result.active {
    background: var(--pillBg);
  }

  .abide-command-result-title {
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.3;
  }

  .abide-command-result-meta {
    font-size: 10.5px;
    color: var(--text3);
    line-height: 1.35;
    margin-top: 2px;
  }


  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .app { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif; background: var(--appBg); color: var(--text); width: 100%; max-width: 430px; margin: 0 auto; height: 100vh; min-height: 100vh; border-radius: 0; overflow: hidden; position: relative; box-shadow: none; display: flex; flex-direction: column; }
  .statusbar { height: calc(30px + env(safe-area-inset-top, 0px)); flex-shrink:0; position:relative; display:flex; align-items:flex-end; justify-content:space-between; padding: env(safe-area-inset-top, 0px) 18px 0; }
  .brand { display:flex; align-items:center; gap:8px; min-width:0; }
  .brand-mark { width:28px; height:28px; border-radius:8px; object-fit:cover; display:block; box-shadow:0 2px 10px rgba(0,0,0,0.22); }
  .brand-word { font-size:12px; font-weight:700; color:var(--text2); letter-spacing:1.25px; }
  .theme-toggle { width:28px; height:28px; border-radius:50%; background: var(--pillBg); display:flex; align-items:center; justify-content:center; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 18px 24px 18px; }
  .scroll::-webkit-scrollbar { display: none; }
  .phone-content { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

  .header { padding: 8px 18px 6px 18px; flex-shrink: 0; display:flex; align-items:flex-start; justify-content:space-between; }
  .eyebrow { font-size: 13px; color: var(--text2); font-weight: 500; letter-spacing: 0.2px; }
  .largetitle { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; color: var(--text); margin-top: 2px; }
  .header-actions { display:flex; gap:8px; margin-top:6px; }
  .header-btn { cursor:pointer; width:34px; height:34px; border-radius:10px; background: var(--pillBg); display:flex; align-items:center; justify-content:center; position:relative; }
  .header-btn .dot-badge { position:absolute; top:-2px; right:-2px; width:8px; height:8px; border-radius:50%; background:#E68080; border:1.5px solid var(--appBg); }
  .back-row { display:flex; align-items:center; gap:4px; color: var(--text2); font-size:14px; font-weight:600; cursor:pointer; padding: 2px 0 4px 0; }

  .capture-bar { display: flex; align-items: center; gap: 10px; background: var(--pillBg); border: 1px solid var(--pillBorder); border-radius: 14px; padding: 11px 14px; margin: 14px 0 14px 0; color: var(--text2); font-size: 15px; }

  .filter-row { display:flex; gap:7px; overflow-x:auto; padding: 2px 0 12px 0; align-items:center; }
  .filter-row::-webkit-scrollbar { display:none; }
  .filter-chip { flex-shrink:0; font-size: 12.5px; font-weight: 600; padding: 7px 12px; border-radius: 20px; border: 1px solid var(--pillBorder); color: var(--text2); background: var(--pillBg); display:flex; align-items:center; gap:5px; white-space:nowrap; cursor:pointer; }
  .filter-chip.active { background: #E8B45C; color: #14100A; border-color:#E8B45C; }
  .filter-chip .x { opacity:0.7; margin-left:2px; }

  .filter-builder, .composer-card { padding:14px; margin-bottom:12px; }
  .import-drop { border:1px dashed var(--pillBorder); background:var(--subtleBg); border-radius:14px; padding:20px 16px; text-align:center; cursor:pointer; }
  .import-drop-title { font-size:14px; font-weight:700; color:var(--text); }
  .import-drop-copy { font-size:11.5px; line-height:1.5; color:var(--text3); margin-top:6px; }
  .import-textarea { width:100%; min-height:180px; resize:vertical; border:1px solid var(--inputBorder); background:var(--inputBg); color:var(--text); border-radius:12px; padding:12px; font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; outline:none; }
  .import-summary { margin-top:12px; padding:12px; border:1px solid var(--pillBorder); background:var(--subtleBg); border-radius:12px; }
  .import-stat-row { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .import-error { font-size:11.5px; line-height:1.45; color:#E68080; margin-top:6px; }
  /* Fresh responsive task/event editor popup */
  .modal-backdrop { position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; padding:max(16px, env(safe-area-inset-top, 0px)) 14px max(16px, env(safe-area-inset-bottom, 0px)); background:rgba(2,5,10,0.72); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); overflow:hidden; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif; }
  .task-editor-modal { width:min(92vw,560px); max-height:min(78dvh,760px); margin:0!important; padding:0!important; display:flex; flex-direction:column; overflow:hidden!important; border-radius:24px!important; border:1px solid var(--pillBorder)!important; background:var(--card)!important; color:var(--text)!important; box-shadow:0 30px 100px rgba(0,0,0,0.58); font-family:inherit; }
  .editor-shell { display:flex; flex-direction:column; min-height:0; max-height:inherit; width:100%; overflow:hidden; }
  .editor-header { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:16px 18px 13px; background:var(--card); border-bottom:1px solid var(--divider); }
  .editor-title { font-size:16px; font-weight:750; color:var(--text); letter-spacing:-0.1px; }
  .editor-close { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:var(--pillBg); color:var(--text2); cursor:pointer; }
  .editor-scroll { flex:1; min-height:0; width:100%; max-width:100%; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; touch-action:pan-y; padding:14px 18px 18px; }
  .editor-scroll::-webkit-scrollbar { display:none; }
  .task-editor-modal input,
  .task-editor-modal textarea,
  .task-editor-modal button,
  .task-editor-modal select,
  .task-editor-modal .filter-chip,
  .task-editor-modal .fb-label,
  .task-editor-modal .activity-item {
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif;
  }
  .task-editor-modal input,
  .task-editor-modal textarea { min-width:0; max-width:100%; }
  .task-editor-modal .filter-row { max-width:100%; }
  .editor-footer { flex-shrink:0; display:flex; gap:8px; padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px)); background:var(--card); border-top:1px solid var(--divider); }
  .editor-delete { margin-top:10px; justify-content:center; color:#E68080; border-color:#E6808055; }
  .activity-list { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
  .activity-item { border:1px solid var(--pillBorder); background:var(--subtleBg); border-radius:12px; padding:10px 11px; }
  .activity-time { font-size:10.5px; color:var(--text3); margin-bottom:4px; }
  .activity-text { font-size:13px; line-height:1.45; color:var(--body2); white-space:pre-wrap; overflow-wrap:anywhere; }
  .activity-compose { display:flex; gap:8px; align-items:flex-end; margin-top:8px; }
  .activity-compose .notes-box { margin:0; min-height:64px; }
  @media (max-width:520px) { .modal-backdrop { padding:max(12px, env(safe-area-inset-top,0px)) 10px max(12px, env(safe-area-inset-bottom,0px)); } .task-editor-modal { width:92vw; max-height:74dvh; border-radius:22px!important; } .editor-header { padding:14px 14px 11px; } .editor-scroll { padding:12px 14px 14px; } .editor-footer { padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px)); } }
  .quick-area-create { margin-top:8px; padding:10px; border:1px solid var(--pillBorder); background:var(--subtleBg); border-radius:12px; }
  .notification-status { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; }
  .fb-label { font-size:11.5px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color: var(--text3); margin: 10px 0 7px 0; }
  .fb-label:first-child { margin-top:0; }

  .section-label { font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); margin: 22px 4px 8px 4px; display:flex; align-items:center; justify-content:space-between; gap:6px; }

  .card { background: var(--card); border: 1px solid var(--cardBorder); border-radius: 16px; overflow: hidden; }
  .card-text-pad { padding: 14px; }
  .card > .insight-line:only-child { padding: 14px; }
  .card > .empty-state:only-child { padding: 14px; }
  .card > .insight-line:first-child:last-child { padding: 14px; }
  .insights-card-pad { padding: 14px; }

  .task-row { display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px; border-bottom: 1px solid var(--divider); cursor: pointer; }
  .task-row:last-child { border-bottom: none; }
  .checkbox { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; margin-top: 1px; border: 1.5px solid var(--text3); display: flex; align-items: center; justify-content: center; }
  .checkbox.done { background: #E8B45C; border-color: #E8B45C; }
  .task-title { font-size: 15.5px; color: var(--text); font-weight: 500; line-height: 1.3; }
  .task-title.done { color: var(--text3); text-decoration: line-through; }
  .task-meta { display: flex; align-items: center; gap: 8px; margin-top: 5px; flex-wrap: wrap; }
  .chip { font-size: 11.5px; font-weight: 600; padding: 3px 8px; border-radius: 7px; display: inline-flex; align-items: center; gap: 4px; }
  .time-chip { font-size: 12px; color: var(--text2); display:flex; align-items:center; gap:3px; }

  .task-detail { padding: 4px 14px 16px 48px; background: var(--subtleBg); }
  .field-row { display:flex; align-items:center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--divider); font-size: 13.5px; }
  .field-row:last-child{border-bottom:none;}
  .field-label { color: var(--text2); }
  .field-value { color: var(--text); font-weight: 500; display:flex; align-items:center; gap:5px; }
  .notes-box { width: 100%; background: var(--inputBg); border: 1px solid var(--inputBorder); border-radius: 10px; padding: 10px; color: var(--text); font-size: 13.5px; margin-top: 8px; font-family: inherit; resize: none; }

  .tabbar {
    position: relative;

    z-index: 80;

    flex: 0 0 auto;
    flex-shrink: 0;

    width: 100%;

    height:
      calc(
        64px +
        env(
          safe-area-inset-bottom,
          0px
        )
      );

    padding:
      9px 0
      env(
        safe-area-inset-bottom,
        0px
      );

    background:
      var(--appBg);

    border: 0;

    border-top:
      1px solid
      var(--divider);

    border-radius: 0;

    box-shadow: none;

    backdrop-filter: none;
    -webkit-backdrop-filter: none;

    display: flex;

    align-items:
      flex-start;
  }
  .tab { cursor:pointer; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text3); }
  .tab.active { color: #E8B45C; }
  .tab span { font-size: 9.5px; font-weight: 600; }

  .fab { cursor:pointer; position: absolute; z-index: 82; right: 20px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(155deg, #E8B45C, #D69A3A); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(232,180,92,0.35); border: none; color: #14100A; }

  .segmented { display: flex; background: var(--pillBg); border-radius: 10px; padding: 3px; margin: 12px 0; }
  .seg-btn { flex: 1; text-align: center; padding: 7px 0; font-size: 12.5px; font-weight: 600; color: var(--text2); border-radius: 8px; cursor:pointer; }
  .seg-btn.active { background: var(--segActive); color: var(--text); }

  .weekstrip { display: flex; justify-content: space-between; margin: 4px 0 16px 0; }
  .daypill { display:flex; flex-direction:column; align-items:center; gap:6px; width: 40px; padding: 8px 0; border-radius: 14px; cursor:pointer; }
  .daypill .dow { font-size: 11px; color: var(--text3); font-weight:600; }
  .daypill .num { font-size: 15px; color: var(--text); font-weight: 600; width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%; }
  .daypill.selected .num { background: #E8B45C; color: #14100A; }
  .daypill .dot { width:4px; height:4px; border-radius:50%; background:#E8B45C; margin-top:1px; }

  .goal-card { padding: 16px; margin-bottom: 12px; }
  .goal-title-row { display:flex; align-items:center; justify-content: space-between; }
  .goal-name { font-size: 16px; font-weight: 700; color: var(--text); }
  .goal-actions { display:flex; gap:8px; }
  .progress-track { height: 7px; border-radius: 4px; background: var(--track); margin-top: 12px; overflow:hidden; }
  .progress-fill { height: 100%; border-radius: 4px; }
  .milestone-row { display:flex; align-items:center; gap:8px; margin-top:10px; font-size: 13px; color: var(--body); cursor:pointer; }
  .milestone-row .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .milestone-chip { display:inline-flex; align-items:center; gap:6px; background: var(--pillBg); border:1px solid var(--pillBorder); border-radius:16px; padding:6px 10px; font-size:12.5px; color: var(--text); margin: 3px 5px 3px 0; }

  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .stat-card { background: var(--card); border: 1px solid var(--cardBorder); border-radius: 14px; padding: 14px; }
  .stat-num { font-size: 24px; font-weight: 700; color: var(--text); }
  .stat-label { font-size: 11.5px; color: var(--text2); margin-top: 2px; }

  .heat-row { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 10px; }
  .heat-cell { width: 16px; height: 16px; border-radius: 4px; }

  .journal-compose { padding: 14px; }
  .tag-row { display:flex; gap:6px; flex-wrap: wrap; margin-top: 10px; }
  .tag-swatch { width: 26px; height: 26px; border-radius: 8px; border: 2px solid transparent; cursor:pointer; }
  .tag-swatch.selected { border-color: var(--text); }
  .journal-entry { padding: 14px; border-bottom: 1px solid var(--divider); }
  .journal-entry:last-child{border-bottom:none;}
  .verse-badge { font-size: 12px; font-weight: 700; color: #14100A; padding: 3px 9px; border-radius: 7px; display:inline-block; }
  .entry-actions { display:flex; gap:10px; }
  .entry-actions svg, .cap-icons svg { cursor:pointer; }
  .rich-toolbar { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:8px; background:var(--pillBg); border:1px solid var(--pillBorder); border-radius:10px 10px 0 0; }
  .rich-btn { min-width:30px; height:30px; padding:0 8px; border-radius:7px; border:1px solid var(--pillBorder); background:var(--inputBg); color:var(--text); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; cursor:pointer; }
  .rich-select { height:30px; border-radius:7px; border:1px solid var(--pillBorder); background:var(--inputBg); color:var(--text); padding:0 7px; font:inherit; font-size:12px; }
  .rich-editor { min-height:120px; padding:11px; border:1px solid var(--inputBorder); border-top:none; border-radius:0 0 10px 10px; color:var(--text); background:var(--inputBg); outline:none; font-size:14px; line-height:1.55; overflow-wrap:anywhere; }
  .rich-editor:empty:before { content: attr(data-placeholder); color: var(--text3); pointer-events:none; }
  .rich-output { font-size:14px; color:var(--body2); margin-top:8px; line-height:1.55; overflow-wrap:anywhere; }
  .subtask-row { display:flex; align-items:center; gap:8px; padding:7px 0; font-size:13px; color:var(--body); }
  .subtask-row input[type=checkbox] { accent-color:#E8B45C; }
  .repeat-config { display:grid; grid-template-columns:90px 1fr; gap:8px; align-items:center; margin-top:6px; }

  .insight-line { font-size: 13.5px; color: var(--body); line-height: 1.5; padding: 12px 14px; }

  .protected-block { border: 1.5px dashed #8FA88A; border-radius: 12px; padding: 12px; margin-bottom:10px; background: rgba(143,168,138,0.08); }
  .protected-block .row { display:flex; align-items:center; gap:10px; }
  .protected-block .t { font-size: 13.5px; font-weight: 600; color: var(--protectedText); }
  .protected-block .s { font-size: 11.5px; color: var(--text2); margin-top:2px; }
  .protected-block .override { font-size: 11.5px; color: #8FA88A; font-weight:700; margin-top:8px; cursor:pointer; }

  .gcal-badge { display:flex; align-items:center; gap:7px; font-size:12.5px; color: var(--text2); background: var(--pillBg); border-radius:10px; padding:8px 12px; margin-bottom:12px; justify-content:space-between; cursor:pointer; }
  .gcal-dot { width:7px;height:7px;border-radius:50%; background:#7CBE86; flex-shrink:0; }

  .cal-account { padding:14px; }
  .cal-account-title { font-size:12.5px; font-weight:700; color: var(--text2); margin-bottom:10px; }
  .cal-item, .settings-row { display:flex; align-items:center; justify-content:space-between; padding:11px 0; border-bottom:1px solid var(--divider); }
  .cal-item:last-child, .settings-row:last-child{border-bottom:none;}
  .cal-item-name, .settings-row-name { display:flex; align-items:center; gap:9px; font-size:13.5px; color: var(--text); }
  .cal-swatch { width:10px; height:10px; border-radius:3px; flex-shrink:0; }
  .toggle { cursor:pointer; width:40px; height:23px; border-radius:12px; background: var(--track); position:relative; flex-shrink:0; }
  .toggle.on { background:#E8B45C; }
  .toggle .knob { width:19px; height:19px; border-radius:50%; background:#fff; position:absolute; top:2px; left:2px; transition:left .15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .toggle.on .knob { left:19px; }
  .link-others { font-size:12.5px; color:#E8B45C; font-weight:600; margin-top:10px; cursor:pointer; }

  .input-line { width:100%; background: var(--inputBg); border: 1px solid var(--inputBorder); border-radius: 10px; padding: 10px 12px; color: var(--text); font-size: 14px; font-family: inherit; margin-top: 8px; }

  .scratch-canvas-wrap { border-radius: 14px; overflow:hidden; border: 1px solid var(--cardBorder); background:#F2F1EC; touch-action: none; }
  .scratch-toolbar { display:flex; align-items:center; justify-content:space-between; padding: 4px 2px 12px 2px; }
  .tool-btn { cursor:pointer; width:36px; height:36px; border-radius:10px; background: var(--pillBg); display:flex; align-items:center; justify-content:center; color: var(--text2); }
  .tool-btn.active { background:#E8B45C; color:#14100A; }
  .swatch-mini { cursor:pointer; width:22px; height:22px; border-radius:50%; border:2px solid transparent; }
  .swatch-mini.selected { border-color: var(--text); }
  .scratch-thumb { width:100%; aspect-ratio: 4/3; object-fit:cover; background:#F2F1EC; }
  .scratch-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px; }
  .scratch-item { border-radius:12px; overflow:hidden; border:1px solid var(--cardBorder); position:relative; }
  .scratch-item .cap { font-size:11px; color: var(--text2); padding:6px 8px; display:flex; justify-content:space-between; align-items:center; }
  .scratch-item .cap-icons { display:flex; gap:8px; }

  .review-item { display:flex; align-items:center; justify-content:space-between; padding: 11px 14px; border-bottom:1px solid var(--divider); font-size:13.5px; color: var(--body); }
  .review-item:last-child{border-bottom:none;}
  .review-count { background:rgba(232,180,92,0.18); color:#E8B45C; font-weight:700; font-size:12px; padding:2px 9px; border-radius:8px; }

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

  .link-card { display:flex; align-items:center; gap:12px; padding:14px; border-bottom:1px solid var(--divider); }
  .link-card:last-child{border-bottom:none;}
  .link-icon { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .link-name { font-size:14.5px; font-weight:600; color: var(--text); }
  .link-desc { font-size:12px; color: var(--text2); margin-top:2px; }
  .link-url-input { flex:1; background: var(--inputBg); border:1px solid var(--inputBorder); border-radius:8px; padding:7px 10px; color: var(--text); font-size:12.5px; margin-top:6px; width:100%; }

  .nav-row { display:flex; align-items:center; justify-content:space-between; padding:15px 14px; border-bottom:1px solid var(--divider); cursor:pointer; }
  .nav-row:last-child{border-bottom:none;}
  .nav-row-left { display:flex; align-items:center; gap:11px; }
  .nav-icon { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; }

  /* ---------------- iPad / Laptop shell (sidebar layout, no phone bezel) ---------------- */
  .shell { display:flex; width:100%; height:100%; min-height:0; background: var(--appBg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif; overflow:hidden; }
  .sidebar { display:flex; flex-direction:column; background: var(--card); border-right:1px solid var(--cardBorder); flex-shrink:0; height:100%; min-height:0; overflow-y:auto; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .sidebar-compact { width:88px; align-items:center; padding:20px 0 14px 0; }
  .sidebar-wide { width:238px; padding:24px 14px 16px 14px; }
  .sidebar-brand { font-weight:800; color:var(--text); margin-bottom:26px; display:flex; align-items:center; gap:10px; }
  .sidebar-brand-logo { width:38px; height:38px; border-radius:11px; object-fit:cover; display:block; box-shadow:0 5px 16px rgba(0,0,0,0.22); }
  .sidebar-brand-word { font-size:16px; letter-spacing:1.4px; color:var(--text); }
  .sidebar-compact .sidebar-brand { justify-content:center; }
  .sidebar-compact .sidebar-brand-logo { width:40px; height:40px; border-radius:12px; }
  .sidebar-compact .sidebar-brand-word { display:none; }
  .sidebar-wide .sidebar-brand { padding-left:8px; }
  .sidebar-nav { display:flex; flex-direction:column; gap:4px; flex:1; width:100%; }
  .sidebar-item { display:flex; align-items:center; gap:12px; color: var(--text3); padding:11px 14px; border-radius:10px; cursor:pointer; }
  .sidebar-item span { font-size:14px; font-weight:600; }
  .sidebar-item.active { background: var(--pillBg); color:#E8B45C; }
  .sidebar-compact .sidebar-item { flex-direction:column; gap:5px; padding:10px 6px; width:64px; }
  .sidebar-compact .sidebar-item span { font-size:9.5px; }
  .sidebar-footer { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; color: var(--text2); font-size:13px; font-weight:600; margin-top:10px; border-top: 1px solid var(--divider); padding-top:16px; }
  .sidebar-compact .sidebar-footer { flex-direction:column; padding:14px 4px 0 4px; }
  .shell-main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; position:relative; }
  .shell-fab { position:absolute; right:32px; bottom:calc(32px + env(safe-area-inset-bottom, 0px)); }

  .viewport-tablet .header, .viewport-desktop .header { padding-left:32px; padding-right:32px; padding-top:20px; }
  .viewport-tablet .scroll, .viewport-desktop .scroll { padding-left:32px; padding-right:32px; padding-bottom:calc(72px + env(safe-area-inset-bottom, 0px)); }
  .viewport-desktop .header, .viewport-desktop .scroll { max-width:960px; margin:0 auto; width:100%; box-sizing:border-box; }
  .viewport-tablet .largetitle { font-size:33px; }
  .viewport-desktop .largetitle { font-size:36px; }
  .viewport-phone { min-height: 100dvh; overflow: hidden; background: var(--appBg) !important; }
  .viewport-phone .app { max-width: none; height: 100%; border-radius: 0; box-shadow: none; }
  @supports not (height: 100dvh) { .viewport-phone { min-height: -webkit-fill-available; } }

  .viewport-tablet .stat-grid, .viewport-desktop .stat-grid { grid-template-columns: repeat(4, 1fr); }
  .viewport-tablet .scratch-grid, .viewport-desktop .scratch-grid { grid-template-columns: repeat(3, 1fr); }
  .viewport-desktop .goal-grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px; align-items:start; }
  .viewport-desktop .goal-grid .goal-card { margin-bottom:0; }
  .viewport-desktop .goal-grid .composer-card { grid-column: 1 / -1; }
`;

/* ---------------------------------------------------------------
   STARTER CONFIGURATION
----------------------------------------------------------------*/
const AREAS = {};

const TAGS = {
  yellow: { label: "Main Point", hex: "#E6C84D" },
  green: { label: "People / Places", hex: "#7CBE86" },
  pink: { label: "Cost / Tradeoff", hex: "#E086A0" },
  blue: { label: "Future-Facing", hex: "#6FA8DC" },
  orange: { label: "Command", hex: "#E5934A" },
};

const DEFAULT_HIGHLIGHT_MEANINGS = {
  yellow: {
    colorName: "Yellow",
    label: "Main Point",
    heading: "The point",
    displayHex: "#F4DE3D",
    description:
      "The single most important line — the one thing to remember. If you could keep only one sentence from the page, this is it.",
    examples:
      "Examples: the main idea of a chapter; the decision made in a meeting. Use sparingly — one or two peaks, not everything important.",
  },
  green: {
    colorName: "Green",
    label: "People / Places",
    heading: "Who & where",
    displayHex: "#5FD79A",
    description:
      "People, groups, and places. Use it when a name shows up or when you need to remember who owns something.",
    examples:
      "Examples: Peter, the Pharisees, Capernaum; Derek owns this.",
  },
  pink: {
    colorName: "Pink",
    label: "Cost / Tradeoff",
    heading: "The cost",
    displayHex: "#F76FA6",
    description:
      "The price tag — what gets given up, lost, risked, or sacrificed. Ask: “What’s the price here?”",
    examples:
      "Examples: Jesus dying on the cross; pulling Rachelle off the newsletter for a month. Pink is what it costs; orange/purple is what to do.",
  },
  blue: {
    colorName: "Blue / Aqua",
    label: "Future-Facing",
    heading: "What’s ahead",
    displayHex: "#5FC2D8",
    description:
      "Future promises, plans, deadlines, and what will happen. Ask: “Is this about later?”",
    examples:
      "Examples: God’s promise to Abraham; a project deadline. Blue is what will happen or is promised; orange/purple is what you need to do.",
  },
  orange: {
    colorName: "Orange / Purple",
    label: "Command",
    heading: "What to do",
    displayHex: "#F6A23C",
    secondaryHex: "#A98BE0",
    description:
      "An action, command, task, or to-do. Ask: “So what do I do?”",
    examples:
      "Examples: Love one another; I draft comms by Friday. Kindle uses orange and Apple uses purple for the same job.",
  },
};

function highlightMeaningFor(meanings, key) {
  return {
    ...(DEFAULT_HIGHLIGHT_MEANINGS[key] || {}),
    ...((meanings && meanings[key]) || {}),
  };
}

// Brand-new accounts start clean. Existing signed-in accounts hydrate their own
// saved state from Firebase before App renders.
const seedTasks = [];
const somedayTasks = [];
const seedGoals = [];
const seedJournal = [];

const ONBOARDING_STEPS = [
  {
    eyebrow: "WHY ABIDE EXISTS",
    title: "Abide before you achieve.",
    scripture: "John 15:4–5",
    copy: "Abide is built around a simple conviction: a fruitful life does not begin with doing more. It begins with remaining rooted in what matters.",
    detail: "The app helps you hold responsibilities faithfully without turning productivity into hurry. Tasks serve your life; your life does not serve the task list.",
  },
  {
    eyebrow: "CAPTURE",
    title: "Your mind is for noticing, not holding everything.",
    scripture: "1 Peter 5:7",
    copy: "When something needs your attention, capture it quickly instead of rehearsing it all day.",
    detail: "New thoughts can enter Abide before you know exactly where they belong. Clarify and organize them later. The goal is a trusted place where open loops can rest.",
  },
  {
    eyebrow: "TODAY",
    title: "Give today enough attention.",
    scripture: "Matthew 6:34",
    copy: "Today is intentionally bounded. Abide surfaces what needs attention now without constantly presenting every future responsibility at once.",
    detail: "Your Daily Brief calls out overdue, urgent, and important work while the rest of the system stays available when you choose to look for it.",
  },
  {
    eyebrow: "AREAS",
    title: "Tend the parts of life entrusted to you.",
    scripture: "Colossians 3:23",
    copy: "Areas are ongoing parts of life you care for — Family, Home, Work, Church, Personal, or whatever fits your season.",
    detail: "Unlike a project, an Area is rarely finished. It gives tasks and goals context so you can see what you are tending and where your attention is going.",
  },
  {
    eyebrow: "CALENDAR",
    title: "Let time tell the truth.",
    scripture: "Psalm 90:12",
    copy: "The Calendar shows the actual space your commitments occupy. Tasks with dates, events, and protected time live together so plans can meet reality.",
    detail: "Protected time is a guardrail, not a cage. Abide should help you preserve worship, rest, relationships, margin, and focused work rather than fill every available hour.",
  },
  {
    eyebrow: "REVIEW",
    title: "Reflect before adding more.",
    scripture: "Lamentations 3:40",
    copy: "A trusted system needs regular reflection. Weekly Review helps you clear loose ends, bring plans back to reality, and decide what actually belongs in the coming week.",
    detail: "The point is not perfect organization. It is enough clarity that you can stop mentally managing the system and return to living.",
  },
  {
    eyebrow: "TIME WITH THE LORD",
    title: "Some things should never become another checkbox.",
    scripture: "Psalm 46:10",
    copy: "Time with the Lord has its own space in Abide because prayer, Scripture, silence, and reflection are not productivity tasks.",
    detail: "Journal what you are learning, notice rhythms over time, and protect space to be present without measuring the moment by output.",
  },
  {
    eyebrow: "BEGIN",
    title: "Start small.",
    scripture: "Zechariah 4:10",
    copy: "You do not need to build your whole system today. Begin with one Area, capture what matters, and let Abide become trustworthy through use.",
    detail: "You can revisit this guide anytime from Settings → How Abide Works.",
    areaStep: true,
  },
];

const DAYS_OF_WEEK = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];
const WEEKDAY_OPTIONS = [
  { label: "Sunday", code: "SU" }, { label: "Monday", code: "MO" }, { label: "Tuesday", code: "TU" },
  { label: "Wednesday", code: "WE" }, { label: "Thursday", code: "TH" }, { label: "Friday", code: "FR" }, { label: "Saturday", code: "SA" },
];
const REPEAT_UNITS = ["None", "Daily", "Weekly", "Monthly", "Yearly"];
/* ---------------------------------------------------------------
   SHARED PIECES
----------------------------------------------------------------*/
function Header({ eyebrow, title, actions = [], onBack }) {
  return (
    <div className="header">
      <div>
        {onBack ? (
          <div className="back-row" onClick={onBack}><ChevronLeft size={16} />{eyebrow}</div>
        ) : (
          <div className="eyebrow">{eyebrow}</div>
        )}
        <div className="largetitle">{title}</div>
      </div>
      <div className="header-actions">
        {actions.map((a, i) => (
          <div key={i} className="header-btn" onClick={a.onClick}>
            <a.icon size={17} color={a.tint || "#E8B45C"} />
            {a.badge ? <span className="dot-badge" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return <div className={`toggle ${on ? "on" : ""}`} onClick={onClick}><div className="knob" /></div>;
}

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : (typeof initialValue === "function" ? initialValue() : initialValue);
    } catch {
      return typeof initialValue === "function" ? initialValue() : initialValue;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue];
}

const MORE_TAB_IDS = new Set(["goals", "reminders"]);

function navTabIsActive(currentTab, itemId) {
  return currentTab === itemId || (itemId === "more" && MORE_TAB_IDS.has(currentTab));
}

function PhoneQuickAccess({
  tab,
  setTab,
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    position,
    setPosition,
  ] =
    useState(() => {
      try {
        const saved =
          JSON.parse(
            localStorage.getItem(
              "abide-phone-quick-position"
            ) || "null"
          );

        if (
          saved &&
          Number.isFinite(saved.x) &&
          Number.isFinite(saved.y)
        ) {
          return saved;
        }
      } catch {}

      return {
        x:
          typeof window !==
          "undefined"
            ? window.innerWidth - 66
            : 320,

        y:
          typeof window !==
          "undefined"
            ? window.innerHeight - 185
            : 600,
      };
    });


  const dragRef =
    useRef(null);


  const clampPosition =
    (x, y) => {
      const width =
        window.innerWidth;

      const height =
        window.innerHeight;

      return {
        x:
          Math.max(
            12,
            Math.min(
              width - 58,
              x
            )
          ),

        y:
          Math.max(
            90,
            Math.min(
              height - 145,
              y
            )
          ),
      };
    };


  useEffect(
    () => {
      const handleResize =
        () => {
          setPosition(
            (current) =>
              clampPosition(
                current.x,
                current.y
              )
          );
        };

      window.addEventListener(
        "resize",
        handleResize
      );

      return () =>
        window.removeEventListener(
          "resize",
          handleResize
        );
    },
    []
  );


  const handlePointerDown =
    (event) => {
      const point = {
        id:
          event.pointerId,

        startX:
          event.clientX,

        startY:
          event.clientY,

        originX:
          position.x,

        originY:
          position.y,

        moved:
          false,
      };

      dragRef.current =
        point;

      event.currentTarget
        .setPointerCapture?.(
          event.pointerId
        );
    };


  const handlePointerMove =
    (event) => {
      const drag =
        dragRef.current;

      if (
        !drag ||
        drag.id !==
          event.pointerId
      ) {
        return;
      }

      const dx =
        event.clientX -
        drag.startX;

      const dy =
        event.clientY -
        drag.startY;

      if (
        Math.abs(dx) > 4 ||
        Math.abs(dy) > 4
      ) {
        drag.moved =
          true;
      }

      setPosition(
        clampPosition(
          drag.originX + dx,
          drag.originY + dy
        )
      );
    };


  const handlePointerUp =
    (event) => {
      const drag =
        dragRef.current;

      if (!drag) {
        return;
      }

      dragRef.current =
        null;

      const next =
        clampPosition(
          position.x,
          position.y
        );

      setPosition(next);

      try {
        localStorage.setItem(
          "abide-phone-quick-position",
          JSON.stringify(next)
        );
      } catch {}


      if (!drag.moved) {
        setOpen(
          (value) =>
            !value
        );
      }
    };


  const openDestination =
    (id) => {
      setTab(id);
      setOpen(false);
    };


  return (
    <div
      className={[
        "phone-quick-launcher",
        open
          ? "open"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left:
          `${position.x}px`,

        top:
          `${position.y}px`,
      }}
    >
      {open && (
        <div className="phone-quick-popover">
          <button
            type="button"
            className={
              tab === "scratch"
                ? "active scratch"
                : "scratch"
            }
            onClick={() =>
              openDestination(
                "scratch"
              )
            }
          >
            <PenTool
              size={17}
              strokeWidth={2.1}
            />

            <span>
              Notes
            </span>
          </button>

          <button
            type="button"
            className={
              tab === "insights"
                ? "active"
                : ""
            }
            onClick={() =>
              openDestination(
                "insights"
              )
            }
          >
            <BarChart3
              size={17}
              strokeWidth={2.1}
            />

            <span>
              Insights
            </span>
          </button>
        </div>
      )}


      <button
        type="button"
        className="phone-quick-orb"
        aria-label={
          open
            ? "Close Quick Access"
            : "Open Quick Access"
        }
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={() => {
          dragRef.current =
            null;
        }}
      >
        <PenTool
          size={19}
          strokeWidth={2.2}
        />
      </button>
    </div>
  );
}


function Sidebar({
  tabs,
  tab,
  setTab,
  viewport,
  theme,
  setTheme,
}) {
  const compact =
    viewport === "tablet";


  /*
   * Notes and Insights are important enough
   * to remain permanently discoverable without
   * overcrowding the main navigation.
   */
  const quickAccess =
    [
      PRIMARY_NAV_DESTINATIONS.find(
        (item) =>
          item.id ===
          "scratch"
      ),

      PRIMARY_NAV_DESTINATIONS.find(
        (item) =>
          item.id ===
          "insights"
      ),
    ].filter(Boolean);


  const mainTabs =
    tabs.filter(
      (item) =>
        item.id !== "scratch" &&
        item.id !== "insights"
    );


  const renderItem =
    (
      item,
      extraClass = ""
    ) => {
      const Icon =
        item.icon;

      const active =
        navTabIsActive(
          tab,
          item.id
        );

      return (
        <div
          key={item.id}
          className={[
            "sidebar-item",
            extraClass,
            active
              ? "active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() =>
            setTab(
              item.id
            )
          }
        >
          <Icon
            size={
              extraClass
                ? 18
                : 19
            }
            strokeWidth={
              active
                ? 2.35
                : 1.8
            }
          />

          <span>
            {item.label}
          </span>

          {item.id ===
            "scratch" && (
            <span className="sidebar-quick-badge">
              Write
            </span>
          )}

          {item.id ===
            "insights" && (
            <span className="sidebar-quick-dot" />
          )}
        </div>
      );
    };


  return (
    <div
      className={`sidebar ${
        compact
          ? "sidebar-compact"
          : "sidebar-wide"
      }`}
    >
      <div className="sidebar-brand"
  /* ABIDE SIDEBAR HOME LOGO V1 */
  role="button"
  tabIndex={0}
  aria-label="Go to Today"
  title="Go to Today"
  onClick={() => setTab("today")}
  onKeyDown={(event) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setTab("today");
    }
  }}
  style={{ cursor: "pointer" }}
>
        <img
          className="sidebar-brand-logo"
          src="/abide-logo.png"
          alt="Abide"
        />

        <span className="sidebar-brand-word">
          ABIDE
        </span>
      </div>


      <div className="sidebar-nav">
        {mainTabs.map(
          (item) =>
            renderItem(
              item
            )
        )}


        <div className="sidebar-quick-section">
          {!compact && (
            <div className="sidebar-quick-label">
              Quick Access
            </div>
          )}

          {quickAccess.map(
            (item) =>
              renderItem(
                item,
                item.id ===
                  "scratch"
                  ? "sidebar-quick-item sidebar-scratch-item"
                  : "sidebar-quick-item sidebar-insights-item"
              )
          )}
        </div>
      </div>


      <div
        className="sidebar-footer"
        onClick={() =>
          setTheme(
            theme === "dark"
              ? "light"
              : "dark"
          )
        }
      >
        {theme === "dark"
          ? (
            <Moon
              size={16}
              color="#E8B45C"
            />
          )
          : (
            <Sun
              size={16}
              color="#D69A3A"
            />
          )}

        <span>
          {theme === "dark"
            ? "Dark"
            : "Light"} Mode
        </span>
      </div>
    </div>
  );
}


/* =========================================================
   AREA QUICK NAV V1
   Reusable Area launcher for Today + Calendar.
   ========================================================= */

function AreaQuickNav({
  areas,
  label = "Areas",
}) {
  const entries =
    Object.entries(areas || {});

  if (!entries.length) {
    return null;
  }

  const openArea = (areaId) => {
    window.dispatchEvent(
      new CustomEvent(
        "abide:open-area",
        {
          detail: {
            areaId,
          },
        }
      )
    );
  };

  return (
    <div
      style={{
        marginBottom: 14,
      }}
    >
      <div
        className="section-label"
        style={{
          marginTop: 0,
        }}
      >
        <span>
          {label}
        </span>

        <span
          style={{
            fontWeight: 500,
            color: "var(--text3)",
          }}
        >
          Browse
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 3,
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {entries.map(
          ([id, area]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                openArea(id)
              }
              style={{
                appearance: "none",
                border:
                  "1px solid var(--pillBorder)",
                background:
                  "var(--pillBg)",
                color:
                  "var(--text)",
                borderRadius: 999,
                padding:
                  "8px 11px",
                display: "flex",
                alignItems:
                  "center",
                gap: 7,
                flexShrink: 0,
                cursor: "pointer",
                font: "inherit",
                fontSize: 11.5,
                fontWeight: 650,
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background:
                    area.color ||
                    "#9AA2B1",
                  boxShadow:
                    `0 0 0 3px ${
                      area.color ||
                      "#9AA2B1"
                    }18`,
                  flexShrink: 0,
                }}
              />

              {area.name}
            </button>
          )
        )}
      </div>
    </div>
  );
}


function TaskRow({
  task,
  expanded,
  onToggleExpand,
  onToggleDone,
  goals,
  areas = AREAS,
  onEdit,
  parentTask = null,
  childTasks = [],
}) {
  const area =
    task.area && areas[task.area]
      ? areas[task.area]
      : { name: "No Area", color: "#9AA2B1" };

  const goal = goals?.find((g) => g.id === task.goal);
  return (
    <div>
      <div className="task-row" onClick={() => onToggleExpand(task.id)}>
        <div className={`checkbox ${task.done ? "done" : ""}`} onClick={(e) => { e.stopPropagation(); onToggleDone(task.id); }}>
          {task.done && <Check size={13} color="#14100A" strokeWidth={3} />}
        </div>
        <div style={{ flex: 1 }}>
          <div className={`task-title ${task.done ? "done" : ""}`}>{task.title}</div>
          <div className="task-meta">
            <span
              className="chip"
              onClick={(event) => {
                event.stopPropagation();

                if (
                  task.area &&
                  areas[task.area]
                ) {
                  window.dispatchEvent(
                    new CustomEvent(
                      "abide:open-area",
                      {
                        detail: {
                          areaId:
                            task.area,
                        },
                      }
                    )
                  );
                }
              }}
              title={
                task.area &&
                areas[task.area]
                  ? `Open ${area.name}`
                  : undefined
              }
              style={{
                background:
                  area.color + "26",
                color:
                  area.color,
                cursor:
                  task.area &&
                  areas[task.area]
                    ? "pointer"
                    : "default",
              }}
            >
              {area.name}
            </span>

            {parentTask && (
              <span className="time-chip">
                Subtask of {parentTask.title}
              </span>
            )}

            <span
              className="chip"
              style={{
                background: taskProgress(task) === "completed"
                  ? "#8FA88A26"
                  : taskProgress(task) === "in_progress"
                    ? "#E8B45C26"
                    : "var(--pillBg)",
                color: taskProgress(task) === "completed"
                  ? "#8FA88A"
                  : taskProgress(task) === "in_progress"
                    ? "#E8B45C"
                    : "var(--text2)",
              }}
            >
              {taskProgressLabel(task)}
            </span>
            {taskOffsetDays(task) < 0 && !task.done && <span className="chip" style={{ background: "#E0707026", color: "#E68080" }}>Overdue</span>}
            <span className="time-chip"><Clock size={11} />{task.dueTime ? formatTimeLabel(task.dueTime) : formatDateLabel(taskDateKey(task))}</span>
            {task.priority === "high" && <Flag size={12} color="#E68080" fill="#E68080" />}
            {(task.recurrence || task.repeat) && <span className="time-chip"><Repeat size={11} />{task.recurrence ? recurrenceLabel(task.recurrence) : task.repeat}</span>}
            {!task.goal && <span className="time-chip" style={{ opacity: 0.7 }}>· no goal</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {onEdit && <Pencil size={15} color="var(--text3)" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onEdit(task); }} />}
          {expanded ? <ChevronDown size={16} color="var(--text3)" /> : <ChevronRight size={16} color="var(--text3)" />}
        </div>
      </div>
      {expanded && (
        <div className="task-detail">
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Due</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{formatDateLabel(taskDateKey(task))}{task.dueTime ? ` · ${formatTimeLabel(task.dueTime)}` : ""}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Priority</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{task.priority === "high" ? "High" : task.priority === "med" ? "Medium" : "Low"}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Repeat</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{task.recurrence ? recurrenceLabel(task.recurrence) : task.repeat || "None"}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Reminder</span><span className="field-value"><Bell size={11} color="var(--text2)" />{taskReminderLabel(task)}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Goal</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{goal ? goal.name : "No goal — standalone"}</span></div>
          {childTasks.length > 0 && (
            <div style={{ paddingTop: 8 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 750,
                  color: "var(--text3)",
                  textTransform: "uppercase",
                  letterSpacing: .45,
                  marginBottom: 4,
                }}
              >
                Subtasks
              </div>

              {childTasks.map((child) => (
                <div
                  key={child.id}
                  className="subtask-row"
                  style={{ cursor: onEdit ? "pointer" : "default" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit?.(child);
                  }}
                >
                  <Check
                    size={12}
                    color={child.done ? "#E8B45C" : "var(--text3)"}
                  />

                  <span
                    style={{
                      flex: 1,
                      textDecoration: child.done ? "line-through" : "none",
                      opacity: child.done ? .65 : 1,
                    }}
                  >
                    {child.title}
                  </span>

                  {child.priority === "high" && (
                    <Flag
                      size={11}
                      color="#E68080"
                      fill="#E68080"
                    />
                  )}

                  <ChevronRight size={13} color="var(--text3)" />
                </div>
              ))}
            </div>
          )}

          <div className="notes-box" style={{ minHeight: 38, cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}>
            {normalizeActivity(task).length ? `${normalizeActivity(task).length} activit${normalizeActivity(task).length === 1 ? "y" : "ies"} · ${normalizeActivity(task)[normalizeActivity(task).length - 1].text}` : "Add an activity update…"}
          </div>
        </div>
      )}
    </div>
  );
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const REFERENCE_DATE_KEY = localDateKey();

function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function shiftDateKey(key, days) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function dateKeyFromOffset(offset = 0) {
  return shiftDateKey(REFERENCE_DATE_KEY, Number(offset || 0));
}

function taskDateKey(task) {
  return task.dueDate || dateKeyFromOffset(task.dueOffsetDays || 0);
}

function taskOffsetDays(task) {
  return offsetFromDateKey(taskDateKey(task));
}

function taskProgress(task) {
  if (task.done || task.progress === "completed") return "completed";
  if (task.progress === "in_progress") return "in_progress";
  return "not_started";
}

function taskProgressLabel(task) {
  const progress = taskProgress(task);
  if (progress === "in_progress") return "In Progress";
  if (progress === "completed") return "Completed";
  return "Not Started";
}

function makeChildTaskDraft(parent, title) {
  const dueDate = taskDateKey(parent);

  return {
    title: String(title || "").trim(),
    parentTaskId: parent.id,
    kind: "task",
    dueDate,
    dueTime: null,
    due: formatDateLabel(dueDate),
    dueOffsetDays: offsetFromDateKey(dueDate),
    priority: parent.priority || "med",
    area: parent.area || null,
    goal: parent.goal || null,
    notes: "",
    activities: [],
    recurrence: null,
    repeat: null,
    reminder: "None",
    status: "next",
    progress: "not_started",
    done: false,
    completedAt: null,
    bypassProtected: parent.bypassProtected ?? false,
    createdAt: new Date().toISOString(),
  };
}

function offsetFromDateKey(key) {
  const ms = dateFromKey(key) - dateFromKey(REFERENCE_DATE_KEY);
  return Math.round(ms / 86400000);
}

function formatDateLabel(key) {
  const d = dateFromKey(key);
  const offset = offsetFromDateKey(key);

  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";

  if (offset > 1 && offset <= 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }

  if (offset < -1 && offset >= -7) {
    return `${Math.abs(offset)} days ago`;
  }

  const today = dateFromKey(REFERENCE_DATE_KEY);
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeLabel(value) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const d = new Date(2026, 0, 1, h, m || 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function inferTaskTime(task) {
  if (task.dueTime) return task.dueTime;
  const match = String(task.due || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "";
  let h = Number(match[1]);
  const minute = match[2];
  const ap = match[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

/* ABIDE GLOBAL WEEK START V2 */
function getWeekStartPreference() {
  return getAbideWeekStart();
}

function buildWeekKeys(
  anchorKey = REFERENCE_DATE_KEY,
  weekStart = getAbideWeekStart()
) {
  const date = dateFromKey(anchorKey);

  const startOffset =
    weekStart === "monday"
      ? (date.getDay() + 6) % 7
      : date.getDay();

  const startKey =
    shiftDateKey(
      anchorKey,
      -startOffset
    );

  return Array.from(
    { length: 7 },
    (_, index) =>
      shiftDateKey(
        startKey,
        index
      )
  );
}

function weekDayLabels(
  weekStart = getAbideWeekStart()
) {
  return weekStart === "monday"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

function lastNDateKeys(count, anchorKey = REFERENCE_DATE_KEY) {
  return Array.from({ length: count }, (_, i) => shiftDateKey(anchorKey, i - count + 1));
}

function weekdayCodeFromDate(dateKey) {
  return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][dateFromKey(dateKey).getDay()];
}

function recurrenceFromRepeat(repeat, dateKey, interval = 1, weekdayCode = null) {
  if (!repeat || repeat === "None") return null;
  const freq = repeat.toLowerCase();
  return {
    freq, interval: Math.max(1, Number(interval) || 1),
    days: freq === "weekly" ? [weekdayCode || weekdayCodeFromDate(dateKey)] : [],
    endDate: null,
  };
}

function recurrenceLabel(recurrence) {
  if (!recurrence?.freq) return "None";
  const interval = Math.max(1, Number(recurrence.interval) || 1);
  const unit = recurrence.freq;
  const base = interval === 1 ? `Every ${unit === "daily" ? "day" : unit === "weekly" ? "week" : unit === "monthly" ? "month" : "year"}` : `Every ${interval} ${unit === "daily" ? "days" : unit === "weekly" ? "weeks" : unit === "monthly" ? "months" : "years"}`;
  if (unit === "weekly" && recurrence.days?.length) {
    const name = WEEKDAY_OPTIONS.find((d) => d.code === recurrence.days[0])?.label || recurrence.days[0];
    return `${base} on ${name}`;
  }
  return base;
}

function normalizeRecurrence(taskOrRecurrence, dateKey = REFERENCE_DATE_KEY) {
  const r = taskOrRecurrence?.recurrence || taskOrRecurrence;
  if (r?.freq) return { ...r, interval: Math.max(1, Number(r.interval) || 1), days: r.days || [] };
  const repeat = taskOrRecurrence?.repeat;
  return recurrenceFromRepeat(repeat, dateKey);
}

function googleRecurrenceRule(recurrence, dateKey) {
  if (!recurrence?.freq) return null;
  const interval = Math.max(1, Number(recurrence.interval) || 1);
  const freq = recurrence.freq.toUpperCase();
  const parts = [`RRULE:FREQ=${freq}`, `INTERVAL=${interval}`];
  if (recurrence.freq === "weekly") parts.push(`BYDAY=${recurrence.days?.[0] || weekdayCodeFromDate(dateKey)}`);
  if (recurrence.freq === "monthly") parts.push(`BYMONTHDAY=${dateFromKey(dateKey).getDate()}`);
  return parts.join(";");
}

function microsoftRecurrenceRule(recurrence, dateKey) {
  if (!recurrence?.freq) return null;

  const interval = Math.max(1, Number(recurrence.interval) || 1);
  const date = dateFromKey(dateKey);

  const microsoftWeekdays = {
    SU: "sunday",
    MO: "monday",
    TU: "tuesday",
    WE: "wednesday",
    TH: "thursday",
    FR: "friday",
    SA: "saturday",
  };

  let pattern;

  if (recurrence.freq === "daily") {
    pattern = {
      type: "daily",
      interval,
    };
  } else if (recurrence.freq === "weekly") {
    pattern = {
      type: "weekly",
      interval,
      daysOfWeek: [
        microsoftWeekdays[
          recurrence.days?.[0] || weekdayCodeFromDate(dateKey)
        ],
      ],
      firstDayOfWeek: "sunday",
    };
  } else if (recurrence.freq === "monthly") {
    pattern = {
      type: "absoluteMonthly",
      interval,
      dayOfMonth: date.getDate(),
    };
  } else if (recurrence.freq === "yearly") {
    pattern = {
      type: "absoluteYearly",
      interval,
      dayOfMonth: date.getDate(),
      month: date.getMonth() + 1,
    };
  } else {
    return null;
  }

  return {
    pattern,
    range: {
      type: recurrence.endDate ? "endDate" : "noEnd",
      startDate: dateKey,
      ...(recurrence.endDate ? { endDate: recurrence.endDate } : {}),
    },
  };
}

function nextRecurrenceDate(dateKey, recurrence) {
  if (!recurrence?.freq) return null;
  const interval = Math.max(1, Number(recurrence.interval) || 1);
  if (recurrence.freq === "daily") return shiftDateKey(dateKey, interval);
  if (recurrence.freq === "weekly") return shiftDateKey(dateKey, 7 * interval);
  const date = dateFromKey(dateKey);
  if (recurrence.freq === "monthly") {
    const day = date.getDate();
    date.setDate(1); date.setMonth(date.getMonth() + interval);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
    return localDateKey(date);
  }
  if (recurrence.freq === "yearly") { date.setFullYear(date.getFullYear() + interval); return localDateKey(date); }
  return null;
}

function RecurrenceEditor({ value, onChange, dateKey }) {
  const unit = value?.freq ? value.freq[0].toUpperCase() + value.freq.slice(1) : "None";
  const interval = Math.max(1, Number(value?.interval) || 1);
  const weekday = value?.days?.[0] || weekdayCodeFromDate(dateKey);
  const selectUnit = (next) => onChange(next === "None" ? null : recurrenceFromRepeat(next, dateKey, 1, weekday));
  return (
    <>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
        {REPEAT_UNITS.map((option) => <div key={option} className={`filter-chip ${unit === option ? "active" : ""}`} onClick={() => selectUnit(option)}><Repeat size={11} />{option}</div>)}
      </div>
      {value?.freq && (
        <div className="card" style={{ padding: 10, marginTop: 6 }}>
          <div className="repeat-config"><span style={{ fontSize: 12.5, color: "var(--text2)" }}>Repeat every</span><input type="number" min="1" max="365" className="input-line" style={{ margin: 0 }} value={interval} onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })} /></div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>{value.freq === "daily" ? "day(s)" : value.freq === "weekly" ? "week(s)" : value.freq === "monthly" ? "month(s)" : "year(s)"}</div>
          {value.freq === "weekly" && (
            <>
              <div className="fb-label">On</div>
              <div className="filter-row" style={{ padding: 0 }}>{WEEKDAY_OPTIONS.map((d) => <div key={d.code} className={`filter-chip ${weekday === d.code ? "active" : ""}`} onClick={() => onChange({ ...value, days: [d.code] })}>{d.label.slice(0, 3)}</div>)}</div>
            </>
          )}
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>{recurrenceLabel(value)}</div>
        </div>
      )}
    </>
  );
}

function journalStreak(entries) {
  const dates = new Set(entries.map((e) => e.dateKey || e.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))));
  let streak = 0;
  let key = REFERENCE_DATE_KEY;
  while (dates.has(key)) { streak += 1; key = shiftDateKey(key, -1); }
  return streak;
}


const REMINDER_OPTIONS = [
  "None",
  "At time",
  "5 min before",
  "15 min before",
  "30 min before",
  "1 hour before",
  "1 day before",
  "2 days before",
];

function formatCustomReminderLabel(reminderAt) {
  if (!reminderAt) return "Custom";

  const moment = new Date(reminderAt);

  if (Number.isNaN(moment.getTime())) return "Custom";

  const dateLabel = moment.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year:
      moment.getFullYear() !== new Date().getFullYear()
        ? "numeric"
        : undefined,
  });

  const timeLabel = moment.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `Custom · ${dateLabel} at ${timeLabel}`;
}

function taskReminderLabel(task) {
  if (!task?.reminder || task.reminder === "None") return "None";

  if (task.reminder === "Custom") {
    return formatCustomReminderLabel(task.reminderAt);
  }

  return task.reminder;
}

function ReminderPicker({
  value,
  onChange,
  reminderAt = "",
  onReminderAtChange,
}) {
  const isCustom = value === "Custom";

  return (
    <>
      <div
        className="filter-row"
        style={{
          padding: "0 0 2px 0",
          flexWrap: "wrap",
          overflowX: "visible",
        }}
      >
        {REMINDER_OPTIONS.map((option) => (
          <div
            key={option}
            className={`filter-chip ${value === option ? "active" : ""}`}
            onClick={() => onChange(option)}
          >
            <Bell size={11} />
            {option}
          </div>
        ))}

        <div
          className={`filter-chip ${isCustom ? "active" : ""}`}
          onClick={() => onChange("Custom")}
        >
          <Bell size={11} />
          Custom
        </div>
      </div>

      {isCustom && (
        <div
          style={{
            marginTop: 8,
            padding: "11px 12px",
            borderRadius: 12,
            background: "var(--subtleBg)",
            border: "1px solid var(--inputBorder)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text2)",
              marginBottom: 7,
              letterSpacing: 0.2,
            }}
          >
            REMIND ME ON
          </div>

          <input
            type="datetime-local"
            className="input-line"
            value={reminderAt || ""}
            onChange={(e) => onReminderAtChange?.(e.target.value)}
          />

          <div
            style={{
              fontSize: 11,
              color: "var(--text3)",
              marginTop: 7,
              lineHeight: 1.4,
            }}
          >
            Custom reminders use this exact date and time instead of being
            calculated from the task due time.
          </div>
        </div>
      )}
    </>
  );
}


function QuickAreaPicker({ areas, value, onChange, onCreateArea, allowNone = true }) {
  const [addingArea, setAddingArea] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [areaColor, setAreaColor] = useState("#8FA88A");

  const create = () => {
    if (!areaName.trim() || !onCreateArea) return;

    const id = onCreateArea({
      name: areaName.trim(),
      color: areaColor,
    });

    if (id) onChange(id);

    setAreaName("");
    setAreaColor("#8FA88A");
    setAddingArea(false);
  };

  return (
    <>
      <div
        className="filter-row"
        style={{ padding: "0 0 2px 0" }}
      >
        {allowNone && (
          <div
            className={`filter-chip ${value === "" ? "active" : ""}`}
            onClick={() => onChange("")}
          >
            No Area
          </div>
        )}

        {Object.entries(areas).map(([k, v]) => (
          <div
            key={k}
            className={`filter-chip ${value === k ? "active" : ""}`}
            style={{ borderColor: v.color + "55" }}
            onClick={() => onChange(k)}
          >
            {v.name}
          </div>
        ))}

        {onCreateArea && (
          <div
            className={`filter-chip ${addingArea ? "active" : ""}`}
            onClick={() => setAddingArea(!addingArea)}
          >
            <Plus size={11} />
            New Area
          </div>
        )}
      </div>

      {addingArea && (
        <div className="quick-area-create">
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              className="input-line"
              style={{
                margin: 0,
                flex: 1,
              }}
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="Area name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
            />

            <input
              type="color"
              value={areaColor}
              onChange={(e) => setAreaColor(e.target.value)}
              style={{
                width: 42,
                height: 38,
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 8,
            }}
          >
            <div
              className="filter-chip active"
              onClick={create}
            >
              Add & Select
            </div>

            <div
              className="filter-chip"
              onClick={() => setAddingArea(false)}
            >
              Cancel
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function taskPersonalTargetKey(task) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(task?.targetDate || "")
  )
    ? task.targetDate
    : "";
}

function taskRescueDateKey(task) {
  return (
    taskPersonalTargetKey(task) ||
    taskDateKey(task)
  );
}

function rescuePriorityWeight(task) {
  if (task?.priority === "high") return 30;
  if (task?.priority === "med") return 20;
  return 10;
}

function rescueTaskScore(task) {
  const dueOffset = taskOffsetDays(task);
  const target = taskPersonalTargetKey(task);

  const targetOffset = target
    ? offsetFromDateKey(target)
    : null;

  let score = rescuePriorityWeight(task);

  // The further behind the true deadline, the stronger
  // the rescue priority.
  if (dueOffset < 0) {
    score += 100 + Math.min(30, Math.abs(dueOffset) * 4);
  } else if (dueOffset === 0) {
    score += 70;
  } else if (dueOffset <= 2) {
    score += 50;
  } else if (dueOffset <= 7) {
    score += 25;
  }

  // A personal finish-by target intentionally creates
  // earlier urgency without changing the real deadline.
  if (targetOffset != null) {
    if (targetOffset < 0) {
      score += 45;
    } else if (targetOffset === 0) {
      score += 35;
    } else if (targetOffset <= 2) {
      score += 15;
    }
  }

  if (task?.kind === "milestone") {
    score += 8;
  }

  return score;
}

function rescueCapacityLimit(capacity) {
  if (capacity === "low") return 2;
  if (capacity === "high") return 5;
  return 3;
}

function rescueCapacityLabel(capacity) {
  if (capacity === "low") return "Low";
  if (capacity === "high") return "High";
  return "Normal";
}

function reminderOffsetMinutes(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "none") return null;
  if (text === "at time") return 0;
  let match = text.match(/(\d+)\s*(?:min|minute)/);
  if (match) return Number(match[1]);
  match = text.match(/(\d+)\s*(?:hour|hr)/);
  if (match) return Number(match[1]) * 60;
  match = text.match(/(\d+)\s*day/);
  if (match) return Number(match[1]) * 1440;
  return null;
}

function taskReminderMoment(task) {
  if (task?.reminder === "Custom") {
    if (!task.reminderAt) return null;

    const customMoment = new Date(task.reminderAt);

    if (Number.isNaN(customMoment.getTime())) return null;

    return customMoment;
  }

  const offset = reminderOffsetMinutes(task?.reminder);

  if (offset == null) return null;

  const dateKey = taskDateKey(task);
  const time = task.dueTime || "09:00";
  const base = new Date(`${dateKey}T${time}:00`);

  if (Number.isNaN(base.getTime())) return null;

  return new Date(base.getTime() - offset * 60000);
}

function normalizeActivity(item) {
  const existing = Array.isArray(item?.activities) ? item.activities.filter((a) => a?.text) : [];
  if (existing.length) return existing;
  if (String(item?.notes || "").trim()) {
    return [{ id: `legacy_${item.id || Date.now()}`, text: String(item.notes).trim(), createdAt: item.createdAt || new Date().toISOString() }];
  }
  return [];
}

function activityTimeLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}


/* =========================================================
   AREA DETAIL VIEW V1
   Shows every task associated with one Area in one place.
   Reuses Abide's existing TaskRow and TaskEditor.
   ========================================================= */

function AreaDetailView({
  areaId,
  areas,
  tasks,
  goals,
  onBack,
  onToggleDone,
  onUpdateTask,
  onDeleteTask,
  onCreateTask,
  onCreateArea,
}) {
  const area = areas?.[areaId];

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  if (!area) return null;

  const areaTasks = tasks
    .filter((task) => task.area === areaId);

  /* ABIDE TASK HEALTH V1 */
  const topLevelTasks = areaTasks
    .filter((task) => !task.parentTaskId);

  const subtaskTasks = areaTasks
    .filter((task) => Boolean(task.parentTaskId));

  const activeTopLevelCount = topLevelTasks
    .filter((task) => !task.done)
    .length;

  const overdueTopLevelCount = topLevelTasks
    .filter(
      (task) =>
        !task.done &&
        taskOffsetDays(task) < 0
    )
    .length;

  const completedTopLevelCount = topLevelTasks
    .filter((task) => task.done)
    .length;

  const activeCount = areaTasks
    .filter((task) => !task.done)
    .length;

  const overdueCount = areaTasks
    .filter(
      (task) =>
        !task.done &&
        taskOffsetDays(task) < 0
    )
    .length;

  const completedCount = areaTasks
    .filter((task) => task.done)
    .length;

  const query = search
    .trim()
    .toLowerCase();

  const filteredTasks = areaTasks
    .filter((task) => {
      if (
        query &&
        !String(task.title || "")
          .toLowerCase()
          .includes(query) &&
        !String(task.notes || "")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }

      if (filter === "active") {
        return !task.done;
      }

      if (filter === "overdue") {
        return (
          !task.done &&
          taskOffsetDays(task) < 0
        );
      }

      if (filter === "completed") {
        return Boolean(task.done);
      }

      return true;
    })
    .sort((a, b) => {
      // Active tasks before completed tasks.
      if (a.done !== b.done) {
        return a.done ? 1 : -1;
      }

      const aDate =
        taskDateKey(a) || "9999-12-31";

      const bDate =
        taskDateKey(b) || "9999-12-31";

      const dateResult =
        aDate.localeCompare(bDate);

      if (dateResult !== 0) {
        return dateResult;
      }

      const weights = {
        high: 0,
        med: 1,
        low: 2,
      };

      return (
        (weights[a.priority] ?? 9) -
        (weights[b.priority] ?? 9)
      );
    });

  const openNewTask = () => {
    setEditingTask({
      id: `area_draft_${Date.now()}`,
      _areaDetailDraft: true,
      title: "",
      dueDate: REFERENCE_DATE_KEY,
      dueTime: null,
      targetDate: null,
      priority: "med",
      progress: "not_started",
      status: "next",
      done: false,
      area: areaId,
      goal: null,
      notes: "",
      activities: [],
      reminder: "None",
      reminderAt: null,
    });
  };

  const saveTask = (updatedTask) => {
    if (editingTask?._areaDetailDraft) {
      const {
        id,
        _areaDetailDraft,
        ...cleanTask
      } = updatedTask;

      onCreateTask({
        ...cleanTask,
        area: areaId,
      });
    } else {
      onUpdateTask(updatedTask);
    }

    setEditingTask(null);
  };

  const deleteEditingTask = (taskId) => {
    if (!editingTask?._areaDetailDraft) {
      onDeleteTask(taskId);
    }

    setEditingTask(null);
  };

  const stats = [
    ["Tasks", topLevelTasks.length],
    ["Active", activeTopLevelCount],
    ["Overdue", overdueTopLevelCount],
    ["Completed", completedTopLevelCount],
  ];

  return (
    <>
      <Header
        eyebrow="Area"
        title={area.name}
      />

      <div className="scroll">
        <div
          className="filter-chip"
          onClick={onBack}
          style={{
            width: "fit-content",
            marginBottom: 14,
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={13} />
          Areas
        </div>

        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 750,
                  color: "var(--text)",
                }}
              >
                Task Health
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: "var(--text3)",
                }}
              >
                {topLevelTasks.length} independent task
                {topLevelTasks.length === 1 ? "" : "s"}
                {" · "}
                {subtaskTasks.length} subtask
                {subtaskTasks.length === 1 ? "" : "s"}
                {" · "}
                {areaTasks.length} total stored record
                {areaTasks.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
              marginTop: 11,
            }}
          >
            <div className="filter-chip">
              {activeTopLevelCount} open
            </div>

            <div className="filter-chip">
              {overdueTopLevelCount} overdue
            </div>

            <div className="filter-chip">
              {completedTopLevelCount} completed
            </div>
          </div>

          {subtaskTasks.length > topLevelTasks.length && (
            <div
              style={{
                marginTop: 11,
                padding: "9px 10px",
                borderRadius: 10,
                background: "rgba(232,180,92,.08)",
                border: "1px solid rgba(232,180,92,.17)",
                fontSize: 10.5,
                lineHeight: 1.45,
                color: "var(--text2)",
              }}
            >
              Most stored records in this Area are subtasks.
              The independent-task count is the better measure
              of your actual workload.
            </div>
          )}
        </div>

        <div
          className="card"
          style={{
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              height: 4,
              background: area.color,
            }}
          />

          <div
            style={{
              padding: "18px 18px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 999,
                  background: area.color,
                  boxShadow:
                    `0 0 0 5px ${area.color}18`,
                  flexShrink: 0,
                }}
              />

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 780,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {area.name}
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11.5,
                    color: "var(--text3)",
                  }}
                >
                  Every task connected to this area.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(0, 1fr))",
                gap: 7,
                marginTop: 18,
              }}
            >
              {stats.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 5px",
                    textAlign: "center",
                    borderRadius: 11,
                    background: "var(--subtleBg)",
                    border:
                      "1px solid var(--divider)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color:
                        label === "Overdue" &&
                        value > 0
                          ? "#E68080"
                          : "var(--text)",
                    }}
                  >
                    {value}
                  </div>

                  <div
                    style={{
                      fontSize: 9.5,
                      marginTop: 2,
                      color: "var(--text3)",
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <input
            className="input-line"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={`Search ${area.name} tasks…`}
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
            }}
          />

          <div
            className="filter-chip active"
            onClick={openNewTask}
            style={{
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            <Plus size={12} />
            Add Task
          </div>
        </div>

        <div
          className="filter-row"
          style={{
            padding: "0 0 12px 0",
          }}
        >
          {[
            ["all", `All ${areaTasks.length}`],
            ["active", `Active ${activeCount}`],
            ["overdue", `Overdue ${overdueCount}`],
            [
              "completed",
              `Completed ${completedCount}`,
            ],
          ].map(([key, label]) => (
            <div
              key={key}
              className={`filter-chip ${
                filter === key ? "active" : ""
              }`}
              onClick={() => setFilter(key)}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="section-label">
          <span>Tasks</span>

          <span
            style={{
              color: "var(--text3)",
              fontWeight: 500,
            }}
          >
            {filteredTasks.length} shown
          </span>
        </div>

        <div
          className="card"
          style={{
            overflow: "hidden",
          }}
        >
          {filteredTasks.length ? (
            filteredTasks.map((task) => {
              const parentTask =
                task.parentTaskId
                  ? tasks.find(
                      (candidate) =>
                        candidate.id ===
                        task.parentTaskId
                    ) || null
                  : null;

              const children = tasks.filter(
                (candidate) =>
                  candidate.parentTaskId ===
                  task.id
              );

              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  expanded={
                    expandedId === task.id
                  }
                  onToggleExpand={(id) =>
                    setExpandedId((current) =>
                      current === id ? null : id
                    )
                  }
                  onToggleDone={onToggleDone}
                  goals={goals}
                  areas={areas}
                  onEdit={setEditingTask}
                  parentTask={parentTask}
                  childTasks={children}
                />
              );
            })
          ) : (
            <div
              style={{
                padding: "30px 18px",
                textAlign: "center",
                color: "var(--text3)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {areaTasks.length === 0
                ? `No tasks are assigned to ${area.name} yet.`
                : "No tasks match this filter."}

              {areaTasks.length === 0 && (
                <div
                  className="filter-chip active"
                  onClick={openNewTask}
                  style={{
                    width: "fit-content",
                    margin: "12px auto 0",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={12} />
                  Add first task
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ height: 100 }} />
      </div>

      {editingTask && (
        <TaskEditor
          key={editingTask.id}
          task={editingTask}
          goals={goals}
          areas={areas}
          onSave={saveTask}
          onCancel={() =>
            setEditingTask(null)
          }
          onDelete={deleteEditingTask}
          onCreateArea={onCreateArea}
          childTasks={
            editingTask._areaDetailDraft
              ? []
              : tasks.filter(
                  (task) =>
                    task.parentTaskId ===
                    editingTask.id
                )
          }
          onOpenChildTask={setEditingTask}
        />
      )}
    </>
  );
}


function TaskEditor({
  task,
  goals,
  areas,
  onSave,
  onCancel,
  onDelete,
  onCreateArea,
  childTasks = [],
  onCreateChildTask,
  onOpenChildTask,
}) {
  const modalRef = useRef(null);
  const [title, setTitle] = useState(task.title || "");
  const [dueDate, setDueDate] = useState(taskDateKey(task));
  const [dueTime, setDueTime] = useState(inferTaskTime(task));
  const [targetDate, setTargetDate] = useState(
    taskPersonalTargetKey(task)
  );
  const [priority, setPriority] = useState(task.priority || "med");
  const [progress, setProgress] = useState(taskProgress(task));
  const [area, setArea] = useState(task.area && areas[task.area] ? task.area : "");
  const [goal, setGoal] = useState(task.goal || "");
  const [recurrence, setRecurrence] = useState(normalizeRecurrence(task, taskDateKey(task)));
  const [reminder, setReminder] = useState(task.reminder || "None");
  const [reminderAt, setReminderAt] = useState(task.reminderAt || "");
  const [activities, setActivities] = useState(() => normalizeActivity(task));
  const [activityDraft, setActivityDraft] = useState("");
  const [childTitleDraft, setChildTitleDraft] = useState("");
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


  const addChildTask = () => {
    if (!onCreateChildTask) return;

    const child =
      onCreateChildTask(
        task,
        childTitleDraft.trim()
      );

    setChildTitleDraft("");

    if (
      child &&
      onOpenChildTask
    ) {
      onOpenChildTask(child);
    }
  };

  const addActivity = () => {
    if (!activityDraft.trim()) return;
    setActivities((p) => [...p, { id: `act_${Date.now()}`, text: activityDraft.trim(), createdAt: new Date().toISOString() }]);
    setActivityDraft("");
  };
  const save = () => {
    if (!title.trim() || !dueDate) return;
    const dueOffsetDays = offsetFromDateKey(dueDate);
    const due = dueTime ? formatTimeLabel(dueTime) : formatDateLabel(dueDate);
    const done = progress === "completed";
    onSave({
      ...task,
      title: title.trim(),
      dueDate,
      dueTime: dueTime || null,
      due,
      dueOffsetDays,
      targetDate:
        targetDate &&
        targetDate <= dueDate
          ? targetDate
          : null,
      priority,
      progress,
      done,
      completedAt: done ? (task.completedAt || new Date().toISOString()) : null,
      area: area || null,
      goal: goal || null,
      repeat: recurrence ? recurrenceLabel(recurrence) : null,
      recurrence,
      reminder,
      reminderAt: reminder === "Custom" ? reminderAt || null : null,
      notes: task.notes || "",
      activities,
    });
  };

  return createPortal(
    <div ref={modalRef} className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="task-editor-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="editor-shell">
          <div className="editor-header">
            <div className="editor-title">
              {task.parentTaskId ? "Edit Subtask" : "Edit Task"}
            </div>
            <div className="editor-close" onClick={onCancel}>
              <X size={17} />
            </div>
          </div>
          <div className="editor-scroll">
            <div className="fb-label" style={{ marginTop:0 }}>Task</div>
            <input className="input-line" style={{ marginTop:0 }} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Task title" />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div><div className="fb-label">Due date</div><input type="date" className="input-line" style={{ marginTop:0 }} value={dueDate} onChange={(e)=>{ const next=e.target.value; setDueDate(next); if (targetDate && targetDate > next) setTargetDate(""); if (recurrence?.freq === "weekly" && !(recurrence.days||[]).length) setRecurrence({ ...recurrence, days:[weekdayCodeFromDate(next)] }); }} /></div>
              <div><div className="fb-label">Time</div><input type="time" className="input-line" style={{ marginTop:0 }} value={dueTime} onChange={(e)=>setDueTime(e.target.value)} /></div>
            </div>

            <div className="fb-label">Finish by (optional)</div>

            <input
              type="date"
              className="input-line"
              style={{ marginTop: 0 }}
              value={targetDate}
              max={dueDate || undefined}
              onChange={(e) =>
                setTargetDate(e.target.value)
              }
            />

            <div
              style={{
                fontSize: 10.75,
                color: "var(--text3)",
                marginTop: 5,
                lineHeight: 1.45,
              }}
            >
              This is your personal target. The real deadline stays{" "}
              {dueDate
                ? formatDateLabel(dueDate)
                : "unchanged"}.
            </div>
            <div className="fb-label">Priority</div><div className="filter-row" style={{ padding:"0 0 2px 0" }}>{[["high","High"],["med","Medium"],["low","Low"]].map(([k,label])=><div key={k} className={`filter-chip ${priority===k?"active":""}`} onClick={()=>setPriority(k)}>{label}</div>)}</div>
            <div className="fb-label">Progress</div>
            <div className="filter-row" style={{ padding:"0 0 2px 0" }}>
              {[["not_started","Not Started"],["in_progress","In Progress"],["completed","Completed"]].map(([k,label])=>
                <div key={k} className={`filter-chip ${progress===k?"active":""}`} onClick={()=>setProgress(k)}>{label}</div>
              )}
            </div>
            <div className="fb-label">Area</div><QuickAreaPicker areas={areas} value={area} onChange={setArea} onCreateArea={onCreateArea} />
            <div className="fb-label">Goal (optional)</div><div className="filter-row" style={{ padding:"0 0 2px 0" }}><div className={`filter-chip ${goal===""?"active":""}`} onClick={()=>setGoal("")}>No Goal</div>{goals.map((g)=><div key={g.id} className={`filter-chip ${goal===g.id?"active":""}`} onClick={()=>setGoal(g.id)}>{g.name}</div>)}</div>
            <div className="fb-label">Repeat</div><RecurrenceEditor value={recurrence} onChange={setRecurrence} dateKey={dueDate} />
            <div className="fb-label">Reminder</div><ReminderPicker
  value={reminder}
  onChange={setReminder}
  reminderAt={reminderAt}
  onReminderAtChange={setReminderAt}
/>
            <div className="fb-label">Subtasks</div>

            {childTasks.length > 0 ? (
              <div
                className="card"
                style={{
                  padding: "2px 12px",
                  background: "var(--subtleBg)",
                }}
              >
                {childTasks.map((child, index) => (
                  <div
                    key={child.id}
                    onClick={() => onOpenChildTask?.(child)}
                    style={{
                      minHeight: 46,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 0",
                      cursor: onOpenChildTask ? "pointer" : "default",
                      borderBottom:
                        index === childTasks.length - 1
                          ? "none"
                          : "1px solid var(--divider)",
                    }}
                  >
                    <Check
                      size={13}
                      color={child.done ? "#E8B45C" : "var(--text3)"}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 650,
                          color: "var(--text)",
                          textDecoration: child.done
                            ? "line-through"
                            : "none",
                          opacity: child.done ? .65 : 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {child.title}
                      </div>

                      <div
                        style={{
                          fontSize: 10.75,
                          color: "var(--text3)",
                          marginTop: 2,
                        }}
                      >
                        {formatDateLabel(taskDateKey(child))}
                        {child.priority === "high"
                          ? " · High priority"
                          : ""}
                        {normalizeActivity(child).length
                          ? ` · ${normalizeActivity(child).length} update${
                              normalizeActivity(child).length === 1 ? "" : "s"
                            }`
                          : ""}
                      </div>
                    </div>

                    <ChevronRight size={14} color="var(--text3)" />
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text3)",
                  marginBottom: 8,
                }}
              >
                No subtasks yet.
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
              }}
            >
              <input
                className="input-line"
                style={{ margin: 0 }}
                value={childTitleDraft}
                onChange={(event) =>
                  setChildTitleDraft(event.target.value)
                }
                placeholder="Optional: start with a title"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addChildTask();
                  }
                }}
              />

              <div
                className="filter-chip active"
                onClick={addChildTask}
              >
                <Plus size={12} />
                Add Subtask
              </div>
            </div>

            <div
              style={{
                fontSize: 10.75,
                lineHeight: 1.4,
                color: "var(--text3)",
                marginTop: 6,
              }}
            >
              Add Subtask opens the complete task editor before the subtask is saved.
              Give it its own due date, time, Finish By, priority, progress,
              Area, goal, reminder, repeat schedule, activity, and more.
            </div>

            <div className="fb-label">Notes</div>

            <div
              style={{
                padding: "10px 11px",
                borderRadius: 12,
                background: "var(--subtleBg)",
                border: "1px solid var(--divider)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.25,
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    Work on this in Notes
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      lineHeight: 1.4,
                      color: "var(--text3)",
                      marginTop: 3,
                    }}
                  >
                    Creates a linked working page without removing or changing
                    the task.
                  </div>
                </div>

                <div
                  className="filter-chip"
                  style={{ flexShrink: 0 }}
                  onClick={() =>
                    sendToNotesAndOfferOpen(
                      task,
                      "task"
                    )
                  }
                >
                  Send to Notes
                </div>
              </div>
            </div>

            <div className="fb-label">Activity</div>
            <div className="activity-list">{activities.length?activities.map((a)=><div className="activity-item" key={a.id}><div className="activity-time">{activityTimeLabel(a.createdAt)}</div><div className="activity-text">{a.text}</div></div>):<div style={{ fontSize:12, color:"var(--text3)" }}>No activity yet.</div>}</div>
            <div className="activity-compose"><textarea className="notes-box" rows={2} value={activityDraft} onChange={(e)=>setActivityDraft(e.target.value)} placeholder="Add an update or comment…" /><div className="filter-chip active" onClick={addActivity}>Add</div></div>
            <div
              className="filter-chip editor-delete"
              onClick={() => {
                if (window.confirm(`Delete "${task.title}"?`)) {
                  onDelete(task.id);
                }
              }}
            >
              <Trash2 size={12} />
              {task.parentTaskId ? "Delete Subtask" : "Delete Task"}
            </div>
          </div>
          <div className="editor-footer"><div className="filter-chip active" style={{ flex:1, justifyContent:"center" }} onClick={save}>Save Changes</div><div className="filter-chip" style={{ flex:1, justifyContent:"center" }} onClick={onCancel}>Cancel</div></div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------
   DYNAMIC / CUSTOMIZABLE FILTER SYSTEM
----------------------------------------------------------------*/
function FilterSystem({
  areas,
  selectedAreas,
  setSelectedAreas,
  selectedPriorities,
  setSelectedPriorities,
  selectedProgress,
  setSelectedProgress,
  showCompleted,
  setShowCompleted,
  savedFilters,
  setSavedFilters,
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const areaKeys = Object.keys(areas);
  const allAreasOn = areaKeys.length === 0 || areaKeys.every((k) => selectedAreas.includes(k));
  const allPriOn = selectedPriorities.length === 3;
  const allProgressOn = selectedProgress.length === 3;

  const toggleArea = (k) => setSelectedAreas((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const togglePri = (k) => setSelectedPriorities((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const toggleProgress = (k) => setSelectedProgress((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const applySaved = (f) => {
    setSelectedAreas((f.areas || []).filter((a) => areas[a]));
    setSelectedPriorities(f.priorities || ["high", "med", "low"]);
    setSelectedProgress(f.progress || ["not_started", "in_progress", "completed"]);
    setShowCompleted(Boolean(f.showCompleted));
  };
  const removeSaved = (id, e) => { e.stopPropagation(); setSavedFilters((p) => p.filter((f) => f.id !== id)); };
  const saveCurrent = () => {
    if (!draftName.trim()) return;
    setSavedFilters((p) => [...p, {
      id: Date.now(),
      name: draftName.trim(),
      areas: selectedAreas,
      priorities: selectedPriorities,
      progress: selectedProgress,
      showCompleted,
    }]);
    setDraftName(""); setBuilderOpen(false);
  };

  return (
    <>
      <div className="filter-row">
        <div className={`filter-chip ${allAreasOn && allPriOn && allProgressOn ? "active" : ""}`} onClick={() => {
          setSelectedAreas(areaKeys);
          setSelectedPriorities(["high", "med", "low"]);
          setSelectedProgress(["not_started", "in_progress", "completed"]);
        }}><Filter size={12} />All</div>
        <div className={`filter-chip ${showCompleted ? "active" : ""}`} onClick={() => setShowCompleted(!showCompleted)}>
          <Check size={12} />{showCompleted ? "Hide completed" : "Show completed"}
        </div>
        {savedFilters.map((f) => (
          <div key={f.id} className="filter-chip" onClick={() => applySaved(f)}>{f.name}<X size={11} className="x" onClick={(e) => removeSaved(f.id, e)} /></div>
        ))}
        <div className={`filter-chip ${builderOpen ? "active" : ""}`} onClick={() => setBuilderOpen(!builderOpen)}><SlidersHorizontal size={12} />Customize</div>
      </div>
      {builderOpen && (
        <div className="card filter-builder">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div className="fb-label" style={{ marginBottom: 0 }}>
              Areas
            </div>

            {areaKeys.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                <span
                  onClick={() => setSelectedAreas(areaKeys)}
                  style={{
                    color: allAreasOn ? "var(--text3)" : "#E8B45C",
                    cursor: allAreasOn ? "default" : "pointer",
                    opacity: allAreasOn ? .55 : 1,
                  }}
                >
                  Select all
                </span>

                <span
                  style={{
                    width: 1,
                    height: 12,
                    background: "var(--divider)",
                  }}
                />

                <span
                  onClick={() => setSelectedAreas([])}
                  style={{
                    color:
                      selectedAreas.length === 0
                        ? "var(--text3)"
                        : "#E8B45C",
                    cursor:
                      selectedAreas.length === 0
                        ? "default"
                        : "pointer",
                    opacity: selectedAreas.length === 0 ? .55 : 1,
                  }}
                >
                  Deselect all
                </span>
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: 10.75,
              color: "var(--text3)",
              margin: "4px 0 7px",
            }}
          >
            {selectedAreas.length === 0
              ? "No Areas selected"
              : selectedAreas.length === areaKeys.length
                ? "All Areas selected"
                : `${selectedAreas.length} of ${areaKeys.length} Areas selected`}
          </div>

          <div className="filter-row" style={{ padding: 0 }}>
            {areaKeys.length ? (
              Object.entries(areas).map(([k, v]) => (
                <div
                  key={k}
                  className={`filter-chip ${
                    selectedAreas.includes(k) ? "active" : ""
                  }`}
                  onClick={() => toggleArea(k)}
                >
                  {v.name}
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                No areas yet.
              </span>
            )}
          </div>
          <div className="fb-label">Priority</div>
          <div className="filter-row" style={{ padding: 0 }}>{[["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([k, label]) => <div key={k} className={`filter-chip ${selectedPriorities.includes(k) ? "active" : ""}`} onClick={() => togglePri(k)}>{label}</div>)}</div>
          <div className="fb-label">Progress</div>
          <div className="filter-row" style={{ padding: 0 }}>
            {[["not_started","Not Started"],["in_progress","In Progress"],["completed","Completed"]].map(([k,label]) =>
              <div key={k} className={`filter-chip ${selectedProgress.includes(k) ? "active" : ""}`} onClick={() => toggleProgress(k)}>{label}</div>
            )}
          </div>
          <div className="fb-label">Save This Combination</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input-line" style={{ margin: 0 }} placeholder="e.g. Margin evenings" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            <div className="filter-chip active" style={{ flexShrink: 0 }} onClick={saveCurrent}>Save</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------
   TODAY TAB
----------------------------------------------------------------*/
function TodayTab({ tasks, expandedId, setExpandedId, toggleDone, goals, areas, onUpdateTask, onDeleteTask, onCreateTask, onCreateArea }) {
  const [selectedAreas, setSelectedAreas] = useState(Object.keys(areas));
  const [selectedPriorities, setSelectedPriorities] = useState(["high", "med", "low"]);
  const [selectedProgress, setSelectedProgress] = useState(["not_started", "in_progress", "completed"]);
  const [showCompleted, setShowCompleted] = usePersistentState("abide-show-completed", false);
  const [savedFilters, setSavedFilters] = usePersistentState("abide-saved-filters", []);
  const [range, setRange] = useState("week");
  const [somedayOpen, setSomedayOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [rescueOpen, setRescueOpen] = useState(false);
  const [rescueCapacity, setRescueCapacity] =
    usePersistentState(
      "abide-rescue-capacity",
      "normal"
    );

  const [rescueStrategy, setRescueStrategy] =
    usePersistentState(
      "abide-rescue-strategy",
      "balanced"
    );

  const [rescueAreaPrefs, setRescueAreaPrefs] =
    usePersistentState(
      "abide-rescue-area-preferences",
      {}
    );

  const [rescueCapacityOpen, setRescueCapacityOpen] =
    useState(false);

  const [rescueStrategyOpen, setRescueStrategyOpen] =
    useState(false);

  const [rescueAreasOpen, setRescueAreasOpen] =
    useState(false);

  const [editingTask, setEditingTask] = useState(null);
  const [adding, setAdding] = useState(false);
  const [briefCollapsed, setBriefCollapsed] = usePersistentState(
    `abide-daily-brief-collapsed-${REFERENCE_DATE_KEY}`,
    false
  );

  useEffect(() => {
    const keys = Object.keys(areas);
    setSelectedAreas((prev) => {
      const kept = prev.filter((k) => areas[k]);
      const added = keys.filter((k) => !kept.includes(k));
      return [...kept, ...added];
    });
  }, [areas]);

  const matches = (t) => {
    const progress = taskProgress(t);
    if (!showCompleted && progress === "completed") return false;
    return (!t.area || selectedAreas.includes(t.area))
      && selectedPriorities.includes(t.priority)
      && selectedProgress.includes(progress);
  };
  const overdue = tasks.filter((t) => taskOffsetDays(t) < 0 && !t.done && matches(t));
  const today = tasks.filter((t) => taskOffsetDays(t) === 0 && matches(t));
  const maxRange = range === "week" ? 7 : 14;
  const upcoming = tasks.filter((t) => {
    const offset = taskOffsetDays(t);
    return offset > 0 && offset <= maxRange && matches(t);
  });


  const upcomingReminders = tasks.filter((t) => t.reminder && t.reminder !== "None" && !t.done && taskOffsetDays(t) <= 1);

  const briefOverdueTasks = tasks.filter(
    (task) => !task.done && taskOffsetDays(task) < 0
  );

  const briefUrgentTodayTasks = tasks.filter(
    (task) =>
      !task.done &&
      taskOffsetDays(task) === 0 &&
      task.priority === "high"
  );

  const briefTodayTasks = tasks.filter(
    (task) => !task.done && taskOffsetDays(task) === 0
  );

  const briefTodayLoad = briefTodayTasks.length;

  const briefUpcomingImportant = tasks
    .filter((task) => {
      const offset = taskOffsetDays(task);
      return (
        !task.done &&
        offset > 0 &&
        offset <= 7 &&
        (task.priority === "high" || task.kind === "milestone")
      );
    })
    .sort((a, b) => taskOffsetDays(a) - taskOffsetDays(b));

  const briefFocus = (() => {
    if (briefOverdueTasks.length && briefUrgentTodayTasks.length) {
      return "Clear the most important overdue commitment before adding more to today.";
    }

    if (briefOverdueTasks.length) {
      return "Resolve or reschedule what is behind before it quietly becomes background stress.";
    }

    if (briefUrgentTodayTasks.length) {
      return "Protect attention for the high-priority work already due today.";
    }

    if (briefTodayLoad >= 7) {
      return "Today is carrying a lot. Choose the few commitments that truly need your presence.";
    }

    if (briefTodayLoad === 0) {
      return "There is no task pressure today. Keep the margin instead of filling it automatically.";
    }

    return "The day is manageable. Work from what is already clear rather than creating more urgency.";
  })();

  const rescueAreaKey = (task) =>
    task.area || "__unassigned";

  const rescueAreaName = (areaKey) => {
    if (areaKey === "__unassigned") {
      return "No Area";
    }

    return (
      areas[areaKey]?.name ||
      "Other"
    );
  };

  const rescueAreaColor = (areaKey) => {
    if (areaKey === "__unassigned") {
      return "#8E97A8";
    }

    return (
      areas[areaKey]?.color ||
      "#8E97A8"
    );
  };

  const rescueAreaPreference = (areaKey) => {
    const saved =
      rescueAreaPrefs?.[areaKey];

    return {
      mode:
        saved?.mode === "protect" ||
        saved?.mode === "pause"
          ? saved.mode
          : "include",
      slots: Math.max(
        0,
        Number(saved?.slots) || 1
      ),
    };
  };

  const setRescueAreaMode = (
    areaKey,
    mode
  ) => {
    setRescueAreaPrefs((current) => ({
      ...(current || {}),
      [areaKey]: {
        ...rescueAreaPreference(areaKey),
        mode,
      },
    }));
  };

  const setRescueAreaSlots = (
    areaKey,
    slots
  ) => {
    setRescueAreaPrefs((current) => ({
      ...(current || {}),
      [areaKey]: {
        ...rescueAreaPreference(areaKey),
        slots: Math.max(
          0,
          Math.min(
            10,
            Number(slots) || 0
          )
        ),
      },
    }));
  };

  const rescueCandidateTasks = tasks
    .filter((task) => {
      if (task.done) return false;

      const dueOffset =
        taskOffsetDays(task);

      const targetKey =
        taskPersonalTargetKey(task);

      const targetOffset = targetKey
        ? offsetFromDateKey(targetKey)
        : null;

      return (
        dueOffset < 0 ||
        dueOffset <= 7 ||
        (targetOffset != null &&
          targetOffset <= 7)
      );
    })
    .sort((a, b) => {
      const scoreDiff =
        rescueTaskScore(b) -
        rescueTaskScore(a);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return taskDateKey(a).localeCompare(
        taskDateKey(b)
      );
    });

  const rescueAreaKeys = Array.from(
    new Set([
      ...Object.keys(areas),
      ...rescueCandidateTasks.map(
        rescueAreaKey
      ),
    ])
  ).filter(Boolean);

  const rescueTodayLimit =
    rescueCapacityLimit(rescueCapacity);

  const rescueSelectableTasks =
    rescueCandidateTasks.filter(
      (task) =>
        rescueAreaPreference(
          rescueAreaKey(task)
        ).mode !== "pause"
    );

  const buildRescueTodayTasks = () => {
    if (!rescueSelectableTasks.length) {
      return [];
    }

    // URGENCY FIRST:
    // Respect paused Areas, then use the normal Rescue score.
    if (rescueStrategy === "urgency") {
      return rescueSelectableTasks.slice(
        0,
        rescueTodayLimit
      );
    }

    const chosen = [];
    const chosenIds = new Set();

    const addTask = (task) => {
      if (
        !task ||
        chosenIds.has(String(task.id)) ||
        chosen.length >= rescueTodayLimit
      ) {
        return false;
      }

      chosen.push(task);
      chosenIds.add(String(task.id));
      return true;
    };

    const tasksForArea = (areaKey) =>
      rescueSelectableTasks.filter(
        (task) =>
          rescueAreaKey(task) ===
          areaKey
      );

    // CUSTOM:
    // User explicitly chooses how many slots each Area gets.
    if (rescueStrategy === "custom") {
      rescueAreaKeys.forEach(
        (areaKey) => {
          if (
            chosen.length >=
            rescueTodayLimit
          ) {
            return;
          }

          const pref =
            rescueAreaPreference(
              areaKey
            );

          if (pref.mode === "pause") {
            return;
          }

          const requested =
            pref.mode === "protect"
              ? Math.max(1, pref.slots)
              : pref.slots;

          tasksForArea(areaKey)
            .slice(0, requested)
            .forEach(addTask);
        }
      );

      // If custom allocations do not fill available capacity,
      // fill the remaining spaces with the most urgent eligible work.
      rescueSelectableTasks.forEach(
        addTask
      );

      return chosen.slice(
        0,
        rescueTodayLimit
      );
    }

    // BALANCED:
    // First guarantee one task from every Protected Area.
    rescueAreaKeys
      .filter(
        (areaKey) =>
          rescueAreaPreference(
            areaKey
          ).mode === "protect"
      )
      .forEach((areaKey) => {
        addTask(
          tasksForArea(areaKey)[0]
        );
      });

    if (
      chosen.length >=
      rescueTodayLimit
    ) {
      return chosen.slice(
        0,
        rescueTodayLimit
      );
    }

    // Then round-robin the active Areas so a single Area
    // cannot consume the entire Rescue list by accident.
    const activeAreaKeys =
      rescueAreaKeys
        .filter(
          (areaKey) =>
            rescueAreaPreference(
              areaKey
            ).mode !== "pause"
        )
        .filter(
          (areaKey) =>
            tasksForArea(areaKey)
              .length > 0
        )
        .sort((a, b) => {
          const aTop =
            tasksForArea(a)[0];

          const bTop =
            tasksForArea(b)[0];

          return (
            rescueTaskScore(bTop) -
            rescueTaskScore(aTop)
          );
        });

    let round = 0;

    while (
      chosen.length <
        rescueTodayLimit &&
      round < 20
    ) {
      let addedThisRound = false;

      activeAreaKeys.forEach(
        (areaKey) => {
          const remaining =
            tasksForArea(areaKey)
              .filter(
                (task) =>
                  !chosenIds.has(
                    String(task.id)
                  )
              );

          if (
            addTask(remaining[0])
          ) {
            addedThisRound = true;
          }
        }
      );

      if (!addedThisRound) break;

      round += 1;
    }

    return chosen.slice(
      0,
      rescueTodayLimit
    );
  };

  const rescueTodayTasks =
    buildRescueTodayTasks();

  const rescueTodayIds = new Set(
    rescueTodayTasks.map(
      (task) => String(task.id)
    )
  );

  const rescueLaterTasks =
    rescueCandidateTasks.filter(
      (task) =>
        !rescueTodayIds.has(
          String(task.id)
        )
    );

  const rescueOverdueCount =
    rescueCandidateTasks.filter(
      (task) =>
        taskOffsetDays(task) < 0
    ).length;

  const rescueDueThisWeekCount =
    rescueCandidateTasks.filter(
      (task) => {
        const offset =
          taskOffsetDays(task);

        return (
          offset >= 0 &&
          offset <= 7
        );
      }
    ).length;

  const rescueTargetBehindCount =
    rescueCandidateTasks.filter(
      (task) => {
        const target =
          taskPersonalTargetKey(task);

        return (
          target &&
          offsetFromDateKey(target) < 0 &&
          taskOffsetDays(task) >= 0
        );
      }
    ).length;

  // Rescue should be contextual, not a permanent dashboard.
  // It appears when something is actually behind or the day
  // has become unusually heavy.
  const rescueNeedsHelp =
    rescueOverdueCount > 0 ||
    rescueTargetBehindCount > 0 ||
    briefTodayLoad >= 7;

  const rescueAttentionCount =
    rescueOverdueCount +
      rescueTargetBehindCount >
    0
      ? rescueOverdueCount +
        rescueTargetBehindCount
      : briefTodayLoad;

  const rescueProtectedAreaNames =
    rescueAreaKeys
      .filter(
        (areaKey) =>
          rescueAreaPreference(
            areaKey
          ).mode === "protect"
      )
      .map(rescueAreaName);

  const rescuePausedAreaNames =
    rescueAreaKeys
      .filter(
        (areaKey) =>
          rescueAreaPreference(
            areaKey
          ).mode === "pause"
      )
      .map(rescueAreaName);

  const rescueAreaSummary = (() => {
    if (
      rescueProtectedAreaNames.length
    ) {
      const visible =
        rescueProtectedAreaNames
          .slice(0, 2)
          .join(" + ");

      const more =
        rescueProtectedAreaNames.length >
        2
          ? ` +${
              rescueProtectedAreaNames.length -
              2
            }`
          : "";

      return `${visible}${more} protected`;
    }

    if (rescuePausedAreaNames.length) {
      return `${
        rescuePausedAreaNames.length
      } ${
        rescuePausedAreaNames.length === 1
          ? "Area"
          : "Areas"
      } paused`;
    }

    return "All active Areas included";
  })();

  const rescueStrategyLabel =
    rescueStrategy === "custom"
      ? "Custom mix"
      : rescueStrategy === "urgency"
        ? "Urgency first"
        : "Balanced";

  useEffect(() => {
    if (!rescueNeedsHelp) {
      setRescueOpen(false);
      setRescueCapacityOpen(false);
      setRescueStrategyOpen(false);
      setRescueAreasOpen(false);
    }
  }, [rescueNeedsHelp]);

  const rescueSetTargetToday = (task) => {
    const dueKey = taskDateKey(task);

    if (
      REFERENCE_DATE_KEY <= dueKey
    ) {
      onUpdateTask({
        ...task,
        targetDate:
          REFERENCE_DATE_KEY,
      });
    } else {
      // If the real deadline is already past, today cannot
      // logically be an "ahead of deadline" target.
      openEditor(task);
    }
  };

  const rescueRescheduleTask = (
    task,
    daysAhead = 1
  ) => {
    const oldDue = taskDateKey(task);
    const newDue = shiftDateKey(
      REFERENCE_DATE_KEY,
      daysAhead
    );

    const history = Array.isArray(
      task.rescheduleHistory
    )
      ? task.rescheduleHistory
      : [];

    const nextTarget =
      taskPersonalTargetKey(task);

    onUpdateTask({
      ...task,
      originalDueDate:
        task.originalDueDate ||
        oldDue,
      rescheduleHistory: [
        ...history,
        {
          from: oldDue,
          to: newDue,
          changedAt:
            new Date().toISOString(),
          reason: "rescue-plan",
        },
      ],
      dueDate: newDue,
      dueOffsetDays:
        offsetFromDateKey(newDue),
      due: task.dueTime
        ? formatTimeLabel(task.dueTime)
        : formatDateLabel(newDue),
      targetDate:
        nextTarget &&
        nextTarget <= newDue
          ? nextTarget
          : null,
    });
  };

  const briefSummaryParts = [
    briefOverdueTasks.length
      ? `${briefOverdueTasks.length} overdue`
      : null,
    briefUrgentTodayTasks.length
      ? `${briefUrgentTodayTasks.length} urgent`
      : null,
    `${briefTodayLoad} today`,
  ].filter(Boolean);

  const saveTask = (updated) => {
    if (updated?._newChildDraft) {
      const {
        id,
        _newChildDraft,
        ...cleanChild
      } = updated;

      onCreateTask({
        ...cleanChild,
        parentTaskId:
          updated.parentTaskId,
        kind: "task",
      });

      setEditingTask(null);
      return;
    }

    onUpdateTask(updated);
    setEditingTask(null);
  };
  const deleteTask = (id) => { onDeleteTask(id); if (editingTask?.id === id) setEditingTask(null); };

  const openEditor = (t) => {
    setAdding(false);
    setEditingTask(t);
  };

  /* ABIDE FULL SUBTASK DRAFT V1 */
  const createChildTaskFromEditor = (parent, title) => {
    return {
      ...makeChildTaskDraft(
        parent,
        title || ""
      ),

      id:
        `child_draft_${Date.now()}`,

      _newChildDraft:
        true,

      parentTaskId:
        parent.id,

      title:
        String(title || ""),
    };
  };

  const renderTask = (t) => (
    <TaskRow
      key={t.id}
      task={t}
      goals={goals}
      areas={areas}
      expanded={expandedId === t.id}
      onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
      onToggleDone={toggleDone}
      onEdit={openEditor}
      parentTask={
        t.parentTaskId
          ? tasks.find(
              (parent) => String(parent.id) === String(t.parentTaskId)
            ) || null
          : null
      }
      childTasks={tasks.filter(
        (child) => String(child.parentTaskId || "") === String(t.id)
      )}
    />
  );

  const todayLabel = dateFromKey(REFERENCE_DATE_KEY).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <Header eyebrow={todayLabel} title="Today" actions={[{ icon: Bell, onClick: () => setAlertsOpen(!alertsOpen), badge: upcomingReminders.length > 0 }]} />
      <div className="scroll">

        <AreaQuickNav
          areas={areas}
          label="Areas"
        />

        <div
          className="card"
          style={{ marginBottom: 14, overflow: "hidden" }}
        >
          <div
            onClick={() => setBriefCollapsed(!briefCollapsed)}
            style={{
              padding: "13px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 13.5,
                  fontWeight: 750,
                  color: "var(--text)",
                }}
              >
                <Sun size={15} color="#E8B45C" />
                Daily Brief
              </div>

              {briefCollapsed && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text3)",
                    marginTop: 4,
                  }}
                >
                  {briefSummaryParts.join(" · ")}
                </div>
              )}
            </div>

            {briefCollapsed
              ? <ChevronRight size={15} color="var(--text3)" />
              : <ChevronDown size={15} color="var(--text3)" />}
          </div>

          {!briefCollapsed && (
            <div
              style={{
                padding: "0 14px 14px",
                borderTop: "1px solid var(--divider)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  paddingTop: 12,
                }}
              >
                <div
                  style={{
                    background: "var(--subtleBg)",
                    border: "1px solid var(--pillBorder)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 750, color: briefOverdueTasks.length ? "#E68080" : "var(--text)" }}>
                    {briefOverdueTasks.length}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>
                    Overdue
                  </div>
                </div>

                <div
                  style={{
                    background: "var(--subtleBg)",
                    border: "1px solid var(--pillBorder)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 750, color: briefUrgentTodayTasks.length ? "#E8B45C" : "var(--text)" }}>
                    {briefUrgentTodayTasks.length}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>
                    Urgent today
                  </div>
                </div>

                <div
                  style={{
                    background: "var(--subtleBg)",
                    border: "1px solid var(--pillBorder)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 750, color: "var(--text)" }}>
                    {briefTodayLoad}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>
                    On today
                  </div>
                </div>
              </div>

              {briefOverdueTasks.length > 0 && (
                <>
                  <div className="fb-label" style={{ marginTop: 13 }}>
                    Behind schedule
                  </div>

                  {briefOverdueTasks.slice(0, 3).map((task) => (
                    <div
                      key={`brief-overdue-${task.id}`}
                      onClick={() => openEditor(task)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 0",
                        cursor: "pointer",
                      }}
                    >
                      <Clock size={13} color="#E68080" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "var(--body)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {task.title}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#E68080" }}>
                        {formatDateLabel(taskDateKey(task))}
                      </span>
                    </div>
                  ))}

                  {briefOverdueTasks.length > 3 && (
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
                      +{briefOverdueTasks.length - 3} more overdue
                    </div>
                  )}
                </>
              )}

              {briefUrgentTodayTasks.length > 0 && (
                <>
                  <div className="fb-label" style={{ marginTop: 13 }}>
                    Needs attention today
                  </div>

                  {briefUrgentTodayTasks.slice(0, 3).map((task) => (
                    <div
                      key={`brief-urgent-${task.id}`}
                      onClick={() => openEditor(task)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 0",
                        cursor: "pointer",
                      }}
                    >
                      <Flag size={13} color="#E8B45C" />
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          color: "var(--body)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.title}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {briefUpcomingImportant.length > 0 && (
                <>
                  <div className="fb-label" style={{ marginTop: 13 }}>
                    Ahead
                  </div>

                  {briefUpcomingImportant.slice(0, 3).map((task) => (
                    <div
                      key={`brief-ahead-${task.id}`}
                      onClick={() => openEditor(task)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 0",
                        cursor: "pointer",
                      }}
                    >
                      {task.kind === "milestone"
                        ? <Target size={13} color="#7C93C9" />
                        : <ChevronRight size={13} color="var(--text3)" />}

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          color: "var(--body)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.title}
                      </div>

                      <span style={{ fontSize: 11, color: "var(--text3)" }}>
                        {formatDateLabel(taskDateKey(task))}
                      </span>
                    </div>
                  ))}
                </>
              )}

              <div
                style={{
                  marginTop: 13,
                  padding: "10px 11px",
                  borderRadius: 12,
                  background: "var(--subtleBg)",
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "var(--text2)",
                }}
              >
                <span style={{ fontWeight: 750, color: "#8FA88A" }}>
                  Focus:
                </span>{" "}
                {briefFocus}
              </div>
            </div>
          )}
        </div>

        {rescueNeedsHelp && !rescueOpen && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setRescueOpen(true)
              }
              aria-label="Open Rescue Plan"
              style={{
                minHeight: 34,
                borderRadius: 11,
                border:
                  rescueOverdueCount > 0
                    ? "1px solid rgba(230,128,128,0.38)"
                    : "1px solid rgba(124,147,201,0.30)",
                background:
                  rescueOverdueCount > 0
                    ? "rgba(230,128,128,0.09)"
                    : "rgba(124,147,201,0.10)",
                color: "var(--text)",
                padding: "0 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <LifeBuoy
                size={14}
                color={
                  rescueOverdueCount > 0
                    ? "#E68080"
                    : "#7C93C9"
                }
              />

              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 750,
                }}
              >
                Rescue
              </span>

              <span
                style={{
                  minWidth: 19,
                  height: 19,
                  padding: "0 5px",
                  borderRadius: 99,
                  background:
                    rescueOverdueCount > 0
                      ? "rgba(230,128,128,0.16)"
                      : "rgba(124,147,201,0.16)",
                  color:
                    rescueOverdueCount > 0
                      ? "#E68080"
                      : "#7C93C9",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {rescueAttentionCount}
              </span>

              <ChevronRight
                size={13}
                color="var(--text3)"
              />
            </button>
          </div>
        )}

        {rescueNeedsHelp && rescueOpen && (
          <div
            className="card"
            style={{
              marginBottom: 14,
              overflow: "hidden",
              border:
                rescueOverdueCount > 0
                  ? "1px solid rgba(230,128,128,0.30)"
                  : "1px solid rgba(124,147,201,0.22)",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 33,
                    height: 33,
                    borderRadius: 11,
                    background:
                      "rgba(124,147,201,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <LifeBuoy
                    size={16}
                    color="#7C93C9"
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 750,
                      color: "var(--text)",
                    }}
                  >
                    Rescue Plan
                  </div>

                  <div
                    style={{
                      fontSize: 10.75,
                      color: "var(--text3)",
                      marginTop: 2,
                    }}
                  >
                    {rescueOverdueCount > 0
                      ? `${rescueOverdueCount} overdue`
                      : rescueTargetBehindCount > 0
                        ? `${rescueTargetBehindCount} finish-by target${
                            rescueTargetBehindCount === 1
                              ? ""
                              : "s"
                          } slipped`
                        : `${briefTodayLoad} tasks due today`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setRescueOpen(false)
                }
                aria-label="Close Rescue Plan"
                style={{
                  width: 31,
                  height: 31,
                  borderRadius: 9,
                  border:
                    "1px solid var(--pillBorder)",
                  background:
                    "var(--pillBg)",
                  color: "var(--text3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div
              style={{
                borderTop:
                  "1px solid var(--divider)",
                padding: "12px 14px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: "var(--text2)",
                  marginBottom: 11,
                }}
              >
                Choose a realistic plan for what needs attention now. Your
                settings are remembered, so you only need to open them when
                you want to change the plan.
              </div>

              {/* ==============================================
                  COLLAPSIBLE: CAPACITY
              ============================================== */}
              <div
                style={{
                  border:
                    "1px solid var(--divider)",
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  onClick={() =>
                    setRescueCapacityOpen(
                      !rescueCapacityOpen
                    )
                  }
                  style={{
                    minHeight: 45,
                    padding: "9px 11px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11.75,
                        fontWeight: 700,
                        color: "var(--text)",
                      }}
                    >
                      My capacity today
                    </div>

                    <div
                      style={{
                        fontSize: 10.25,
                        color: "var(--text3)",
                        marginTop: 2,
                      }}
                    >
                      {rescueCapacityLabel(
                        rescueCapacity
                      )}{" "}
                      · {rescueTodayLimit} focus{" "}
                      {rescueTodayLimit === 1
                        ? "task"
                        : "tasks"}
                    </div>
                  </div>

                  {rescueCapacityOpen ? (
                    <ChevronDown
                      size={14}
                      color="var(--text3)"
                    />
                  ) : (
                    <ChevronRight
                      size={14}
                      color="var(--text3)"
                    />
                  )}
                </div>

                {rescueCapacityOpen && (
                  <div
                    style={{
                      padding:
                        "0 11px 11px",
                      borderTop:
                        "1px solid var(--divider)",
                    }}
                  >
                    <div
                      className="filter-row"
                      style={{
                        padding:
                          "10px 0 0",
                        overflowX:
                          "visible",
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        ["low", "Low · 2"],
                        [
                          "normal",
                          "Normal · 3",
                        ],
                        ["high", "High · 5"],
                      ].map(
                        ([key, label]) => (
                          <div
                            key={key}
                            className={`filter-chip ${
                              rescueCapacity ===
                              key
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              setRescueCapacity(
                                key
                              )
                            }
                          >
                            {label}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ==============================================
                  COLLAPSIBLE: STRATEGY
              ============================================== */}
              <div
                style={{
                  border:
                    "1px solid var(--divider)",
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  onClick={() =>
                    setRescueStrategyOpen(
                      !rescueStrategyOpen
                    )
                  }
                  style={{
                    minHeight: 45,
                    padding: "9px 11px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11.75,
                        fontWeight: 700,
                        color: "var(--text)",
                      }}
                    >
                      How should Abide choose?
                    </div>

                    <div
                      style={{
                        fontSize: 10.25,
                        color: "var(--text3)",
                        marginTop: 2,
                      }}
                    >
                      {rescueStrategyLabel}
                    </div>
                  </div>

                  {rescueStrategyOpen ? (
                    <ChevronDown
                      size={14}
                      color="var(--text3)"
                    />
                  ) : (
                    <ChevronRight
                      size={14}
                      color="var(--text3)"
                    />
                  )}
                </div>

                {rescueStrategyOpen && (
                  <div
                    style={{
                      padding:
                        "0 11px 11px",
                      borderTop:
                        "1px solid var(--divider)",
                    }}
                  >
                    <div
                      className="filter-row"
                      style={{
                        padding:
                          "10px 0 0",
                        overflowX:
                          "visible",
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        [
                          "balanced",
                          "Balanced",
                        ],
                        [
                          "urgency",
                          "Urgency first",
                        ],
                        [
                          "custom",
                          "Custom mix",
                        ],
                      ].map(
                        ([key, label]) => (
                          <div
                            key={key}
                            className={`filter-chip ${
                              rescueStrategy ===
                              key
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              setRescueStrategy(
                                key
                              )
                            }
                          >
                            {label}
                          </div>
                        )
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--text3)",
                        lineHeight: 1.45,
                        marginTop: 7,
                      }}
                    >
                      {rescueStrategy ===
                      "urgency"
                        ? "Highest urgency wins. Paused Areas stay out."
                        : rescueStrategy ===
                            "custom"
                          ? "You decide how many slots each Area should receive."
                          : "Abide spreads the list across active Areas while still respecting urgency."}
                    </div>
                  </div>
                )}
              </div>

              {/* ==============================================
                  COLLAPSIBLE: AREA MIX
              ============================================== */}
              {rescueAreaKeys.length > 0 && (
                <div
                  style={{
                    border:
                      "1px solid var(--divider)",
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  <div
                    onClick={() =>
                      setRescueAreasOpen(
                        !rescueAreasOpen
                      )
                    }
                    style={{
                      minHeight: 45,
                      padding: "9px 11px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "space-between",
                      gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.75,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        Area mix
                      </div>

                      <div
                        style={{
                          fontSize: 10.25,
                          color: "var(--text3)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {rescueAreaSummary}
                      </div>
                    </div>

                    {rescueAreasOpen ? (
                      <ChevronDown
                        size={14}
                        color="var(--text3)"
                      />
                    ) : (
                      <ChevronRight
                        size={14}
                        color="var(--text3)"
                      />
                    )}
                  </div>

                  {rescueAreasOpen && (
                    <div
                      style={{
                        padding:
                          "10px 11px 11px",
                        borderTop:
                          "1px solid var(--divider)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "var(--text3)",
                          lineHeight: 1.45,
                          marginBottom: 8,
                        }}
                      >
                        Include = eligible · Protect = make room for this Area ·
                        Pause = leave it out of today’s Rescue plan.
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        {rescueAreaKeys.map(
                          (areaKey) => {
                            const pref =
                              rescueAreaPreference(
                                areaKey
                              );

                            const areaTaskCount =
                              rescueCandidateTasks.filter(
                                (task) =>
                                  rescueAreaKey(
                                    task
                                  ) === areaKey
                              ).length;

                            return (
                              <div
                                key={`compact-rescue-area-${areaKey}`}
                                style={{
                                  padding:
                                    "9px 10px",
                                  borderRadius:
                                    11,
                                  background:
                                    "var(--subtleBg)",
                                  border:
                                    "1px solid var(--divider)",
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
                                    gap: 8,
                                  }}
                                >
                                  <div
                                    style={{
                                      minWidth: 0,
                                      display:
                                        "flex",
                                      alignItems:
                                        "center",
                                      gap: 7,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius:
                                          99,
                                        background:
                                          rescueAreaColor(
                                            areaKey
                                          ),
                                        flexShrink:
                                          0,
                                      }}
                                    />

                                    <div>
                                      <div
                                        style={{
                                          fontSize:
                                            11.75,
                                          fontWeight:
                                            700,
                                          color:
                                            "var(--text)",
                                        }}
                                      >
                                        {rescueAreaName(
                                          areaKey
                                        )}
                                      </div>

                                      <div
                                        style={{
                                          fontSize:
                                            9.75,
                                          color:
                                            "var(--text3)",
                                          marginTop:
                                            1,
                                        }}
                                      >
                                        {areaTaskCount}{" "}
                                        {areaTaskCount ===
                                        1
                                          ? "task"
                                          : "tasks"}
                                      </div>
                                    </div>
                                  </div>

                                  {rescueStrategy ===
                                    "custom" &&
                                    pref.mode !==
                                      "pause" && (
                                      <div
                                        style={{
                                          display:
                                            "flex",
                                          alignItems:
                                            "center",
                                          gap: 5,
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setRescueAreaSlots(
                                              areaKey,
                                              pref.slots -
                                                1
                                            )
                                          }
                                          style={{
                                            width:
                                              26,
                                            height:
                                              26,
                                            borderRadius:
                                              8,
                                            border:
                                              "1px solid var(--pillBorder)",
                                            background:
                                              "var(--pillBg)",
                                            color:
                                              "var(--text)",
                                            cursor:
                                              "pointer",
                                          }}
                                        >
                                          −
                                        </button>

                                        <span
                                          style={{
                                            minWidth:
                                              18,
                                            textAlign:
                                              "center",
                                            fontSize:
                                              11,
                                            fontWeight:
                                              750,
                                          }}
                                        >
                                          {pref.slots}
                                        </span>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setRescueAreaSlots(
                                              areaKey,
                                              pref.slots +
                                                1
                                            )
                                          }
                                          style={{
                                            width:
                                              26,
                                            height:
                                              26,
                                            borderRadius:
                                              8,
                                            border:
                                              "1px solid var(--pillBorder)",
                                            background:
                                              "var(--pillBg)",
                                            color:
                                              "var(--text)",
                                            cursor:
                                              "pointer",
                                          }}
                                        >
                                          +
                                        </button>
                                      </div>
                                    )}
                                </div>

                                <div
                                  className="filter-row"
                                  style={{
                                    padding:
                                      "7px 0 0",
                                    overflowX:
                                      "visible",
                                    flexWrap:
                                      "wrap",
                                  }}
                                >
                                  {[
                                    [
                                      "include",
                                      "Include",
                                    ],
                                    [
                                      "protect",
                                      "Protect",
                                    ],
                                    [
                                      "pause",
                                      "Pause",
                                    ],
                                  ].map(
                                    ([
                                      mode,
                                      label,
                                    ]) => (
                                      <div
                                        key={mode}
                                        className={`filter-chip ${
                                          pref.mode ===
                                          mode
                                            ? "active"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          setRescueAreaMode(
                                            areaKey,
                                            mode
                                          )
                                        }
                                      >
                                        {label}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==============================================
                  STATUS AT A GLANCE
              ============================================== */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: 7,
                  marginTop: 3,
                }}
              >
                <div
                  style={{
                    padding: 9,
                    borderRadius: 11,
                    background:
                      "var(--subtleBg)",
                    border:
                      "1px solid var(--divider)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 750,
                      color:
                        rescueOverdueCount
                          ? "#E68080"
                          : "var(--text)",
                    }}
                  >
                    {rescueOverdueCount}
                  </div>

                  <div
                    style={{
                      fontSize: 9.75,
                      color: "var(--text3)",
                      marginTop: 2,
                    }}
                  >
                    Overdue
                  </div>
                </div>

                <div
                  style={{
                    padding: 9,
                    borderRadius: 11,
                    background:
                      "var(--subtleBg)",
                    border:
                      "1px solid var(--divider)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 750,
                      color: "var(--text)",
                    }}
                  >
                    {rescueDueThisWeekCount}
                  </div>

                  <div
                    style={{
                      fontSize: 9.75,
                      color: "var(--text3)",
                      marginTop: 2,
                    }}
                  >
                    Due ≤ 7 days
                  </div>
                </div>

                <div
                  style={{
                    padding: 9,
                    borderRadius: 11,
                    background:
                      "var(--subtleBg)",
                    border:
                      "1px solid var(--divider)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 750,
                      color:
                        rescueTargetBehindCount
                          ? "#E8B45C"
                          : "var(--text)",
                    }}
                  >
                    {rescueTargetBehindCount}
                  </div>

                  <div
                    style={{
                      fontSize: 9.75,
                      color: "var(--text3)",
                      marginTop: 2,
                    }}
                  >
                    Target slipped
                  </div>
                </div>
              </div>

              {/* ==============================================
                  THE ACTUAL RESCUE PLAN
              ============================================== */}
              <div
                className="fb-label"
                style={{
                  marginTop: 14,
                }}
              >
                Do now ·{" "}
                {rescueCapacityLabel(
                  rescueCapacity
                )}{" "}
                capacity
              </div>

              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text3)",
                  marginBottom: 5,
                  lineHeight: 1.4,
                }}
              >
                {rescueStrategyLabel} ·{" "}
                {rescueTodayLimit} focus{" "}
                {rescueTodayLimit === 1
                  ? "task"
                  : "tasks"}
              </div>

              {rescueTodayTasks.map(
                (task, index) => {
                  const target =
                    taskPersonalTargetKey(
                      task
                    );

                  const dueOffset =
                    taskOffsetDays(task);

                  return (
                    <div
                      key={`compact-rescue-now-${task.id}`}
                      style={{
                        padding:
                          "11px 0",
                        borderBottom:
                          "1px solid var(--divider)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 9,
                          alignItems:
                            "flex-start",
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 8,
                            background:
                              "#E8B45C22",
                            color: "#E8B45C",
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize: 11,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {index + 1}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color:
                                "var(--text)",
                            }}
                          >
                            {task.title}
                          </div>

                          <div
                            style={{
                              fontSize:
                                10.5,
                              color:
                                "var(--text3)",
                              marginTop: 3,
                              lineHeight:
                                1.45,
                            }}
                          >
                            {dueOffset < 0
                              ? `Overdue ${Math.abs(
                                  dueOffset
                                )} day${
                                  Math.abs(
                                    dueOffset
                                  ) === 1
                                    ? ""
                                    : "s"
                                }`
                              : dueOffset === 0
                                ? "Due today"
                                : `Due ${formatDateLabel(
                                    taskDateKey(
                                      task
                                    )
                                  )}`}
                            {" · "}
                            {rescueAreaName(
                              rescueAreaKey(
                                task
                              )
                            )}
                            {task.priority ===
                            "high"
                              ? " · High priority"
                              : ""}
                            {target
                              ? ` · Target ${formatDateLabel(
                                  target
                                )}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 8,
                          paddingLeft: 33,
                        }}
                      >
                        <div
                          className="filter-chip active"
                          onClick={() =>
                            toggleDone(
                              task.id
                            )
                          }
                        >
                          <Check size={11} />
                          Done
                        </div>

                        {dueOffset >= 0 && (
                          <div
                            className="filter-chip"
                            onClick={() =>
                              rescueSetTargetToday(
                                task
                              )
                            }
                          >
                            <Clock
                              size={11}
                            />
                            Target today
                          </div>
                        )}

                        {dueOffset < 0 && (
                          <>
                            <div
                              className="filter-chip"
                              onClick={() =>
                                rescueRescheduleTask(
                                  task,
                                  1
                                )
                              }
                            >
                              Tomorrow
                            </div>

                            <div
                              className="filter-chip"
                              onClick={() =>
                                rescueRescheduleTask(
                                  task,
                                  3
                                )
                              }
                            >
                              +3 days
                            </div>
                          </>
                        )}

                        <div
                          className="filter-chip"
                          onClick={() =>
                            openEditor(task)
                          }
                        >
                          <Pencil
                            size={11}
                          />
                          Open
                        </div>
                      </div>
                    </div>
                  );
                }
              )}

              {rescueLaterTasks.length >
                0 && (
                <>
                  <div
                    className="fb-label"
                    style={{
                      marginTop: 14,
                    }}
                  >
                    Not today
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--text3)",
                      lineHeight: 1.4,
                      marginBottom: 3,
                    }}
                  >
                    Still visible, but intentionally outside your immediate
                    Rescue capacity.
                  </div>

                  {rescueLaterTasks
                    .slice(0, 6)
                    .map((task) => {
                      const overdue =
                        taskOffsetDays(
                          task
                        ) < 0;

                      const areaMode =
                        rescueAreaPreference(
                          rescueAreaKey(
                            task
                          )
                        ).mode;

                      return (
                        <div
                          key={`compact-rescue-later-${task.id}`}
                          style={{
                            padding:
                              "8px 0",
                            display: "flex",
                            alignItems:
                              "center",
                            gap: 8,
                            borderBottom:
                              "1px solid var(--divider)",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                color:
                                  "var(--body)",
                                overflow:
                                  "hidden",
                                textOverflow:
                                  "ellipsis",
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {task.title}
                            </div>

                            <div
                              style={{
                                fontSize:
                                  10.1,
                                color:
                                  "var(--text3)",
                                marginTop: 2,
                              }}
                            >
                              {areaMode ===
                              "pause"
                                ? `${rescueAreaName(
                                    rescueAreaKey(
                                      task
                                    )
                                  )} paused for today`
                                : overdue
                                  ? `${rescueAreaName(
                                      rescueAreaKey(
                                        task
                                      )
                                    )} · Needs a decision`
                                  : `${rescueAreaName(
                                      rescueAreaKey(
                                        task
                                      )
                                    )} · ${formatDateLabel(
                                      taskDateKey(
                                        task
                                      )
                                    )}`}
                            </div>
                          </div>

                          {overdue &&
                          areaMode !==
                            "pause" ? (
                            <div
                              className="filter-chip"
                              onClick={() =>
                                rescueRescheduleTask(
                                  task,
                                  1
                                )
                              }
                            >
                              Tomorrow
                            </div>
                          ) : (
                            <div
                              className="filter-chip"
                              onClick={() =>
                                openEditor(
                                  task
                                )
                              }
                            >
                              Review
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {rescueLaterTasks.length >
                    6 && (
                    <div
                      style={{
                        fontSize:
                          10.5,
                        color:
                          "var(--text3)",
                        marginTop: 7,
                      }}
                    >
                      +
                      {rescueLaterTasks.length -
                        6}{" "}
                      more outside today’s Rescue list.
                    </div>
                  )}
                </>
              )}

              <div
                style={{
                  marginTop: 13,
                  padding: "10px 11px",
                  borderRadius: 12,
                  background:
                    "rgba(143,168,138,0.10)",
                  border:
                    "1px solid rgba(143,168,138,0.24)",
                  fontSize: 11.25,
                  lineHeight: 1.5,
                  color: "var(--text2)",
                }}
              >
                <strong
                  style={{
                    color: "#8FA88A",
                  }}
                >
                  Start with #1.
                </strong>{" "}
                You do not need to solve the entire backlog at once.
              </div>
            </div>
          </div>
        )}

        <div className="capture-bar" style={{ cursor: "pointer" }} onClick={() => { setEditingTask(null); setAdding(!adding); }}><Plus size={16} />{adding ? "Close quick add" : "Add a task"}</div>
        {adding && (
          <AddSheet
            goals={goals}
            areas={areas}
            tasks={tasks}
            onDeleteTask={onDeleteTask}
            initialDate={REFERENCE_DATE_KEY}
            allowEvents={false}
            onClose={() => setAdding(false)}
            onCreateTask={onCreateTask}
            onCreateEvent={async () => {}}
            googleConnected={false}
            onCreateArea={onCreateArea}
          />
        )}

        {editingTask && (
          <TaskEditor
            task={editingTask}
            goals={goals}
            areas={areas}
            onSave={saveTask}
            onCancel={() => setEditingTask(null)}
            onDelete={deleteTask}
            onCreateArea={onCreateArea}
            childTasks={tasks.filter(
              (child) =>
                String(child.parentTaskId || "") === String(editingTask.id)
            )}
            onCreateChildTask={createChildTaskFromEditor}
            onOpenChildTask={openEditor}
          />
        )}

        {alertsOpen && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-label" style={{ margin: "10px 14px 4px 0" }}>Upcoming Reminders</div>
            {upcomingReminders.length ? upcomingReminders.map((t) => <div key={t.id} className="review-item"><span>{t.title}</span><span className="review-count">{taskReminderLabel(t)}</span></div>) : <div className="insight-line">No reminders set for the next day.</div>}
          </div>
        )}

        <FilterSystem
          areas={areas}
          selectedAreas={selectedAreas}
          setSelectedAreas={setSelectedAreas}
          selectedPriorities={selectedPriorities}
          setSelectedPriorities={setSelectedPriorities}
          selectedProgress={selectedProgress}
          setSelectedProgress={setSelectedProgress}
          showCompleted={showCompleted}
          setShowCompleted={setShowCompleted}
          savedFilters={savedFilters}
          setSavedFilters={setSavedFilters}
        />

        {overdue.length > 0 && (
          <>
            <div className="section-label">Overdue</div>
            <div className="card">{overdue.map(renderTask)}</div>
          </>
        )}

        <div className="section-label">Today</div>
        <div className="card">
          {today.length
            ? today.map(renderTask)
            : <div className="insight-line">No tasks due today. Tap “Add a task” above to create one.</div>}
        </div>

        <div className="section-label"><span>Coming Up</span></div>
        <div className="segmented" style={{ margin: "0 0 10px 0" }}>
          <div className={`seg-btn ${range === "week" ? "active" : ""}`} onClick={() => setRange("week")}>This Week</div>
          <div className={`seg-btn ${range === "twoweeks" ? "active" : ""}`} onClick={() => setRange("twoweeks")}>Next 2 Weeks</div>
        </div>
        <div className="card">
          {upcoming.length
            ? upcoming.map(renderTask)
            : <div className="insight-line">Nothing scheduled in this window.</div>}
        </div>

        <div className="section-label" onClick={() => setSomedayOpen(!somedayOpen)} style={{ cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Archive size={12} />Someday / Maybe ({somedayTasks.length})</span>
          {somedayOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        {somedayOpen && <div className="card"><div className="insight-line">No Someday / Maybe items yet.</div></div>}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   ADD SHEET (task / event, with protected-time bypass)
----------------------------------------------------------------*/
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function googleEventDateKey(event) {
  return event.start?.date || event.start?.dateTime?.slice(0, 10) || "";
}

function googleEventTimeLabel(event) {
  if (event.start?.date) return "All day";
  if (!event.start?.dateTime) return "";
  return new Date(event.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function AddSheet({
  goals,
  areas,
  initialDate,
  onClose,
  onCreateTask,
  onCreateEvent,
  googleConnected,
  googleAccounts = [],
  microsoftAccounts = [],
  allowEvents = true,
  onCreateArea,
  tasks = [],
  onDeleteTask = null,
}) {
  const [kind, setKind] = useState("task");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || REFERENCE_DATE_KEY);
  const [time, setTime] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [area, setArea] = useState(Object.keys(areas)[0] || "");
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState("med");
  const [recurrence, setRecurrence] = useState(null);
  const [reminder, setReminder] = useState("None");
  const [reminderAt, setReminderAt] = useState("");
  const [activityDraft, setActivityDraft] = useState("");

  /* ABIDE CALENDAR FULL SUBTASKS V2 */
  const [
    pendingSubtasks,
    setPendingSubtasks,
  ] = useState([]);

  const [
    editingPendingSubtask,
    setEditingPendingSubtask,
  ] = useState(null);

  const openPendingSubtask = (
    existing = null
  ) => {
    if (existing) {
      setEditingPendingSubtask(
        existing
      );
      return;
    }

    const childDate =
      date ||
      REFERENCE_DATE_KEY;

    setEditingPendingSubtask({
      id:
        `pending_child_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}`,

      _pendingCalendarChild:
        true,

      parentTaskId:
        "__pending_parent__",

      kind:
        "task",

      title:
        "",

      dueDate:
        childDate,

      dueTime:
        null,

      due:
        formatDateLabel(
          childDate
        ),

      dueOffsetDays:
        offsetFromDateKey(
          childDate
        ),

      targetDate:
        null,

      priority,

      progress:
        "not_started",

      area:
        area || null,

      goal:
        goal || null,

      notes:
        "",

      activities:
        [],

      recurrence:
        null,

      repeat:
        null,

      reminder:
        "None",

      reminderAt:
        null,

      status:
        "next",

      done:
        false,

      completedAt:
        null,

      bypassProtected:
        bypass,

      createdAt:
        new Date()
          .toISOString(),
    });
  };

  const savePendingSubtask = (
    updated
  ) => {
    const pendingId =
      editingPendingSubtask?.id ||
      updated.id;

    const next = {
      ...updated,

      id:
        pendingId,

      _pendingCalendarChild:
        true,

      parentTaskId:
        "__pending_parent__",
    };

    setPendingSubtasks(
      (current) => {
        const exists =
          current.some(
            (item) =>
              item.id ===
              pendingId
          );

        if (exists) {
          return current.map(
            (item) =>
              item.id ===
              pendingId
                ? next
                : item
          );
        }

        return [
          ...current,
          next,
        ];
      }
    );

    setEditingPendingSubtask(
      null
    );
  };

  const removePendingSubtask = (
    id
  ) => {
    setPendingSubtasks(
      (current) =>
        current.filter(
          (item) =>
            item.id !== id
        )
    );

    if (
      editingPendingSubtask?.id ===
      id
    ) {
      setEditingPendingSubtask(
        null
      );
    }
  };

  const [bypass, setBypass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eventDestination, setEventDestination] = useState(() => {
    if (googleAccounts[0]?.id) {
      return `google::${googleAccounts[0].id}`;
    }

    const firstMicrosoft = microsoftAccounts
      .flatMap((account) =>
        (account.calendars || [])
          .filter((calendar) => calendar.canEdit !== false)
          .map((calendar) => ({
            accountId: account.id,
            calendarId: calendar.id,
          }))
      )[0];

    if (firstMicrosoft) {
      return `microsoft::${firstMicrosoft.accountId}::${firstMicrosoft.calendarId}`;
    }

    return "abide";
  });

  const eventDestinations = [
    {
      id: "abide",
      label: "Abide only",
    },
    ...googleAccounts.map((account) => ({
      id: `google::${account.id}`,
      label: `${account.displayName || "Google Account"} · Google`,
    })),
    ...microsoftAccounts.flatMap((account) =>
      (account.calendars || [])
        .filter((calendar) => calendar.canEdit !== false)
        .map((calendar) => ({
          id: `microsoft::${account.id}::${calendar.id}`,
          label: `${calendar.label} · ${account.displayName || "Microsoft"}`,
        }))
    ),
  ];

  const selectedDestination =
    eventDestinations.find((destination) => destination.id === eventDestination) ||
    eventDestinations[0];
  const save = async () => {
    if (!title.trim() || !date || saving) return;
    setSaving(true);
    try {
      if (kind === "task") {
        const parentTaskId = onCreateTask({
          title: title.trim(),
          dueDate: date,
          dueTime: time || null,
          due: time
            ? formatTimeLabel(time)
            : formatDateLabel(date),
          dueOffsetDays: offsetFromDateKey(date),
          targetDate:
            targetDate &&
            targetDate <= date
              ? targetDate
              : null,
          priority,
          area: area || null,
          goal: goal || null,
          notes: "",
          activities:
            activityDraft.trim()
              ? [{
                  id: `act_${Date.now()}`,
                  text: activityDraft.trim(),
                  createdAt: new Date().toISOString(),
                }]
              : [],
          repeat:
            recurrence
              ? recurrenceLabel(recurrence)
              : null,
          recurrence,
          reminder,
          reminderAt:
            reminder === "Custom"
              ? reminderAt || null
              : null,
          done: false,
          status: "next",
          bypassProtected: bypass,
        });

        if (
          parentTaskId &&
          pendingSubtasks.length
        ) {
          pendingSubtasks.forEach(
            (pending) => {
              const {
                id,
                _pendingCalendarChild,
                parentTaskId:
                  _temporaryParent,
                ...child
              } = pending;

              onCreateTask({
                ...child,

                parentTaskId,

                kind:
                  "task",
              });
            }
          );
        }
      } else {
        await onCreateEvent({
          title: title.trim(),
          date,
          time,
          area: area || null,
          recurrence,
          notes: "",
          activities: activityDraft.trim()
            ? [{
                id: `act_${Date.now()}`,
                text: activityDraft.trim(),
                createdAt: new Date().toISOString(),
              }]
            : [],
          bypassProtected: bypass,
          eventDestination,
        });
      }
      onClose();
    } finally { setSaving(false); }
  };

  if (kind === "import") {
    return <ImportTasksPanel
          tasks={tasks}
          onDeleteTask={onDeleteTask} areas={areas} onCreateArea={onCreateArea} onCreateTask={onCreateTask} onClose={onClose} />;
  }

  return (
    <div className="card composer-card">
      <div className="segmented" style={{ margin: "0 0 4px 0" }}>
        <div className={`seg-btn ${kind === "task" ? "active" : ""}`} onClick={() => setKind("task")}>Task</div>
        {allowEvents && <div className={`seg-btn ${kind === "event" ? "active" : ""}`} onClick={() => setKind("event")}>Event</div>}
        <div className={`seg-btn ${kind === "import" ? "active" : ""}`} onClick={() => setKind("import")}>Import</div>
      </div>
      <input className="input-line" placeholder={kind === "task" ? "Task title" : "Event title"} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}><input type="date" className="input-line" style={{ flex: 1 }} value={date} onChange={(e) => { const next=e.target.value; setDate(next); if (targetDate && targetDate > next) setTargetDate(""); }} /><input type="time" className="input-line" style={{ flex: 1 }} value={time} onChange={(e) => setTime(e.target.value)} /></div>

      {kind === "task" && (
        <>
          <div className="fb-label">
            Finish by (optional)
          </div>

          <input
            type="date"
            className="input-line"
            style={{ marginTop: 0 }}
            value={targetDate}
            max={date || undefined}
            onChange={(e) =>
              setTargetDate(e.target.value)
            }
          />

          <div
            style={{
              fontSize: 10.75,
              color: "var(--text3)",
              marginTop: 5,
              lineHeight: 1.45,
            }}
          >
            Use this when you want the task finished before its real deadline.
          </div>
        </>
      )}

      <div className="fb-label">Area</div><QuickAreaPicker areas={areas} value={area} onChange={setArea} onCreateArea={onCreateArea} />
      {kind === "task" && <><div className="fb-label">Priority</div><div className="filter-row" style={{ padding: "0 0 2px 0" }}>{[["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([k, label]) => <div key={k} className={`filter-chip ${priority === k ? "active" : ""}`} onClick={() => setPriority(k)}>{label}</div>)}</div><div className="fb-label">Goal (optional)</div><div className="filter-row" style={{ padding: "0 0 2px 0" }}><div className={`filter-chip ${goal === "" ? "active" : ""}`} onClick={() => setGoal("")}>No Goal</div>{goals.map((g) => <div key={g.id} className={`filter-chip ${goal === g.id ? "active" : ""}`} onClick={() => setGoal(g.id)}>{g.name}</div>)}</div><div className="fb-label">Reminder</div><ReminderPicker
  value={reminder}
  onChange={setReminder}
  reminderAt={reminderAt}
  onReminderAtChange={setReminderAt}
/>{/* ABIDE CALENDAR FULL SUBTASK UI V2 */}
<div className="fb-label">
  Subtasks
</div>

{pendingSubtasks.length > 0 && (
  <div
    className="card"
    style={{
      padding:
        "2px 11px",
      marginBottom:
        8,
      background:
        "var(--subtleBg)",
    }}
  >
    {pendingSubtasks.map(
      (subtask, index) => (
        <div
          key={
            subtask.id
          }
          style={{
            minHeight:
              52,

            display:
              "flex",

            alignItems:
              "center",

            gap:
              9,

            padding:
              "8px 0",

            borderBottom:
              index ===
              pendingSubtasks.length - 1
                ? "none"
                : "1px solid var(--divider)",
          }}
        >
          <Check
            size={13}
            color="var(--text3)"
          />

          <div
            onClick={() =>
              openPendingSubtask(
                subtask
              )
            }
            style={{
              flex: 1,
              minWidth: 0,
              cursor:
                "pointer",
            }}
          >
            <div
              style={{
                fontSize:
                  12.5,

                fontWeight:
                  650,

                color:
                  "var(--text)",

                overflow:
                  "hidden",

                textOverflow:
                  "ellipsis",

                whiteSpace:
                  "nowrap",
              }}
            >
              {subtask.title}
            </div>

            <div
              style={{
                marginTop:
                  2,

                fontSize:
                  10.5,

                color:
                  "var(--text3)",
              }}
            >
              {formatDateLabel(
                taskDateKey(
                  subtask
                )
              )}

              {subtask.dueTime
                ? ` · ${formatTimeLabel(
                    subtask.dueTime
                  )}`
                : ""}

              {` · ${
                subtask.priority ===
                "high"
                  ? "High"
                  : subtask.priority ===
                    "low"
                    ? "Low"
                    : "Medium"
              }`}
            </div>
          </div>

          <div
            onClick={() =>
              openPendingSubtask(
                subtask
              )
            }
            style={{
              padding:
                4,

              cursor:
                "pointer",

              color:
                "var(--text3)",
            }}
          >
            <Pencil
              size={13}
            />
          </div>

          <div
            onClick={() =>
              removePendingSubtask(
                subtask.id
              )
            }
            style={{
              padding:
                4,

              cursor:
                "pointer",

              color:
                "#E68080",
            }}
          >
            <X
              size={14}
            />
          </div>
        </div>
      )
    )}
  </div>
)}

<div
  className="filter-chip active"
  onClick={() =>
    openPendingSubtask()
  }
  style={{
    width:
      "fit-content",

    marginTop:
      7,
  }}
>
  <Plus
    size={12}
  />

  Add Subtask
</div>

<div
  style={{
    marginTop:
      7,

    fontSize:
      10.75,

    lineHeight:
      1.45,

    color:
      "var(--text3)",
  }}
>
  Configure each subtask like a full task before saving it:
  due date, time, Finish By, priority, progress, Area, goal,
  repeat schedule, reminder, and activity.
</div></>}
      <div className="fb-label">Repeat</div><RecurrenceEditor value={recurrence} onChange={setRecurrence} dateKey={date} />
      <div className="fb-label">First Activity (optional)</div><textarea className="notes-box" rows={2} value={activityDraft} onChange={(e) => setActivityDraft(e.target.value)} placeholder={kind === "task" ? "Add the first task update…" : "Add the first event update…"} />
      {kind === "event" && (
        <>
          <div className="fb-label">Save event to</div>
          <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
            {eventDestinations.map((destination) => (
              <div
                key={destination.id}
                className={`filter-chip ${
                  eventDestination === destination.id ? "active" : ""
                }`}
                onClick={() => setEventDestination(destination.id)}
              >
                {destination.label}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: "var(--text3)",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <RefreshCw size={11} />
            {eventDestination === "abide"
              ? "This event will stay inside Abide."
              : `This event will be added to ${selectedDestination?.label || "the selected calendar"}.`}
          </div>
        </>
      )}
      <div className="settings-row" style={{ padding: "12px 0 2px 0", borderBottom: "none" }}><div className="settings-row-name"><ShieldCheck size={15} color="#8FA88A" />Bypass protected time blocks</div><Toggle on={bypass} onClick={() => setBypass(!bypass)} /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><div className="filter-chip active" style={{ flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }} onClick={save}>{saving
  ? "Saving…"
  : kind === "task" && pendingSubtasks.length
    ? `Save Task + ${pendingSubtasks.length} Subtask${
        pendingSubtasks.length === 1 ? "" : "s"
      }`
    : `Save ${kind === "task" ? "Task" : "Event"}`}</div><div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</div></div>
      {/* ABIDE CALENDAR PENDING SUBTASK EDITOR V2 */}
      {editingPendingSubtask && (
        <TaskEditor
          key={
            editingPendingSubtask.id
          }

          task={
            editingPendingSubtask
          }

          goals={
            goals
          }

          areas={
            areas
          }

          onSave={
            savePendingSubtask
          }

          onCancel={() =>
            setEditingPendingSubtask(
              null
            )
          }

          onDelete={() => {
            removePendingSubtask(
              editingPendingSubtask.id
            );

            setEditingPendingSubtask(
              null
            );
          }}

          onCreateArea={
            onCreateArea
          }

          childTasks={[]}
        />
      )}

    </div>
  );
}


function EventEditor({ event, areas, onSave, onCancel }) {
  const modalRef = useRef(null);
  const isExternalCalendar =
    event.source === "google" || event.source === "microsoft";
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
    const nextTitle = isExternalCalendar ? event.title : title.trim();
    if (!nextTitle) return;
    onSave({
      ...event,
      title: nextTitle,
      date: isExternalCalendar ? event.date : date,
      area: isExternalCalendar ? event.area : (area || null),
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
              {isExternalCalendar && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
                  External calendar details are read-only here. Abide activity stays editable.
                </div>
              )}
            </div>
            <div className="editor-close" onClick={onCancel}><X size={17} /></div>
          </div>

          <div className="editor-scroll">
            <div className="fb-label">Event</div>
            <input
              className="input-line"
              style={{ marginTop: 0 }}
              value={title}
              disabled={isExternalCalendar}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
            />

            {isExternalCalendar ? (
              <div className="card" style={{ padding: 12, marginTop: 10 }}>
                <div className="field-row"><span className="field-label">Date</span><span className="field-value">{event.date ? formatDateLabel(event.date) : "No date"}</span></div>
                <div className="field-row"><span className="field-label">Time</span><span className="field-value">{event.time || "All day"}</span></div>
                <div className="field-row"><span className="field-label">Calendar</span><span className="field-value">
                  {event.calendarLabel ||
                    (event.source === "microsoft"
                      ? "Outlook Calendar"
                      : "Google Calendar")}
                </span></div>
              </div>
            ) : (
              <>
                <div className="fb-label">Date</div>
                <input type="date" className="input-line" style={{ marginTop: 0 }} value={date} onChange={(e) => setDate(e.target.value)} />
                <div className="fb-label">Area</div>
                <QuickAreaPicker areas={areas} value={area} onChange={setArea} />
              </>
            )}

            <div className="fb-label">Notes</div>

            <div
              style={{
                padding: "10px 11px",
                borderRadius: 12,
                background: "var(--subtleBg)",
                border: "1px solid var(--divider)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.25,
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    Work on this in Notes
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      lineHeight: 1.4,
                      color: "var(--text3)",
                      marginTop: 3,
                    }}
                  >
                    Creates linked working notes while leaving the event on
                    the calendar.
                  </div>
                </div>

                <div
                  className="filter-chip"
                  style={{ flexShrink: 0 }}
                  onClick={() =>
                    sendToNotesAndOfferOpen(
                      event,
                      "event"
                    )
                  }
                >
                  Send to Notes
                </div>
              </div>
            </div>

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

function CalendarsPanel({ accounts, setAccounts, configured, onConnect, onRefresh, onDisconnect, onToggleCalendar, onRenameAccount, error }) {
  const connectedAccounts = accounts.filter((a) => a.token);
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="card cal-account" style={{ marginBottom: 10 }}>
        <div className="cal-account-title">Connected Google accounts</div>
        {!configured ? (
          <div className="insight-line" style={{ padding: "8px 0 4px" }}>Google Calendar is ready in the code, but the Google OAuth client ID still needs to be added to Abide before it can connect.</div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "7px 0 10px" }}>Connect personal, work, or any other Google account. Abide merges the calendars into one view.</div>
            <div className="filter-chip active" style={{ display: "inline-flex" }} onClick={onConnect}><Plus size={12} />Add Google Account</div>
          </>
        )}
      </div>

      {connectedAccounts.map((account) => (
        <div className="card cal-account" key={account.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div className="cal-account-title" style={{ display: "flex", alignItems: "center", gap: 7 }}>{account.displayName || "Google Account"}<Pencil size={12} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => onRenameAccount?.(account.id)} /></div>
              <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>{account.calendars?.length || 0} calendar{account.calendars?.length === 1 ? "" : "s"} · email hidden</div>
            </div>
            <div className="filter-chip" onClick={() => onDisconnect(account.id)}>Disconnect</div>
          </div>
          {(account.calendars || []).map((c) => (
            <div key={c.id} className="cal-item">
              <div className="cal-item-name"><span className="cal-swatch" style={{ background: c.color }} />{c.label}</div>
              <Toggle on={c.on} onClick={() => onToggleCalendar(account.id, c.id)} />
            </div>
          ))}
        </div>
      ))}

      {connectedAccounts.length > 0 && <div className="link-others" onClick={onRefresh}>Refresh all Google calendars →</div>}
      {error && <div style={{ fontSize: 11.5, color: "#E68080", marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function MicrosoftCalendarsPanel({ accounts, onConnect, onDisconnect, onToggleCalendar, error }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="card cal-account" style={{ marginBottom: 10 }}>
        <div className="cal-account-title">Outlook / Microsoft 365</div>
        <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "7px 0 10px" }}>
          Connect a personal Outlook account or a Microsoft 365 work or school account.
        </div>
        <div
          className="filter-chip active"
          style={{ display: "inline-flex" }}
          onClick={onConnect}
        >
          <Plus size={12} />
          Add Microsoft Account
        </div>
      </div>

      {accounts.map((account) => (
        <div className="card cal-account" key={account.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div className="cal-account-title">
                {account.displayName || "Microsoft Account"}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text3)",
                  marginTop: 2,
                  overflowWrap: "anywhere",
                }}
              >
                {account.email || "Microsoft account"} · {account.calendars?.length || 0} calendar{account.calendars?.length === 1 ? "" : "s"}
              </div>
            </div>

            <div
              className="filter-chip"
              style={{ flexShrink: 0 }}
              onClick={() => onDisconnect(account.id)}
            >
              Disconnect
            </div>
          </div>

          {(account.calendars || []).map((calendar) => (
            <div key={calendar.id} className="cal-item">
              <div className="cal-item-name">
                <span
                  className="cal-swatch"
                  style={{ background: calendar.color || "#0078D4" }}
                />
                {calendar.label}
              </div>

              <Toggle
                on={calendar.on !== false}
                onClick={() => onToggleCalendar(account.id, calendar.id)}
              />
            </div>
          ))}
        </div>
      ))}

      {error && (
        <div style={{ fontSize: 11.5, color: "#E68080", marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ tasks, goals, protectedBlocks, areas, toggleDone, onUpdateTask, onDeleteTask, onCreateTask, openAddSignal, onCreateArea }) {
  const [mode, setMode] = useState("week");
  const weekStart =
    useAbideWeekStart();
  const [selectedDateKey, setSelectedDateKey] = useState(REFERENCE_DATE_KEY);
  const [adding, setAdding] = useState(false);
  const [calsOpen, setCalsOpen] = useState(false);
  const [calendarPrefs, setCalendarPrefs] = usePersistentState("abide-google-calendar-prefs", {});
  const [events, setEvents] = usePersistentState("abide-calendar-events", []);
  const [googleError, setGoogleError] = useState("");
  const [googleAccounts, setGoogleAccounts] = useState(() => {
    try {
      // Current persistent storage.
      const persistent =
        localStorage.getItem("abideGoogleCalendarAccounts");

      if (persistent) {
        return JSON.parse(persistent);
      }

      // One-time migration from Abide's old session-only storage.
      const session =
        sessionStorage.getItem("abideGoogleCalendarAccounts");

      if (session) {
        const parsed = JSON.parse(session);

        localStorage.setItem(
          "abideGoogleCalendarAccounts",
          JSON.stringify(parsed)
        );

        return parsed;
      }

      const legacyToken =
        sessionStorage.getItem("abideGoogleCalendarToken");

      if (legacyToken) {
        const legacy = [
          {
            id: "legacy",
            label: "Previously connected Google",
            displayName: "Google Account",
            token: legacyToken,
            calendars: [],
          },
        ];

        localStorage.setItem(
          "abideGoogleCalendarAccounts",
          JSON.stringify(legacy)
        );

        return legacy;
      }

      return [];
    } catch {
      return [];
    }
  });

  const [microsoftError, setMicrosoftError] = useState("");
  const [microsoftAccounts, setMicrosoftAccounts] = useState(() => {
    try {
      const persistent =
        localStorage.getItem("abideMicrosoftCalendarAccounts");

      if (persistent) {
        return JSON.parse(persistent);
      }

      // One-time migration from the previous session-only storage.
      const session =
        sessionStorage.getItem("abideMicrosoftCalendarAccounts");

      if (session) {
        const parsed = JSON.parse(session);

        localStorage.setItem(
          "abideMicrosoftCalendarAccounts",
          JSON.stringify(parsed)
        );

        return parsed;
      }

      return [];
    } catch {
      return [];
    }
  });

  const tokenClientRef = useRef(null);
  const [overridden, setOverridden] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    let eventId = "";
    let dateKey = "";

    try {
      const params = new URLSearchParams(window.location.search);
      eventId = params.get("eventId") || "";
      dateKey = params.get("date") || "";
    } catch {
      return;
    }

    if (!eventId) return;

    const targetEvent = events.find(
      (event) => String(event.id) === String(eventId)
    );

    if (!targetEvent) return;

    setAdding(false);
    setEditingTask(null);

    setSelectedDateKey(
      targetEvent.date ||
      dateKey ||
      REFERENCE_DATE_KEY
    );

    setEditingEvent(targetEvent);

    try {
      const url = new URL(window.location.href);

      url.searchParams.delete("eventId");
      url.searchParams.delete("date");
      url.searchParams.delete("tab");

      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch {}
  }, [events]);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const googleConfigured = Boolean(googleClientId);
  const googleConnected = googleAccounts.some((a) => Boolean(a.token));
  const weekKeys = buildWeekKeys(selectedDateKey, weekStart);

  /* ABIDE CALENDAR WEEK NAVIGATION V1 */
  const weekStartDate =
    dateFromKey(weekKeys[0]);

  const weekEndDate =
    dateFromKey(
      weekKeys[
        weekKeys.length - 1
      ]
    );

  const weekRangeLabel = (() => {
    const sameYear =
      weekStartDate.getFullYear() ===
      weekEndDate.getFullYear();

    const sameMonth =
      sameYear &&
      weekStartDate.getMonth() ===
        weekEndDate.getMonth();

    if (sameMonth) {
      return `${weekStartDate.toLocaleDateString(
        "en-US",
        {
          month: "short",
        }
      )} ${weekStartDate.getDate()}–${weekEndDate.getDate()}, ${weekEndDate.getFullYear()}`;
    }

    if (sameYear) {
      return `${weekStartDate.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        }
      )} – ${weekEndDate.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        }
      )}, ${weekEndDate.getFullYear()}`;
    }

    return `${weekStartDate.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    )} – ${weekEndDate.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    )}`;
  })();

  const moveWeek = (direction) => {
    setSelectedDateKey(
      shiftDateKey(
        selectedDateKey,
        direction * 7
      )
    );

    setOverridden(false);
    setOverrideOpen(false);
  };

  const selectedDate = dateFromKey(selectedDateKey);
  const selectedMonthKey = selectedDateKey.slice(0, 7);
  const monthLabel = selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedDayName = selectedDate.toLocaleDateString("en-US", { weekday: "short" });
  const todaysBlock = protectedBlocks.find((b) => b.day === selectedDayName);
  const connectedGoogleAccounts = googleAccounts.filter((a) => a.token);
  const connectedMicrosoftAccounts = microsoftAccounts.filter((a) => a.token);

  const flatCalendars = connectedGoogleAccounts.flatMap((account) =>
    (account.calendars || []).map((c) => ({
      ...c,
      provider: "google",
      accountId: account.id,
      accountLabel: account.label,
    }))
  );

  const flatMicrosoftCalendars = connectedMicrosoftAccounts.flatMap((account) =>
    (account.calendars || []).map((c) => ({
      ...c,
      provider: "microsoft",
      accountId: account.id,
      accountLabel: account.displayName,
    }))
  );

  const activeCount = flatCalendars.filter((c) => c.on).length;
  const microsoftActiveCount = flatMicrosoftCalendars.filter((c) => c.on !== false).length;

  const visibleCalendarKeys = new Set(
    flatCalendars
      .filter((c) => c.on)
      .flatMap((c) => [
        `google::${c.accountId}::${c.id}`,
        `${c.accountId}::${c.id}`,
      ])
  );

  const visibleMicrosoftCalendarKeys = new Set(
    flatMicrosoftCalendars
      .filter((c) => c.on !== false)
      .map((c) => `microsoft::${c.accountId}::${c.id}`)
  );
  const dayTasks = tasks.filter((t) => taskDateKey(t) === selectedDateKey);
  const dayEvents = events.filter((e) => {
    if (e.date !== selectedDateKey) return false;

    if (e.source === "google") {
      return visibleCalendarKeys.has(
        e.calendarKey ||
          `google::${e.accountId || "legacy"}::${e.calendarId}`
      );
    }

    if (e.source === "microsoft") {
      return visibleMicrosoftCalendarKeys.has(
        e.calendarKey ||
          `microsoft::${e.accountId}::${e.calendarId}`
      );
    }

    return true;
  });

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const taskSearchResults = normalizedSearchQuery
    ? tasks.filter((task) => {
        const areaName = task.area && areas[task.area] ? areas[task.area].name : "";
        const goalName = goals.find((goal) => String(goal.id) === String(task.goal))?.name || "";
        const activityText = normalizeActivity(task).map((item) => item.text).join(" ");

        return [
          task.title,
          areaName,
          goalName,
          task.notes,
          activityText,
          taskProgressLabel(task),
          formatDateLabel(taskDateKey(task)),
        ].join(" ").toLowerCase().includes(normalizedSearchQuery);
      })
    : [];

  const eventSearchResults = normalizedSearchQuery
    ? events.filter((event) => {
        if (
          event.source === "google" &&
          !visibleCalendarKeys.has(
            event.calendarKey ||
              `google::${event.accountId || "legacy"}::${event.calendarId}`
          )
        ) return false;

        if (
          event.source === "microsoft" &&
          !visibleMicrosoftCalendarKeys.has(
            event.calendarKey ||
              `microsoft::${event.accountId}::${event.calendarId}`
          )
        ) return false;

        const areaName = event.area && areas[event.area] ? areas[event.area].name : "";
        const activityText = normalizeActivity(event).map((item) => item.text).join(" ");

        return [
          event.title,
          event.calendarLabel,
          event.accountLabel,
          areaName,
          event.notes,
          activityText,
          event.date ? formatDateLabel(event.date) : "",
          event.time,
        ].join(" ").toLowerCase().includes(normalizedSearchQuery);
      })
    : [];

  const searchResultCount = taskSearchResults.length + eventSearchResults.length;

  useEffect(() => { if (openAddSignal) setAdding(true); }, [openAddSignal]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "abideGoogleCalendarAccounts",
        JSON.stringify(googleAccounts)
      );

      // Clean up Abide's old session-only copies after migration.
      sessionStorage.removeItem("abideGoogleCalendarAccounts");
      sessionStorage.removeItem("abideGoogleCalendarToken");
    } catch {}
  }, [googleAccounts]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "abideMicrosoftCalendarAccounts",
        JSON.stringify(microsoftAccounts)
      );

      sessionStorage.removeItem(
        "abideMicrosoftCalendarAccounts"
      );
    } catch {}
  }, [microsoftAccounts]);

  const disconnectGoogleAccount = async (accountId) => {
    try {
      await callGoogleCalendarBackend(
        GOOGLE_CALENDAR_DISCONNECT_ENDPOINT,
        {
          accountId,
        }
      );
    } catch {
      // Local disconnect should still succeed
      // if Google was already revoked elsewhere.
    }

    setGoogleAccounts(
      (prev) =>
        prev.filter(
          (account) =>
            account.id !== accountId
        )
    );

    setEvents(
      (prev) =>
        prev.filter(
          (event) =>
            !(
              event.source === "google" &&
              event.accountId === accountId
            )
        )
    );
  };

  const renameGoogleAccount = (accountId) => {
    const account = googleAccounts.find((a) => a.id === accountId);
    const next = window.prompt("Name this Google account in Abide (for example, Personal or Work):", account?.displayName || "Google Account");
    if (!next?.trim()) return;
    setGoogleAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, displayName: next.trim() } : a));
  };

  const toggleGoogleCalendar = (accountId, calendarId) => {
    const account = googleAccounts.find((a) => a.id === accountId);
    const calendar = account?.calendars?.find((c) => c.id === calendarId);
    const nextOn = !Boolean(calendar?.on);
    const key = `${accountId}::${calendarId}`;
    setCalendarPrefs((prev) => ({ ...prev, [key]: nextOn }));
    setGoogleAccounts((prev) => prev.map((item) => item.id !== accountId ? item : {
      ...item,
      calendars: (item.calendars || []).map((cal) => cal.id === calendarId ? { ...cal, on: nextOn } : cal),
    }));
  };

  const callGoogleCalendarBackend = async (
    endpoint,
    payload = {}
  ) => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "Sign in to Abide before connecting Google Calendar."
      );
    }

    const firebaseToken =
      await user.getIdToken();

    const response =
      await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${firebaseToken}`,
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(payload),
      });

    let json = {};

    try {
      json = await response.json();
    } catch {}

    if (!response.ok) {
      const error =
        new Error(
          json?.error ||
          "Google Calendar request failed."
        );

      error.reconnectRequired =
        Boolean(
          json?.reconnectRequired
        );

      error.status =
        response.status;

      throw error;
    }

    return json;
  };

  const getGoogleAccessToken = async (
    accountId,
    fallbackToken = ""
  ) => {
    if (accountId) {
      try {
        const result =
          await callGoogleCalendarBackend(
            GOOGLE_CALENDAR_TOKEN_ENDPOINT,
            {
              accountId,
            }
          );

        if (result?.accessToken) {
          return result.accessToken;
        }
      } catch (error) {
        // Accounts connected before this upgrade do
        // not yet have a server refresh token.
        // Their current browser token may still work
        // until the user completes the one-time upgrade.
        if (
          fallbackToken &&
          error?.status === 404
        ) {
          return fallbackToken;
        }

        throw error;
      }
    }

    if (fallbackToken) {
      return fallbackToken;
    }

    throw new Error(
      "Google Calendar needs to be connected."
    );
  };

  const fetchGoogleAccountData = async (token, knownAccountId = "") => {
    setGoogleError("");

    try {
      const activeToken =
        await getGoogleAccessToken(
          knownAccountId,
          token
        );

      const headers = {
        Authorization:
          `Bearer ${activeToken}`,
      };
      const calRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers });
      if (calRes.status === 401) {
        // Keep the account/calendar configuration intact.
        // An expired access token should not look like the user
        // disconnected their calendar.
        throw new Error(
          "Google Calendar access needs to be refreshed. Your connected account and calendar settings have been preserved."
        );
      }
      if (!calRes.ok) throw new Error("Could not load Google calendars for this account.");
      const calJson = await calRes.json();
      const items = calJson.items || [];
      const primary = items.find((c) => c.primary) || items[0];
      if (!primary) throw new Error("This Google account does not have a calendar available.");
      const accountId = primary.id;
      const accountLabel = primary.id;
      const existingAccount = googleAccounts.find((a) => a.id === accountId);
      const displayName = existingAccount?.displayName || `Google Account ${Math.max(1, googleAccounts.filter((a) => a.id !== "legacy").length + (existingAccount ? 0 : 1))}`;
      const existingOn = new Map((existingAccount?.calendars || []).map((c) => [c.id, c.on]));
      const nextCalendars = items.map((c) => {
        const prefKey = `${accountId}::${c.id}`;
        const savedPref = Object.prototype.hasOwnProperty.call(calendarPrefs, prefKey) ? calendarPrefs[prefKey] : undefined;
        return {
          id: c.id,
          label: c.summaryOverride || c.summary || c.id,
          color: c.backgroundColor || "#8FA88A",
          on: savedPref !== undefined ? savedPref : (existingOn.has(c.id) ? existingOn.get(c.id) : c.selected !== false),
          primary: Boolean(c.primary),
        };
      });

      const rangeStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1, 0, 0, 0);
      const rangeEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 2, 1, 0, 0, 0);
      const timeMin = rangeStart.toISOString();
      const timeMax = rangeEnd.toISOString();
      const eventGroups = await Promise.all(nextCalendars.map(async (cal) => {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        const json = await res.json();
        return (json.items || []).filter((event) => event.status !== "cancelled").map((event) => ({
          id: `google:${accountId}:${cal.id}:${event.id}`,
          googleEventId: event.id,
          accountId,
          accountLabel,
          calendarId: cal.id,
          calendarKey: `google::${accountId}::${cal.id}`,
          calendarLabel: cal.label,
          color: cal.color,
          source: "google",
          title: event.summary || "(Untitled event)",
          date: googleEventDateKey(event),
          time: googleEventTimeLabel(event),
          start: event.start,
          end: event.end,
        }));
      }));

      setGoogleAccounts((prev) => {
        const nextAccount = {
          id: accountId,
          provider: "google",
          label: accountLabel,
          displayName,
          token: activeToken,
          calendars: nextCalendars,
        };
        const exists = prev.some((a) => a.id === accountId);
        if (exists) return prev.map((a) => a.id === accountId ? nextAccount : a).filter((a) => a.id !== "legacy");
        return [...prev.filter((a) => a.id !== "legacy"), nextAccount];
      });
      setEvents((prev) => {
        const prior = new Map(prev.map((event) => [event.id, event]));
        const refreshedGoogle = eventGroups.flat().map((event) => ({ ...event, activities: prior.get(event.id)?.activities || [], notes: "" }));
        return [...prev.filter((event) => !(event.source === "google" && event.accountId === accountId)), ...refreshedGoogle];
      });
      return accountId;
    } catch (err) {
      setGoogleError(err.message || "Google Calendar could not be loaded.");
      return null;
    }
  };

  const refreshAllGoogleAccounts = async () => {
    await Promise.all(connectedGoogleAccounts.map((account) => fetchGoogleAccountData(account.token, account.id)));
  };

  useEffect(() => {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const result =
      params.get("googleOAuth");

    if (!result) {
      return;
    }

    if (result === "error") {
      setGoogleError(
        params.get("message") ||
        "Google Calendar could not be connected."
      );

      params.delete("googleOAuth");
      params.delete("message");

      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${params.toString()}`
      );

      return;
    }

    const accountId =
      params.get(
        "googleAccountId"
      );

    if (
      result !== "connected" ||
      !accountId
    ) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await fetchGoogleAccountData(
          "",
          accountId
        );

        if (!cancelled) {
          setGoogleError("");
        }
      } catch (error) {
        if (!cancelled) {
          setGoogleError(
            error?.message ||
            "Google Calendar connected, but Abide could not load it."
          );
        }
      } finally {
        if (!cancelled) {
          const cleanParams =
            new URLSearchParams(
              window.location.search
            );

          cleanParams.delete(
            "googleOAuth"
          );

          cleanParams.delete(
            "googleAccountId"
          );

          cleanParams.delete(
            "message"
          );

          const query =
            cleanParams.toString();

          window.history.replaceState(
            {},
            "",
            window.location.pathname +
              (query
                ? `?${query}`
                : "")
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);



  useEffect(() => {
    if (!googleConfigured) return;
    let active = true;
    loadGoogleIdentityScript().then(() => {
      if (!active || !window.google?.accounts?.oauth2) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: GOOGLE_CALENDAR_SCOPE,
        callback: async (response) => {
          if (response.error) { setGoogleError(response.error_description || response.error); return; }
          await fetchGoogleAccountData(response.access_token);
        },
      });
    }).catch(() => setGoogleError("Google sign-in could not load."));
    return () => { active = false; };
  }, [googleClientId, selectedMonthKey]);

  useEffect(() => {
    if (connectedGoogleAccounts.length) refreshAllGoogleAccounts();
  }, [selectedMonthKey]);

  useEffect(() => {
    if (connectedMicrosoftAccounts.length) {
      refreshAllMicrosoftAccounts();
    }
  }, [selectedMonthKey]);

  const connectGoogle = async () => {
    setGoogleError("");

    try {
      const result =
        await callGoogleCalendarBackend(
          GOOGLE_CALENDAR_START_ENDPOINT
        );

      if (!result?.url) {
        throw new Error(
          "Google did not return an authorization URL."
        );
      }

      window.location.assign(
        result.url
      );
    } catch (error) {
      setGoogleError(
        error?.message ||
        "Google Calendar could not start authorization."
      );
    }
  };

  const microsoftEventDateKey = (event) => {
    if (event?.isAllDay && event?.start?.dateTime) {
      return String(event.start.dateTime).slice(0, 10);
    }

    if (!event?.start?.dateTime) return "";

    const date = new Date(event.start.dateTime);
    return Number.isNaN(date.getTime())
      ? String(event.start.dateTime).slice(0, 10)
      : localDateKey(date);
  };

  const microsoftEventTimeLabel = (event) => {
    if (event?.isAllDay) return "All day";
    if (!event?.start?.dateTime) return "";

    const date = new Date(event.start.dateTime);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const toggleMicrosoftCalendar = (accountId, calendarId) => {
    setMicrosoftAccounts((prev) =>
      prev.map((account) =>
        account.id !== accountId
          ? account
          : {
              ...account,
              calendars: (account.calendars || []).map((calendar) =>
                calendar.id === calendarId
                  ? { ...calendar, on: calendar.on === false }
                  : calendar
              ),
            }
      )
    );
  };

  const disconnectMicrosoftAccount = (accountId) => {
    setMicrosoftAccounts((prev) => prev.filter((account) => account.id !== accountId));
    setEvents((prev) =>
      prev.filter(
        (event) =>
          !(event.source === "microsoft" && event.accountId === accountId)
      )
    );
  };

  const getMicrosoftAccessToken = async (account) => {
    if (!account?.homeAccountId) {
      throw new Error(
        "Microsoft Calendar needs to be connected once on this device."
      );
    }

    await microsoftAuthReady;

    const cachedAccount =
      microsoftAuth
        .getAllAccounts()
        .find(
          (candidate) =>
            candidate.homeAccountId === account.homeAccountId
        );

    if (!cachedAccount) {
      throw new Error(
        "Microsoft sign-in needs to be refreshed. Your calendar settings are still saved."
      );
    }

    const tokenResult =
      await microsoftAuth.acquireTokenSilent({
        scopes: MICROSOFT_CALENDAR_SCOPES,
        account: cachedAccount,
      });

    if (!tokenResult?.accessToken) {
      throw new Error(
        "Microsoft did not return a calendar access token."
      );
    }

    return tokenResult.accessToken;
  };

  const fetchMicrosoftAccountEvents = async (account) => {
    if (!account?.id) return;

    setMicrosoftError("");

    try {
      // Always ask MSAL for the current token.
      // acquireTokenSilent reuses or renews it when possible.
      const accessToken =
        await getMicrosoftAccessToken(account);
      const rangeStart = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth() - 1,
        1,
        0,
        0,
        0
      );

      const rangeEnd = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth() + 2,
        1,
        0,
        0,
        0
      );

      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      const eventGroups = await Promise.all(
        (account.calendars || []).map(async (calendar) => {
          const url =
            `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendar.id)}/calendarView` +
            `?startDateTime=${encodeURIComponent(rangeStart.toISOString())}` +
            `&endDateTime=${encodeURIComponent(rangeEnd.toISOString())}` +
            `&$select=id,subject,start,end,isAllDay,isCancelled`;

          const response = await fetch(url, { headers });

          if (response.status === 401) {
            throw new Error(
              "Microsoft Calendar access needs to be refreshed. Your connected calendars have been preserved."
            );
          }

          if (!response.ok) return [];

          const json = await response.json();

          return (json.value || [])
            .filter((event) => !event.isCancelled)
            .map((event) => ({
              id: `microsoft:${account.id}:${calendar.id}:${event.id}`,
              microsoftEventId: event.id,
              accountId: account.id,
              accountLabel:
                account.displayName || account.email || "Microsoft Account",
              calendarId: calendar.id,
              calendarKey: `microsoft::${account.id}::${calendar.id}`,
              calendarLabel: calendar.label || "Outlook Calendar",
              color: calendar.color || "#0078D4",
              source: "microsoft",
              title: event.subject || "(Untitled event)",
              date: microsoftEventDateKey(event),
              time: microsoftEventTimeLabel(event),
              start: event.start,
              end: event.end,
            }));
        })
      );

      setEvents((prev) => {
        const prior = new Map(prev.map((event) => [event.id, event]));

        const refreshedMicrosoft = eventGroups
          .flat()
          .filter((event) => event.date)
          .map((event) => ({
            ...event,
            activities: prior.get(event.id)?.activities || [],
            notes: "",
          }));

        return [
          ...prev.filter(
            (event) =>
              !(event.source === "microsoft" && event.accountId === account.id)
          ),
          ...refreshedMicrosoft,
        ];
      });
    } catch (err) {
      setMicrosoftError(
        err?.message || "Microsoft Calendar events could not be loaded."
      );
    }
  };

  const refreshAllMicrosoftAccounts = async () => {
    await Promise.all(
      connectedMicrosoftAccounts.map((account) =>
        fetchMicrosoftAccountEvents(account)
      )
    );
  };

  const connectMicrosoft = async () => {
    setMicrosoftError("");

    try {
      await microsoftAuthReady;

      const loginResult = await microsoftAuth.loginPopup({
        scopes: MICROSOFT_CALENDAR_SCOPES,
        prompt: "select_account",
      });

      if (!loginResult.account) {
        throw new Error("Microsoft did not return an account.");
      }

      const tokenResult = await microsoftAuth.acquireTokenSilent({
        scopes: MICROSOFT_CALENDAR_SCOPES,
        account: loginResult.account,
      });

      const headers = {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      };

      const [profileResponse, calendarsResponse] = await Promise.all([
        fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
          headers,
        }),
        fetch("https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,color,canEdit,isDefaultCalendar", {
          headers,
        }),
      ]);

      if (!profileResponse.ok) {
        throw new Error("Abide could not load this Microsoft account.");
      }

      if (!calendarsResponse.ok) {
        throw new Error("Abide could not load calendars from this Microsoft account.");
      }

      const profile = await profileResponse.json();
      const calendarsJson = await calendarsResponse.json();

      const accountId = profile.id || loginResult.account.homeAccountId;
      const email =
        profile.mail ||
        profile.userPrincipalName ||
        loginResult.account.username ||
        "";

      const calendars = (calendarsJson.value || []).map((calendar) => ({
        id: calendar.id,
        label: calendar.name || "Calendar",
        color: "#0078D4",
        canEdit: calendar.canEdit !== false,
        primary: Boolean(calendar.isDefaultCalendar),
        on: true,
      }));

      const nextAccount = {
        id: accountId,
        provider: "microsoft",
        displayName:
          profile.displayName ||
          loginResult.account.name ||
          "Microsoft Account",
        email,
        homeAccountId: loginResult.account.homeAccountId,
        token: tokenResult.accessToken,
        calendars,
      };

      setMicrosoftAccounts((prev) => {
        const exists = prev.some((account) => account.id === accountId);
        return exists
          ? prev.map((account) =>
              account.id === accountId ? nextAccount : account
            )
          : [...prev, nextAccount];
      });

      await fetchMicrosoftAccountEvents(nextAccount);
    } catch (err) {
      const message =
        err?.errorCode === "user_cancelled" ||
        err?.errorCode === "user_cancelled_request"
          ? "Microsoft connection was cancelled."
          : err?.message || "Microsoft Calendar could not be connected.";

      setMicrosoftError(message);
    }
  };

  const createEvent = async ({
    title,
    date,
    time,
    area,
    recurrence,
    notes,
    bypassProtected,
    eventDestination = "abide",
  }) => {
    const saveNativeEvent = () => {
      setEvents((prev) => [
        ...prev,
        {
          id: `native:${Date.now()}`,
          source: "native",
          title,
          date,
          time: time ? formatTimeLabel(time) : "All day",
          area,
          repeat: recurrence ? recurrenceLabel(recurrence) : null,
          recurrence,
          notes,
          bypassProtected,
        },
      ]);
    };

    if (eventDestination === "abide") {
      saveNativeEvent();
      return;
    }

    if (eventDestination.startsWith("google::")) {
      const accountId = eventDestination.slice("google::".length);

      const targetAccount =
        connectedGoogleAccounts.find((account) => account.id === accountId);

      if (!targetAccount?.token) {
        setGoogleError("That Google account is no longer connected.");
        throw new Error("Google account is not connected");
      }

      const recurrenceRule = googleRecurrenceRule(recurrence, date);

      const body = {
        summary: title,
        description: notes || undefined,
      };

      if (recurrenceRule) {
        body.recurrence = [recurrenceRule];
      }

      if (time) {
        const [h, m] = time.split(":").map(Number);

        const startDate = new Date(
          `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
        );

        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        body.start = {
          dateTime: startDate.toISOString(),
          timeZone: "America/Chicago",
        };

        body.end = {
          dateTime: endDate.toISOString(),
          timeZone: "America/Chicago",
        };
      } else {
        const endDate = dateFromKey(date);
        endDate.setDate(endDate.getDate() + 1);

        body.start = { date };
        body.end = { date: localDateKey(endDate) };
      }

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await getGoogleAccessToken(
              targetAccount.id,
              targetAccount.token
            )}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (response.status === 401) {
        // Preserve the saved account and calendar configuration.
        setGoogleError(
          `${targetAccount.displayName || "Google account"} access needs to be refreshed. Your calendar connection has been preserved.`
        );
        throw new Error("Google authorization needs refresh");
      }

      if (!response.ok) {
        setGoogleError(
          `The event could not be added to ${
            targetAccount.displayName || "the selected Google account"
          }.`
        );
        throw new Error("Google event creation failed");
      }

      await fetchGoogleAccountData(targetAccount.token, targetAccount.id);
      return;
    }

    if (eventDestination.startsWith("microsoft::")) {
      const parts = eventDestination.split("::");
      const accountId = parts[1];
      const calendarId = parts.slice(2).join("::");

      const targetAccount =
        connectedMicrosoftAccounts.find((account) => account.id === accountId);

      const targetCalendar = targetAccount?.calendars?.find(
        (calendar) => calendar.id === calendarId
      );

      if (!targetAccount?.token || !targetCalendar) {
        setMicrosoftError("That Microsoft calendar is no longer connected.");
        throw new Error("Microsoft calendar is not connected");
      }

      const body = {
        subject: title,
        body: notes
          ? {
              contentType: "text",
              content: notes,
            }
          : undefined,
      };

      if (time) {
        const [hour, minute] = time.split(":").map(Number);

        const localStart = new Date(
          `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
        );

        const localEnd = new Date(localStart.getTime() + 60 * 60 * 1000);

        body.start = {
          dateTime: localStart.toISOString().replace(/Z$/, ""),
          timeZone: "UTC",
        };

        body.end = {
          dateTime: localEnd.toISOString().replace(/Z$/, ""),
          timeZone: "UTC",
        };
      } else {
        const nextDate = dateFromKey(date);
        nextDate.setDate(nextDate.getDate() + 1);

        body.isAllDay = true;

        body.start = {
          dateTime: `${date}T00:00:00`,
          timeZone: "UTC",
        };

        body.end = {
          dateTime: `${localDateKey(nextDate)}T00:00:00`,
          timeZone: "UTC",
        };
      }

      const recurrenceRule = microsoftRecurrenceRule(recurrence, date);

      if (recurrenceRule) {
        body.recurrence = recurrenceRule;
      }

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
          targetCalendar.id
        )}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await getMicrosoftAccessToken(targetAccount)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (response.status === 401) {
        // Preserve the saved account and calendar configuration.
        setMicrosoftError(
          `${
            targetAccount.displayName || "Microsoft account"
          } access needs to be refreshed. Your calendar connection has been preserved.`
        );
        throw new Error("Microsoft authorization needs refresh");
      }

      if (!response.ok) {
        let graphMessage = "";

        try {
          const graphError = await response.json();
          graphMessage = graphError?.error?.message || "";
        } catch {}

        setMicrosoftError(
          graphMessage ||
            `The event could not be added to ${
              targetCalendar.label || "the selected Microsoft calendar"
            }.`
        );

        throw new Error("Microsoft event creation failed");
      }

      await fetchMicrosoftAccountEvents(targetAccount);
      return;
    }

    saveNativeEvent();
  };

  const saveEditedTask = (updated) => { onUpdateTask(updated); setEditingTask(null); };

  const createCalendarChildTask = (parent, title) => {
    const draft = makeChildTaskDraft(parent, title);
    const id = onCreateTask(draft);

    return {
      id,
      ...draft,
    };
  };

  const saveEditedEvent = (updated) => { setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e)); setEditingEvent(null); };
  const deleteEditedTask = (id) => { onDeleteTask(id); setEditingTask(null); };
  const moveMonth = (delta) => { const d = dateFromKey(selectedDateKey); d.setMonth(d.getMonth() + delta, 1); setSelectedDateKey(localDateKey(d)); setOverridden(false); setOverrideOpen(false); };

  const renderAgenda = () => (
    <>
      <div className="section-label">{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
      {todaysBlock && (
        <div className="protected-block">
          <div className="row"><ShieldCheck size={18} color="#8FA88A" /><div><div className="t">{todaysBlock.start}–{todaysBlock.end} · Protected — {todaysBlock.label}</div><div className="s">Protected time stays visible while you plan the rest of the day.</div></div></div>
          {!overridden ? <div className="override" onClick={() => setOverrideOpen(!overrideOpen)}>Need to schedule something here anyway? →</div> : <div className="s" style={{ marginTop: 8 }}>Scheduling override enabled for this view.</div>}
          {overrideOpen && !overridden && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><div className="filter-chip active" onClick={() => { setOverridden(true); setOverrideOpen(false); }}>Schedule Anyway</div><div className="filter-chip" onClick={() => setOverrideOpen(false)}>Never mind</div></div>}
        </div>
      )}
      <div className="section-label">Tasks</div>
      <div className="card">{dayTasks.length ? <>
        {dayTasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            goals={goals}
            areas={areas}
            expanded={false}
            onToggleExpand={() => {
              setAdding(false);
              setEditingTask(t);
            }}
            onToggleDone={toggleDone}
            onEdit={(task) => {
              setAdding(false);
              setEditingTask(task);
            }}
            parentTask={
              t.parentTaskId
                ? tasks.find(
                    (parent) =>
                      String(parent.id) === String(t.parentTaskId)
                  ) || null
                : null
            }
            childTasks={tasks.filter(
              (child) =>
                String(child.parentTaskId || "") === String(t.id)
            )}
          />
        ))}
      </> : <div className="insight-line">No tasks due this day.</div>}</div>
      <div className="section-label">Events</div>
      <div className="card">{dayEvents.length ? dayEvents.map((e) => {
        const areaInfo = e.area && areas[e.area] ? areas[e.area] : null;
        return <div className="task-row" key={e.id} style={{ cursor: "pointer" }} onClick={() => { setAdding(false); setEditingTask(null); setEditingEvent(e); }}><div style={{ width: 22 }} /><div style={{ flex: 1 }}><div className="task-title">{e.title}</div><div className="task-meta"><span className="chip" style={{ background: (e.color || areaInfo?.color || "#8FA88A") + "26", color: e.color || areaInfo?.color || "#8FA88A" }}>{e.source === "google"
  ? (e.calendarLabel || "Google Calendar")
  : e.source === "microsoft"
    ? (e.calendarLabel || "Outlook Calendar")
    : "Abide"}</span><span className="time-chip"><Clock size={11} />{e.time || "All day"}</span>{e.repeat && <span className="time-chip"><Repeat size={11} />{e.repeat}</span>}{normalizeActivity(e).length > 0 && <span className="time-chip">{normalizeActivity(e).length} update{normalizeActivity(e).length === 1 ? "" : "s"}</span>}</div></div><Pencil size={14} color="var(--text3)" /></div>;
      }) : <div className="insight-line">{googleConnected ? "No calendar events this day." : "No Abide events this day. Connect Google Calendar to pull in your real events."}</div>}</div>
    </>
  );

  const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  /* ABIDE MONTH WEEK START V2 */
  const leadingBlanks =
    getWeekStartPreference() ===
    "monday"
      ? (
          firstOfMonth.getDay() +
          6
        ) % 7
      : firstOfMonth.getDay();
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const monthCells = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <>
      <Header
        eyebrow={monthLabel}
        title="Calendar"
        actions={[
          {
            icon: Search,
            onClick: () => {
              setSearchOpen(!searchOpen);
              setAdding(false);
              setEditingTask(null);
              setEditingEvent(null);
            },
          },
          { icon: SlidersHorizontal, onClick: () => setCalsOpen(!calsOpen) },
          {
            icon: adding ? X : Plus,
            onClick: () => {
              setSearchOpen(false);
              setSearchQuery("");
              setEditingTask(null);
              setEditingEvent(null);
              setAdding(!adding);
            },
          },
        ]}
      />
      <div className="scroll">

        <AreaQuickNav
          areas={areas}
          label="Areas"
        />

        {searchOpen && (
          <div style={{ marginBottom: 14 }}>
            <div className="capture-bar" style={{ marginTop: 0 }}>
              <Search size={16} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks and events..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--text)",
                  font: "inherit",
                }}
              />
              {searchQuery && (
                <X
                  size={15}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSearchQuery("")}
                />
              )}
            </div>

            {normalizedSearchQuery && (
              <>
                <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "0 4px 8px" }}>
                  {searchResultCount} result{searchResultCount === 1 ? "" : "s"}
                </div>

                {taskSearchResults.length > 0 && (
                  <>
                    <div className="section-label" style={{ marginTop: 10 }}>Tasks</div>
                    <div className="card">
                      {taskSearchResults.map((task) => (
                        <div
                          key={`search-task-${task.id}`}
                          className="task-row"
                          onClick={() => {
                            setSelectedDateKey(taskDateKey(task));
                            setSearchOpen(false);
                            setSearchQuery("");
                            setEditingTask(task);
                          }}
                        >
                          <Search size={15} color="#E8B45C" />
                          <div style={{ flex: 1 }}>
                            <div className="task-title">{task.title}</div>
                            <div className="task-meta">
                              <span className="time-chip">{taskProgressLabel(task)}</span>
                              <span className="time-chip">{formatDateLabel(taskDateKey(task))}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} color="var(--text3)" />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {eventSearchResults.length > 0 && (
                  <>
                    <div className="section-label" style={{ marginTop: 10 }}>Events</div>
                    <div className="card">
                      {eventSearchResults.map((event) => (
                        <div
                          key={`search-event-${event.id}`}
                          className="task-row"
                          onClick={() => {
                            if (event.date) setSelectedDateKey(event.date);
                            setSearchOpen(false);
                            setSearchQuery("");
                            setEditingEvent(event);
                          }}
                        >
                          <CalendarDays size={15} color={event.color || "#7C93C9"} />
                          <div style={{ flex: 1 }}>
                            <div className="task-title">{event.title}</div>
                            <div className="task-meta">
                              <span className="time-chip">{event.date ? formatDateLabel(event.date) : "No date"}</span>
                              <span className="time-chip">{event.time || "All day"}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} color="var(--text3)" />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {searchResultCount === 0 && (
                  <div className="card">
                    <div className="insight-line">No matching tasks or events.</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div
          className="gcal-badge"
          onClick={() => setCalsOpen(!calsOpen)}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span className="gcal-dot" />
            {connectedGoogleAccounts.length || connectedMicrosoftAccounts.length
              ? `${activeCount + microsoftActiveCount} calendar${activeCount + microsoftActiveCount === 1 ? "" : "s"} visible · ${connectedGoogleAccounts.length} Google · ${connectedMicrosoftAccounts.length} Microsoft`
              : "No external calendar connected"}
          </span>
          {calsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        {calsOpen && (
          <>
            <CalendarsPanel
              accounts={googleAccounts}
              setAccounts={setGoogleAccounts}
              configured={googleConfigured}
              onConnect={connectGoogle}
              onRefresh={refreshAllGoogleAccounts}
              onDisconnect={disconnectGoogleAccount}
              onToggleCalendar={toggleGoogleCalendar}
              onRenameAccount={renameGoogleAccount}
              error={googleError}
            />

            <MicrosoftCalendarsPanel
              accounts={microsoftAccounts}
              onConnect={connectMicrosoft}
              onDisconnect={disconnectMicrosoftAccount}
              onToggleCalendar={toggleMicrosoftCalendar}
              error={microsoftError}
            />
          </>
        )}
        {adding && (
          <AddSheet
            tasks={tasks}
            onDeleteTask={onDeleteTask}
            goals={goals}
            areas={areas}
            initialDate={selectedDateKey}
            onClose={() => setAdding(false)}
            onCreateTask={onCreateTask}
            onCreateEvent={createEvent}
            googleConnected={googleConnected}
            googleAccounts={connectedGoogleAccounts}
            microsoftAccounts={connectedMicrosoftAccounts}
            onCreateArea={onCreateArea}
          />
        )}
        {editingTask && (
          <TaskEditor
            task={editingTask}
            goals={goals}
            areas={areas}
            onSave={saveEditedTask}
            onCancel={() => setEditingTask(null)}
            onDelete={deleteEditedTask}
            onCreateArea={onCreateArea}
            childTasks={tasks.filter(
              (child) =>
                String(child.parentTaskId || "") === String(editingTask.id)
            )}
            onCreateChildTask={createCalendarChildTask}
            onOpenChildTask={(child) => {
              setAdding(false);
              setEditingTask(child);
            }}
          />
        )}
        {editingEvent && <EventEditor event={editingEvent} areas={areas} onSave={saveEditedEvent} onCancel={() => setEditingEvent(null)} />}

        <div className="segmented"><div className={`seg-btn ${mode === "week" ? "active" : ""}`} onClick={() => setMode("week")}>Week</div><div className={`seg-btn ${mode === "month" ? "active" : ""}`} onClick={() => setMode("month")}>Month</div></div>

        {mode === "week" ? (
          <>
            {/* ABIDE CALENDAR WEEK NAVIGATION UI V1 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "38px minmax(0, 1fr) 38px",
                alignItems: "center",
                gap: 8,
                margin: "10px 0 8px",
              }}
            >
              <button
                type="button"
                aria-label="Previous week"
                title="Previous week"
                onClick={() =>
                  moveWeek(-1)
                }
                style={{
                  width: 38,
                  height: 36,
                  borderRadius: 11,
                  border:
                    "1px solid var(--pillBorder)",
                  background:
                    "var(--pillBg)",
                  color:
                    "var(--text2)",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  cursor:
                    "pointer",
                  padding: 0,
                }}
              >
                <ChevronLeft
                  size={17}
                />
              </button>

              <div
                style={{
                  minWidth: 0,
                  textAlign:
                    "center",
                }}
              >
                <div
                  style={{
                    fontSize:
                      12.5,
                    fontWeight:
                      750,
                    color:
                      "var(--text)",
                  }}
                >
                  {weekRangeLabel}
                </div>

                {weekKeys.includes(
                  REFERENCE_DATE_KEY
                ) && (
                  <div
                    style={{
                      marginTop:
                        2,
                      fontSize:
                        10,
                      fontWeight:
                        650,
                      color:
                        "#8FA88A",
                    }}
                  >
                    This week
                  </div>
                )}
              </div>

              <button
                type="button"
                aria-label="Next week"
                title="Next week"
                onClick={() =>
                  moveWeek(1)
                }
                style={{
                  width: 38,
                  height: 36,
                  borderRadius: 11,
                  border:
                    "1px solid var(--pillBorder)",
                  background:
                    "var(--pillBg)",
                  color:
                    "var(--text2)",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  cursor:
                    "pointer",
                  padding: 0,
                }}
              >
                <ChevronRight
                  size={17}
                />
              </button>
            </div>

            <div className="weekstrip">{weekKeys.map((key) => { const d = dateFromKey(key); const hasItems = tasks.some((t) => taskDateKey(t) === key) || events.some((e) => e.date === key); return <div key={key} className={`daypill ${selectedDateKey === key ? "selected" : ""}`} onClick={() => { setSelectedDateKey(key); setOverridden(false); setOverrideOpen(false); }}><span className="dow">{d.toLocaleDateString("en-US", { weekday: "narrow" })}</span><span className="num">{d.getDate()}</span>{hasItems && <span className="dot" />}</div>; })}</div>
            {renderAgenda()}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 10px" }}>
              <div className="tool-btn" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></div><div style={{ fontWeight: 700, color: "var(--text)" }}>{monthLabel}</div><div className="tool-btn" onClick={() => moveMonth(1)}><ChevronRight size={16} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>{["M","T","W","T","F","S","S"].map((d, i) => <div key={`${d}${i}`} style={{ textAlign: "center", fontSize: 10.5, color: "var(--text3)", fontWeight: 700 }}>{d}</div>)}</div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
                {monthCells.map((day, i) => {
                  if (!day) return <div key={`blank-${i}`} />;
                  const key = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const hasItems = tasks.some((t) => taskDateKey(t) === key) || events.some((e) => e.date === key);
                  return <div key={key} onClick={() => { setSelectedDateKey(key); setOverridden(false); setOverrideOpen(false); }} style={{ textAlign: "center", padding: "8px 0", borderRadius: 8, cursor: "pointer", background: key === selectedDateKey ? "rgba(232,180,92,0.18)" : "transparent", border: key === selectedDateKey ? "1px solid rgba(232,180,92,0.4)" : "1px solid transparent" }}><div style={{ fontSize: 12, color: "var(--body)" }}>{day}</div>{hasItems && <div style={{ width: 4, height: 4, borderRadius: 2, background: "#E8B45C", margin: "3px auto 0" }} />}</div>;
                })}
              </div>
            </div>
            {renderAgenda()}
          </>
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   GOALS TAB — add / edit goals, milestones, notes
----------------------------------------------------------------*/
function GoalComposer({ initial, onSave, onCancel, onDelete, areas = AREAS, onCreateArea }) {
  const [name, setName] = useState(initial?.name || "");
  const [area, setArea] = useState(initial?.area && areas[initial.area] ? initial.area : (Object.keys(areas)[0] || ""));
  const [targetDate, setTargetDate] = useState(initial?.targetDate || "");
  const [notes, setNotes] = useState(initial?.notes || "");

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id || Date.now(),
      name: name.trim(),
      area,
      targetDate: targetDate || null,
      target: initial?.target || "",
      notes,
      milestones: initial?.milestones || [],
      progress: initial?.progress || 0,
    });
  };

  return (
    <div className="card composer-card">
      <div className="fb-label" style={{ marginTop: 0 }}>Goal Name</div>
      <input className="input-line" style={{ marginTop: 0 }} placeholder="e.g. Read Through the New Testament" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="fb-label">Area</div>
      <QuickAreaPicker areas={areas} value={area} onChange={setArea} onCreateArea={onCreateArea} allowNone={false} />
      <div className="fb-label">Target Date</div>
      <input
        type="date"
        className="input-line"
        style={{ marginTop: 0 }}
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
      />
      {!targetDate && initial?.target && (
        <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>
          Previous target: {initial.target} · choose a calendar date above to replace it.
        </div>
      )}
      <div className="fb-label">Notes</div>
      <textarea className="notes-box" rows={2} placeholder="Why this goal matters, context, links…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        Milestones are managed from the Goal card as real tasks, with their own due dates and task properties.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={save}>Save Goal</div>
        <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</div>
      </div>
      {onDelete && <div className="filter-chip" style={{ marginTop: 8, justifyContent: "center", color: "#E68080", borderColor: "#E6808055" }} onClick={onDelete}>Delete Goal</div>}
    </div>
  );
}

function GoalsTab({
  goals,
  setGoals,
  viewport,
  areas = AREAS,
  tasks,
  onCreateTask,
  onUpdateTask,
  onCreateArea,
}) {
  const [composer, setComposer] = useState(null); // null | "add" | goalId
  const [milestoneDrafts, setMilestoneDrafts] = useState({});

  const milestoneTasksForGoal = (goalId) =>
    tasks.filter(
      (task) =>
        task.kind === "milestone" &&
        String(task.goal) === String(goalId)
    );

  const saveGoal = (g) => {
    setGoals((prev) => prev.some((x) => x.id === g.id) ? prev.map((x) => x.id === g.id ? g : x) : [...prev, g]);
    setComposer(null);
  };
  const deleteGoal = (id) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setComposer(null);
  };

  const createMilestoneTask = (goal) => {
    const draft = milestoneDrafts[goal.id] || {};
    if (!String(draft.title || "").trim() || !draft.dueDate) return;

    onCreateTask({
      title: String(draft.title).trim(),
      kind: "milestone",
      goal: goal.id,
      area: goal.area || null,
      dueDate: draft.dueDate,
      dueTime: null,
      priority: "med",
      status: "next",
      progress: "not_started",
      done: false,
      reminder: "None",
      notes: "",
      activities: [],
    });

    setMilestoneDrafts((prev) => ({
      ...prev,
      [goal.id]: { title: "", dueDate: "" },
    }));
  };

  const toggleMilestoneTask = (task) => {
    const done = !task.done;
    onUpdateTask({
      ...task,
      done,
      progress: done ? "completed" : "not_started",
      completedAt: done ? new Date().toISOString() : null,
    });
  };

  return (
    <>
      <Header eyebrow={`${goals.length} active · flexible by design`} title="Goals" actions={[{ icon: Plus, onClick: () => setComposer(composer === "add" ? null : "add") }]} />
      <div className="scroll">
        {composer === "add" && <GoalComposer areas={areas} onCreateArea={onCreateArea} onSave={saveGoal} onCancel={() => setComposer(null)} />}
        <div className={viewport === "desktop" ? "goal-grid" : undefined}>
          {goals.map((g) => {
            const area = g.area && areas[g.area] ? areas[g.area] : { name: "No Area", color: "#9AA2B1" };
            const milestoneTasks = milestoneTasksForGoal(g.id);
            const milestoneProgress = milestoneTasks.length
              ? Math.round(
                  (milestoneTasks.filter((task) => task.done).length / milestoneTasks.length) * 100
                )
              : g.progress || 0;
            const milestoneDraft = milestoneDrafts[g.id] || { title: "", dueDate: "" };

            if (composer === g.id) {
              return <GoalComposer key={g.id} areas={areas} onCreateArea={onCreateArea} initial={g} onSave={saveGoal} onCancel={() => setComposer(null)} onDelete={() => deleteGoal(g.id)} />;
            }
            return (
              <div key={g.id} className="card goal-card">
                <div className="goal-title-row">
                  <div><span className="chip" style={{ background: area.color + "26", color: area.color }}>{area.name}</span><div className="goal-name" style={{ marginTop: 6 }}>{g.name}</div></div>
                  <Pencil size={15} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => setComposer(g.id)} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12.5, color: "var(--text2)" }}>
                  <span>{milestoneProgress}% complete</span>
                  <span>
                    Target · {g.targetDate
                      ? formatDateLabel(g.targetDate)
                      : (g.target || "—")}
                  </span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${milestoneProgress}%`, background: area.color }}
                  />
                </div>

                <div className="fb-label" style={{ marginTop: 14 }}>Milestones</div>

                {milestoneTasks.length ? milestoneTasks.map((task) => (
                  <div
                    className="milestone-row"
                    key={task.id}
                    onClick={() => toggleMilestoneTask(task)}
                    style={{ alignItems: "flex-start" }}
                  >
                    <Target
                      size={14}
                      color={task.done ? area.color : "#E8B45C"}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: task.done ? "var(--text2)" : "var(--body)",
                          textDecoration: task.done ? "line-through" : "none",
                          fontWeight: 600,
                        }}
                      >
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>
                        {formatDateLabel(taskDateKey(task))}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>
                    No milestone tasks yet.
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 150px auto",
                    gap: 8,
                    marginTop: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    className="input-line"
                    style={{ margin: 0 }}
                    placeholder="Milestone title"
                    value={milestoneDraft.title}
                    onChange={(e) =>
                      setMilestoneDrafts((prev) => ({
                        ...prev,
                        [g.id]: { ...milestoneDraft, title: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="date"
                    className="input-line"
                    style={{ margin: 0 }}
                    value={milestoneDraft.dueDate}
                    onChange={(e) =>
                      setMilestoneDrafts((prev) => ({
                        ...prev,
                        [g.id]: { ...milestoneDraft, dueDate: e.target.value },
                      }))
                    }
                  />
                  <div
                    className="filter-chip active"
                    onClick={() => createMilestoneTask(g)}
                  >
                    <Plus size={12} />Add
                  </div>
                </div>

                {g.notes && <div className="insight-line" style={{ padding: "10px 0 0 0" }}>{g.notes}</div>}
              </div>
            );
          })}
        </div>
        <div className="insight-line" style={{ padding: "8px 4px" }}>Tasks don't have to belong to a goal — standalone tasks just carry an Area and skip this layer entirely.</div>
      </div>
    </>
  );
}

function HighlightSettingsEditor({
  meanings,
  setMeanings,
  onClose,
}) {
  const updateMeaning = (key, field, value) => {
    setMeanings((prev) => ({
      ...DEFAULT_HIGHLIGHT_MEANINGS,
      ...(prev || {}),
      [key]: {
        ...highlightMeaningFor(prev, key),
        [field]: value,
      },
    }));
  };

  const restoreDefaults = () => {
    if (
      window.confirm(
        "Restore Abide’s original highlight meanings? Your journal entries and highlight colors will not change."
      )
    ) {
      setMeanings(
        JSON.parse(JSON.stringify(DEFAULT_HIGHLIGHT_MEANINGS))
      );
    }
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card composer-card task-editor-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="editor-shell">
          <div className="editor-header">
            <div>
              <div className="editor-title">Highlight Meanings</div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text3)",
                  marginTop: 3,
                }}
              >
                Make the colors mean what is useful to you.
              </div>
            </div>

            <div className="editor-close" onClick={onClose}>
              <X size={17} />
            </div>
          </div>

          <div className="editor-scroll">
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--text3)",
                marginBottom: 14,
              }}
            >
              The colors themselves stay the same. Only your personal
              explanation of what each color means changes. Every field is
              optional.
            </div>

            {Object.keys(TAGS).map((key) => {
              const meaning = highlightMeaningFor(meanings, key);

              return (
                <div
                  key={key}
                  style={{
                    padding: 13,
                    borderRadius: 13,
                    border: "1px solid var(--divider)",
                    background: "var(--subtleBg)",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: 999,
                        background:
                          meaning.displayHex || TAGS[key].hex,
                        flexShrink: 0,
                      }}
                    />

                    {meaning.secondaryHex && (
                      <span
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: 999,
                          background: meaning.secondaryHex,
                          flexShrink: 0,
                        }}
                      />
                    )}

                    <strong style={{ color: "var(--text)" }}>
                      {meaning.colorName ||
                        key.charAt(0).toUpperCase() + key.slice(1)}
                    </strong>
                  </div>

                  <div className="fb-label" style={{ marginTop: 0 }}>
                    Short label
                  </div>
                  <input
                    className="input-line"
                    style={{ marginTop: 0 }}
                    value={meaning.label || ""}
                    onChange={(event) =>
                      updateMeaning(key, "label", event.target.value)
                    }
                    placeholder="Optional"
                  />

                  <div className="fb-label">Glossary heading</div>
                  <input
                    className="input-line"
                    style={{ marginTop: 0 }}
                    value={meaning.heading || ""}
                    onChange={(event) =>
                      updateMeaning(key, "heading", event.target.value)
                    }
                    placeholder="Optional"
                  />

                  <div className="fb-label">What it means to you</div>
                  <textarea
                    className="notes-box"
                    rows={4}
                    value={meaning.description || ""}
                    onChange={(event) =>
                      updateMeaning(
                        key,
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Write as much as you want, or leave this blank."
                  />

                  <div className="fb-label">Examples or notes</div>
                  <textarea
                    className="notes-box"
                    rows={3}
                    value={meaning.examples || ""}
                    onChange={(event) =>
                      updateMeaning(
                        key,
                        "examples",
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                  />
                </div>
              );
            })}

            <div
              className="filter-chip"
              style={{
                justifyContent: "center",
                marginTop: 4,
              }}
              onClick={restoreDefaults}
            >
              <RefreshCw size={12} />
              Restore Abide Defaults
            </div>
          </div>

          <div className="editor-footer">
            <div
              className="filter-chip active"
              style={{
                flex: 1,
                justifyContent: "center",
              }}
              onClick={onClose}
            >
              Done
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function plainTextToHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML.replace(/\n/g, "<br>");
}

function htmlToPlainText(html = "") {
  if (typeof document === "undefined") return String(html).replace(/<[^>]+>/g, " ").trim();
  const div = document.createElement("div"); div.innerHTML = html; return (div.textContent || "").trim();
}

function legacyCreatedAt(item) {
  const explicit = Number(item?.createdAt);

  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  // Most existing Journal/Notes IDs were created
  // with Date.now(), so they can safely provide a useful
  // creation-time fallback for older saved items.
  const idValue = Number(item?.id);

  if (
    Number.isFinite(idValue) &&
    idValue > 946684800000
  ) {
    return idValue;
  }

  return null;
}

function savedCreatedAt(item) {
  return legacyCreatedAt(item);
}

function savedUpdatedAt(item) {
  const updated = Number(item?.updatedAt);

  if (Number.isFinite(updated) && updated > 0) {
    return updated;
  }

  return savedCreatedAt(item);
}

function formatSavedMoment(value) {
  const timestamp = Number(value);

  if (
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return "";
  }

  try {
    return new Date(timestamp).toLocaleString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  } catch {
    return "";
  }
}

function savedTimestampSearchText(item) {
  const created = savedCreatedAt(item);
  const updated = savedUpdatedAt(item);

  return [
    formatSavedMoment(created),
    formatSavedMoment(updated),
    created
      ? new Date(created).toLocaleDateString()
      : "",
    updated
      ? new Date(updated).toLocaleDateString()
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function SavedTimestampLine({ item }) {
  const createdAt = savedCreatedAt(item);
  const updatedAt = savedUpdatedAt(item);

  if (!createdAt && !updatedAt) {
    return null;
  }

  const createdLabel =
    formatSavedMoment(createdAt);

  const updatedLabel =
    formatSavedMoment(updatedAt);

  const wasEdited =
    Boolean(
      createdAt &&
        updatedAt &&
        Math.abs(updatedAt - createdAt) > 1000
    );

  return (
    <div
      style={{
        fontSize: 10.5,
        lineHeight: 1.45,
        color: "var(--text3)",
        marginTop: 7,
      }}
    >
      {createdLabel && (
        <span>
          Saved {createdLabel}
        </span>
      )}

      {wasEdited && updatedLabel && (
        <span>
          {" · "}Edited {updatedLabel}
        </span>
      )}
    </div>
  );
}

function RichTextEditor({
  value,
  onChange,
  placeholder = "Write…",
  minHeight = 120,
  highlightMeanings = DEFAULT_HIGHLIGHT_MEANINGS,
}) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) ref.current.innerHTML = value || "";
  }, [value]);
  const commit = () => onChange(ref.current?.innerHTML || "");
  const rememberSelection = () => {
    const selection = window.getSelection?.();
    if (selection?.rangeCount && ref.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const selection = window.getSelection?.();
    if (!selection || !savedRange.current) return;
    selection.removeAllRanges(); selection.addRange(savedRange.current);
  };
  const command = (cmd, arg = null) => {
    ref.current?.focus(); restoreSelection();
    try {
      const applied = document.execCommand(cmd, false, arg);
      if (cmd === "hiliteColor" && applied === false) document.execCommand("backColor", false, arg);
    } catch { if (cmd === "hiliteColor") { try { document.execCommand("backColor", false, arg); } catch {} } }
    rememberSelection(); commit();
  };
  return (
    <div>
      <div className="rich-toolbar">
        <button type="button" className="rich-btn" onMouseDown={(e) => { e.preventDefault(); command("bold"); }} title="Bold">B</button>
        <button type="button" className="rich-btn" style={{ fontStyle: "italic" }} onMouseDown={(e) => { e.preventDefault(); command("italic"); }} title="Italic">I</button>
        <button type="button" className="rich-btn" style={{ textDecoration: "underline" }} onMouseDown={(e) => { e.preventDefault(); command("underline"); }} title="Underline">U</button>
        <select className="rich-select" defaultValue="-apple-system" onMouseDown={rememberSelection} onChange={(e) => command("fontName", e.target.value)} title="Font">
          <option value="-apple-system">System</option><option value="Georgia">Georgia</option><option value="Arial">Arial</option><option value="Courier New">Courier</option><option value="Times New Roman">Times</option>
        </select>
        {Object.entries(TAGS).map(([key, t]) => (
          <button
            key={t.hex}
            type="button"
            className="rich-btn"
            style={{
              minWidth: 24,
              width: 24,
              padding: 0,
              background: t.hex,
              borderColor: t.hex,
            }}
            title={`Highlight ${
              highlightMeaningFor(highlightMeanings, key).label ||
              t.label ||
              key
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              command("hiliteColor", t.hex);
            }}
          />
        ))}
        <button type="button" className="rich-btn" onMouseDown={(e) => { e.preventDefault(); command("removeFormat"); }} title="Clear formatting">Clear</button>
      </div>
      <div ref={ref} className="rich-editor" style={{ minHeight }} contentEditable suppressContentEditableWarning data-placeholder={placeholder} onInput={() => { rememberSelection(); commit(); }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={() => { rememberSelection(); commit(); }} />
    </div>
  );
}

/* ---------------------------------------------------------------
   JOURNAL TAB — add / edit / delete
----------------------------------------------------------------*/
function JournalTab({
  entries,
  setEntries,
  highlightMeanings,
  setHighlightMeanings,
}) {
  // Draft fields are persistent so an accidental refresh,
  // PWA update, tab close, or navigation cannot erase writing.
  const [entryDate, setEntryDate] = usePersistentState(
    "abide-journal-draft-date",
    REFERENCE_DATE_KEY
  );
  const [ref, setRef] = usePersistentState(
    "abide-journal-draft-reference",
    ""
  );
  const [noteHtml, setNoteHtml] = usePersistentState(
    "abide-journal-draft-html",
    ""
  );

  const [noteBlocks, setNoteBlocks] = usePersistentState(
    "abide-journal-draft-blocks",
    []
  );
  const [tag, setTag] = usePersistentState(
    "abide-journal-draft-tag",
    "yellow"
  );

  // Editing an existing entry is protected too.
  const [editingId, setEditingId] = usePersistentState(
    "abide-journal-editing-id",
    null
  );
  const [editDate, setEditDate] = usePersistentState(
    "abide-journal-edit-date",
    REFERENCE_DATE_KEY
  );
  const [editRef, setEditRef] = usePersistentState(
    "abide-journal-edit-reference",
    ""
  );
  const [editHtml, setEditHtml] = usePersistentState(
    "abide-journal-edit-html",
    ""
  );

  const [editBlocks, setEditBlocks] = usePersistentState(
    "abide-journal-edit-blocks",
    []
  );
  const [editTag, setEditTag] = usePersistentState(
    "abide-journal-edit-tag",
    "yellow"
  );
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [highlightSettingsOpen, setHighlightSettingsOpen] = useState(false);
  const [journalSearch, setJournalSearch] = useState("");

  const normalizedJournalSearch =
    journalSearch.trim().toLowerCase();

  const filteredJournalEntries =
    normalizedJournalSearch
      ? entries.filter((entry) => {
          const searchableText = [
            entry.ref || "",
            entry.note || "",
            htmlToPlainText(
              entry.richTextHtml || ""
            ),
            entry.date || "",
            entry.dateKey || "",
            entry.tag || "",
            savedTimestampSearchText(entry),
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedJournalSearch
          );
        })
      : entries;

  useEffect(() => {
    const needsBackfill = entries.some(
      (entry) =>
        !entry.createdAt ||
        !entry.updatedAt
    );

    if (!needsBackfill) return;

    setEntries((current) =>
      current.map((entry) => {
        const createdAt =
          savedCreatedAt(entry);

        if (!createdAt) {
          return entry;
        }

        return {
          ...entry,
          createdAt:
            entry.createdAt ||
            createdAt,
          updatedAt:
            entry.updatedAt ||
            createdAt,
        };
      })
    );
  }, []);

  const streak = journalStreak(entries);

  const save = () => {
    const effectiveBlocks =
      normalizeWorkspaceBlocks(
        noteBlocks,
        noteHtml
      );

    const plain =
      workspaceBlocksToPlainText(
        effectiveBlocks
      );

    const html =
      workspaceBlocksToHtml(
        effectiveBlocks
      );

    if (!plain && !ref.trim()) return;

    const savedAt = Date.now();

    setEntries((p) => [
      {
        id: savedAt,
        createdAt: savedAt,
        updatedAt: savedAt,
        dateKey: entryDate,
        date: formatDateLabel(entryDate),
        ref: ref || "",
        tag,
        note: plain,
        richTextHtml: html,
        workspaceBlocks: effectiveBlocks,
        references: workspaceBlockReferences(
          effectiveBlocks
        ),
      },
      ...p,
    ]);

    // Saving converts the autosaved draft into a permanent entry.
    setRef("");
    setNoteHtml("");
    setNoteBlocks([]);
    setTag("yellow");
    setEntryDate(REFERENCE_DATE_KEY);
  };
  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditDate(entry.dateKey || REFERENCE_DATE_KEY);
    setEditRef(entry.ref || "");

    const legacyHtml =
      entry.richTextHtml ||
      plainTextToHtml(
        entry.note || ""
      );

    setEditHtml(
      legacyHtml
    );

    setEditBlocks(
      normalizeWorkspaceBlocks(
        entry.workspaceBlocks,
        legacyHtml
      )
    );

    setEditTag(entry.tag || "yellow");
  };

  const clearJournalEditDraft = () => {
    setEditingId(null);
    setEditDate(REFERENCE_DATE_KEY);
    setEditRef("");
    setEditHtml("");
    setEditBlocks([]);
    setEditTag("yellow");
  };

  const saveEdit = (id) => {
    const effectiveBlocks =
      normalizeWorkspaceBlocks(
        editBlocks,
        editHtml
      );

    const plain =
      workspaceBlocksToPlainText(
        effectiveBlocks
      );

    const html =
      workspaceBlocksToHtml(
        effectiveBlocks
      );

    setEntries((p) =>
      p.map((e) =>
        e.id === id
          ? {
              ...e,
              createdAt:
                savedCreatedAt(e) ||
                Date.now(),
              updatedAt: Date.now(),
              dateKey: editDate,
              date: formatDateLabel(editDate),
              ref: editRef,
              note: plain,
              richTextHtml: html,
              workspaceBlocks: effectiveBlocks,
              references: workspaceBlockReferences(
                effectiveBlocks
              ),
              tag: editTag,
            }
          : e
      )
    );

    clearJournalEditDraft();
  };
  const remove = (id) => setEntries((p) => p.filter((e) => e.id !== id));

  return (
    <>
      <Header eyebrow={streak ? `${streak}-day streak` : "Start your first entry"} title="Time with the Lord" />
      <div className="scroll">

        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <div
            onClick={() => setGlossaryOpen(!glossaryOpen)}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", gap:12 }}
          >
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>The whole system · explained</div>
              <div style={{ fontSize:12, color:"var(--text3)", marginTop:3 }}>Every color, in plain words.</div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div
                onClick={(event) => {
                  event.stopPropagation();
                  setHighlightSettingsOpen(true);
                }}
                aria-label="Customize highlight meanings"
                title="Customize highlight meanings"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--pillBg)",
                  border: "1px solid var(--pillBorder)",
                  cursor: "pointer",
                }}
              >
                <SettingsIcon size={14} color="#E8B45C" />
              </div>

              {glossaryOpen ? (
                <ChevronDown size={17} color="var(--text3)" />
              ) : (
                <ChevronRight size={17} color="var(--text3)" />
              )}
            </div>
          </div>

          {glossaryOpen && (
            <div style={{ marginTop:14, display:"grid", gap:10 }}>

              {Object.keys(TAGS).map((key) => {
                const meaning = highlightMeaningFor(
                  highlightMeanings,
                  key
                );

                const displayHex =
                  meaning.displayHex || TAGS[key].hex;

                return (
                  <div
                    key={key}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: `${displayHex}20`,
                      border: `1px solid ${displayHex}55`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 99,
                          background: displayHex,
                          flex: "0 0 auto",
                        }}
                      />

                      {meaning.secondaryHex && (
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 99,
                            background: meaning.secondaryHex,
                            flex: "0 0 auto",
                          }}
                        />
                      )}

                      <strong>
                        {meaning.colorName ||
                          key.charAt(0).toUpperCase() +
                            key.slice(1)}
                        {meaning.heading
                          ? ` — ${meaning.heading}`
                          : ""}
                      </strong>
                    </div>

                    {meaning.description && (
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--body)",
                          marginTop: 7,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {meaning.description}
                      </div>
                    )}

                    {meaning.examples && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text3)",
                          marginTop: 6,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {meaning.examples}
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ padding:12, borderRadius:12, background:"var(--surface2)", border:"1px solid var(--divider)" }}>
                <strong>M: Notes — What you think</strong>
                <div style={{ fontSize:12.5, color:"var(--body)", marginTop:7, lineHeight:1.5 }}>
                  Your own thoughts, reactions, questions, connections, and ideas — what is happening in your head, not what is printed on the page.
                </div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:6 }}>
                  Colors mark the text; notes hold your response. Useful tags: M: Margin post idea · Q: question.
                </div>
              </div>

              <div style={{ fontSize:11.5, color:"var(--text3)", lineHeight:1.5, padding:"2px 2px 0" }}>
                Custom color tools can use hex values directly. Kindle, Apple Books, and Notion use fixed palettes, so choose the closest named color. These colors are tuned to stay visually consistent across paper and screen.
              </div>

            </div>
          )}
        </div>

        {highlightSettingsOpen && (
          <HighlightSettingsEditor
            meanings={highlightMeanings}
            setMeanings={setHighlightMeanings}
            onClose={() => setHighlightSettingsOpen(false)}
          />
        )}

        <div className="card journal-compose">
          <div className="journal-compose-meta">
            <label className="journal-compose-field journal-date-field">
              <span className="journal-compose-field-label">
                Date
              </span>

              <input
                type="date"
                value={entryDate}
                onChange={(e) =>
                  setEntryDate(
                    e.target.value
                  )
                }
              />
            </label>

            <label className="journal-compose-field journal-scripture-field">
              <span className="journal-compose-field-label">
                Scripture
              </span>

              <input
                type="text"
                placeholder="Psalm 23:1"
                value={ref}
                onChange={(e) =>
                  setRef(
                    e.target.value
                  )
                }
              />
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <WorkspaceEditor
              initialBlocks={normalizeWorkspaceBlocks(
                noteBlocks,
                noteHtml
              )}
              onChange={(blocks) => {
                setNoteBlocks(blocks);
                setNoteHtml(
                  workspaceBlocksToHtml(
                    blocks
                  )
                );
              }}
              placeholder="What is He saying to you right now? Type / for blocks or @ to mention."
            />
          </div>

          <div
            style={{
              fontSize: 11,
              color: "var(--text3)",
              marginTop: 7,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Check size={11} />
            {workspaceBlocksToPlainText(
              normalizeWorkspaceBlocks(
                noteBlocks,
                noteHtml
              )
            ) || ref.trim()
              ? "Draft autosaved"
              : "Your writing will autosave here"}
          </div>

          <div className="tag-row">{Object.entries(TAGS).map(([k, v]) => <div key={k} className={`tag-swatch ${tag === k ? "selected" : ""}`} style={{ background: v.hex }} title={v.label} onClick={() => setTag(k)} />)}</div>
          <div
  style={{
    fontSize: 11.5,
    color: "var(--text3)",
    marginTop: 6,
  }}
>
  {highlightMeaningFor(highlightMeanings, tag).label ||
    TAGS[tag].label}
  {" · "}
  Select text to bold, italicize, underline, change font, or
  highlight it.
</div>
          <div className="filter-chip active" style={{ display: "inline-flex", marginTop: 10 }} onClick={save}>Save Entry</div>
        </div>
        <div className="section-label">Entries</div>

        <div
          style={{
            position: "relative",
            marginBottom: 10,
          }}
        >
          <Search
            size={15}
            color="var(--text3)"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />

          <input
            value={journalSearch}
            onChange={(event) =>
              setJournalSearch(
                event.target.value
              )
            }
            placeholder="Search journal entries…"
            aria-label="Search journal entries"
            style={{
              width: "100%",
              height: 42,
              padding:
                journalSearch
                  ? "0 40px 0 36px"
                  : "0 12px 0 36px",
              borderRadius: 12,
              border:
                "1px solid var(--inputBorder)",
              background: "var(--inputBg)",
              color: "var(--text)",
              fontSize: 13.5,
              outline: "none",
            }}
          />

          {journalSearch && (
            <button
              type="button"
              aria-label="Clear journal search"
              onClick={() =>
                setJournalSearch("")
              }
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform:
                  "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--text3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {journalSearch && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text3)",
              margin: "-2px 3px 9px",
            }}
          >
            {filteredJournalEntries.length}
            {" "}
            {filteredJournalEntries.length === 1
              ? "entry"
              : "entries"}
            {" found"}
          </div>
        )}

        <div className="card">
          {filteredJournalEntries.length ? filteredJournalEntries.map((entry) => <div key={entry.id} className="journal-entry">
            {editingId === entry.id ? <><div className="journal-compose-meta journal-edit-meta">
                <label className="journal-compose-field journal-date-field">
                  <span className="journal-compose-field-label">
                    Date
                  </span>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(ev) =>
                      setEditDate(
                        ev.target.value
                      )
                    }
                  />
                </label>

                <label className="journal-compose-field journal-scripture-field">
                  <span className="journal-compose-field-label">
                    Scripture
                  </span>
                  <input
                    value={editRef}
                    onChange={(ev) =>
                      setEditRef(
                        ev.target.value
                      )
                    }
                    placeholder="Psalm 23:1"
                  />
                </label>
              </div><div style={{ marginTop: 8 }}>
              <WorkspaceEditor
                initialBlocks={normalizeWorkspaceBlocks(
                  editBlocks,
                  editHtml
                )}
                onChange={(blocks) => {
                  setEditBlocks(blocks);
                  setEditHtml(
                    workspaceBlocksToHtml(
                      blocks
                    )
                  );
                }}
                placeholder="Journal note · Type / for blocks or @ to mention."
              />
            </div><div className="tag-row">{Object.entries(TAGS).map(([k, v]) => <div key={k} className={`tag-swatch ${editTag === k ? "selected" : ""}`} style={{ background: v.hex }} onClick={() => setEditTag(k)} />)}</div><div style={{ display: "flex", gap: 8, marginTop: 10 }}><div className="filter-chip active" onClick={() => saveEdit(entry.id)}>Save</div><div className="filter-chip" onClick={clearJournalEditDraft}>Cancel</div></div></> : <><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="verse-badge" style={{ background: TAGS[entry.tag]?.hex || TAGS.yellow.hex }}>{entry.ref || "Check-in"}</span><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 12, color: "var(--text3)" }}>{entry.date || formatDateLabel(entry.dateKey || REFERENCE_DATE_KEY)}</span><div className="entry-actions"><Pencil size={13} color="var(--text3)" onClick={() => startEdit(entry)} /><Trash2 size={13} color="var(--text3)" onClick={() => remove(entry.id)} /></div></div></div>{entry.richTextHtml ? <div className="rich-output" dangerouslySetInnerHTML={{ __html: entry.richTextHtml }} /> : <div className="rich-output">{entry.note || "Time with the Lord check-in"}</div>}<SavedTimestampLine item={entry} /></>}
          </div>) : <div className="insight-line">
            {journalSearch
              ? "No journal entries match your search."
              : "No journal entries yet."}
          </div>}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   SCRATCH PAD — add / edit / delete, typed + Apple Pencil drawing
----------------------------------------------------------------*/
function ScratchTab() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [tool, setTool] = usePersistentState(
    "abide-scratch-current-tool",
    "draw"
  );
  const [color, setColor] = usePersistentState(
    "abide-scratch-current-color",
    "#141A28"
  );

  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const canvasMetrics = useRef({
    width: 380,
    height: 260,
    dpr: 1,
  });

  const drawingAutosaveTimer = useRef(null);
  const drawingRestoreComplete = useRef(false);

  const [pages, setPages] = usePersistentState(
    "abide-scratch-pages",
    []
  );

  const [typedDraft, setTypedDraft] = usePersistentState(
    "abide-scratch-typed-draft",
    ""
  );

  const [typedBlocks, setTypedBlocks] = usePersistentState(
    "abide-scratch-typed-blocks",
    []
  );

  const [editingId, setEditingId] = usePersistentState(
    "abide-scratch-editing-id",
    null
  );

  const [scratchSearch, setScratchSearch] =
    useState("");

  /* =======================================================
     NOTES CLOUD SYNC
     Firestore = shared source of truth
     localStorage = offline/device cache

     Typed notes sync now.
     Drawing pages remain local until Storage migration.
     ======================================================= */

  const notesCloudUserRef =
    useRef(null);


  const normalizeCloudNote =
    (page) => {
      if (
        !page ||
        page.type !== "type"
      ) {
        return null;
      }

      return {
        ...page,

        id:
          page.id,

        type:
          "type",

        createdAt:
          Number(
            page.createdAt ||
            page.id ||
            Date.now()
          ),

        updatedAt:
          Number(
            page.updatedAt ||
            page.createdAt ||
            page.id ||
            Date.now()
          ),
      };
    };


  const mergeNoteCollections =
    (
      localPages,
      cloudPages
    ) => {
      const merged =
        new Map();


      [
        ...(localPages || []),
        ...(cloudPages || []),
      ].forEach(
        (page) => {
          if (
            !page ||
            page.id == null
          ) {
            return;
          }


          const key =
            String(
              page.id
            );


          const existing =
            merged.get(
              key
            );


          if (
            !existing
          ) {
            merged.set(
              key,
              page
            );

            return;
          }


          const existingUpdated =
            Number(
              existing.updatedAt ||
              existing.createdAt ||
              existing.id ||
              0
            );


          const candidateUpdated =
            Number(
              page.updatedAt ||
              page.createdAt ||
              page.id ||
              0
            );


          if (
            candidateUpdated >=
            existingUpdated
          ) {
            merged.set(
              key,
              page
            );
          }
        }
      );


      return Array.from(
        merged.values()
      ).sort(
        (a, b) =>
          Number(
            b.updatedAt ||
            b.createdAt ||
            b.id ||
            0
          ) -
          Number(
            a.updatedAt ||
            a.createdAt ||
            a.id ||
            0
          )
      );
    };


  const saveNoteToCloud =
    async (
      page
    ) => {
      const user =
        auth.currentUser;


      if (
        !user ||
        !page ||
        page.type !== "type"
      ) {
        return;
      }


      const normalized =
        normalizeCloudNote(
          page
        );


      if (
        !normalized
      ) {
        return;
      }


      try {
        await setDoc(
          doc(
            db,
            "users",
            user.uid,
            "notes",
            String(
              normalized.id
            )
          ),

          normalized,

          {
            merge:
              true,
          }
        );
      } catch (
        error
      ) {
        console.warn(
          "Notes cloud save failed:",
          error
        );
      }
    };


  const deleteNoteFromCloud =
    async (
      id
    ) => {
      const user =
        auth.currentUser;


      if (
        !user ||
        id == null
      ) {
        return;
      }


      try {
        await deleteDoc(
          doc(
            db,
            "users",
            user.uid,
            "notes",
            String(id)
          )
        );
      } catch (
        error
      ) {
        console.warn(
          "Notes cloud delete failed:",
          error
        );
      }
    };


  useEffect(() => {
    let stopSnapshot =
      null;

    let cancelled =
      false;


    const stopAuth =
      onAuthStateChanged(
        auth,

        async (
          user
        ) => {
          if (
            stopSnapshot
          ) {
            stopSnapshot();

            stopSnapshot =
              null;
          }


          notesCloudUserRef.current =
            user?.uid ||
            null;


          if (
            !user ||
            cancelled
          ) {
            return;
          }


          const notesRef =
            collection(
              db,
              "users",
              user.uid,
              "notes"
            );


          /*
           * STEP 1:
           * Read whatever is already in Firestore.
           */
          let existingCloud =
            [];


          try {
            const snapshot =
              await getDocs(
                notesRef
              );


            existingCloud =
              snapshot.docs.map(
                (
                  item
                ) => ({
                  id:
                    item.id,

                  ...item.data(),
                })
              );
          } catch (
            error
          ) {
            console.warn(
              "Notes initial cloud read failed:",
              error
            );
          }


          if (
            cancelled
          ) {
            return;
          }


          /*
           * STEP 2:
           * Merge local typed Notes with cloud Notes.
           *
           * Drawing pages stay local.
           */
          setPages(
            (
              current
            ) => {
              const localTyped =
                (
                  current ||
                  []
                ).filter(
                  (
                    page
                  ) =>
                    page.type ===
                    "type"
                );


              const localDrawings =
                (
                  current ||
                  []
                ).filter(
                  (
                    page
                  ) =>
                    page.type !==
                    "type"
                );


              const cloudTyped =
                existingCloud.filter(
                  (
                    page
                  ) =>
                    page.type ===
                    "type"
                );


              const mergedTyped =
                mergeNoteCollections(
                  localTyped,
                  cloudTyped
                );


              /*
               * STEP 3:
               * Migration upload.
               *
               * This is what carries phone-only Notes
               * into Firestore on first launch.
               */
              Promise.all(
                mergedTyped.map(
                  (
                    page
                  ) =>
                    saveNoteToCloud(
                      page
                    )
                )
              ).catch(
                (
                  error
                ) => {
                  console.warn(
                    "Notes migration upload failed:",
                    error
                  );
                }
              );


              return [
                ...mergedTyped,
                ...localDrawings,
              ];
            }
          );


          /*
           * STEP 4:
           * Real-time subscription.
           */
          stopSnapshot =
            onSnapshot(
              notesRef,

              (
                snapshot
              ) => {
                if (
                  cancelled
                ) {
                  return;
                }


                const cloudTyped =
                  snapshot.docs.map(
                    (
                      item
                    ) => ({
                      id:
                        item.id,

                      ...item.data(),
                    })
                  );


                setPages(
                  (
                    current
                  ) => {
                    const localTyped =
                      (
                        current ||
                        []
                      ).filter(
                        (
                          page
                        ) =>
                          page.type ===
                          "type"
                      );


                    const localDrawings =
                      (
                        current ||
                        []
                      ).filter(
                        (
                          page
                        ) =>
                          page.type !==
                          "type"
                      );


                    return [
                      ...mergeNoteCollections(
                        localTyped,
                        cloudTyped
                      ),

                      ...localDrawings,
                    ];
                  }
                );
              },

              (
                error
              ) => {
                console.warn(
                  "Notes realtime sync failed:",
                  error
                );
              }
            );
        }
      );


    return () => {
      cancelled =
        true;

      stopSnapshot?.();

      stopAuth?.();
    };
  }, []);



  const [isDrawingFullscreen, setIsDrawingFullscreen] =
    useState(false);

  const drawingFullscreenRef = useRef(false);
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  // Used only to force toolbar button-state refreshes.
  const [drawingHistoryVersion, setDrawingHistoryVersion] =
    useState(0);

  const normalizedScratchSearch =
    scratchSearch.trim().toLowerCase();

  const filteredScratchPages =
    normalizedScratchSearch
      ? pages.filter((pg) => {
          const typedText =
            pg.type === "type"
              ? htmlToPlainText(
                  pg.contentHtml ||
                    pg.content ||
                    ""
                )
              : "";

          const searchableText = [
            typedText,
            pg.date || "",
            pg.type === "draw"
              ? "drawing sketch"
              : "note text",
            savedTimestampSearchText(pg),
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedScratchSearch
          );
        })
      : pages;

  useEffect(() => {
    const needsBackfill = pages.some(
      (page) =>
        !page.createdAt ||
        !page.updatedAt
    );

    if (!needsBackfill) return;

    setPages((current) =>
      current.map((page) => {
        const createdAt =
          savedCreatedAt(page);

        if (!createdAt) {
          return page;
        }

        return {
          ...page,
          createdAt:
            page.createdAt ||
            createdAt,
          updatedAt:
            page.updatedAt ||
            createdAt,
        };
      })
    );
  }, []);

  const SCRATCH_DRAWING_DRAFT_KEY =
    "abide-scratch-drawing-draft";

  const refreshDrawingHistoryControls = () => {
    setDrawingHistoryVersion(
      (version) => version + 1
    );
  };

  const canvasSnapshot = () => {
    const canvas = canvasRef.current;

    if (!canvas) return "";

    try {
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  };

  const pushUndoSnapshot = () => {
    const snapshot = canvasSnapshot();

    if (!snapshot) return;

    undoStack.current.push(snapshot);

    // Keep memory bounded while still providing
    // plenty of useful drawing history.
    if (undoStack.current.length > 30) {
      undoStack.current.shift();
    }

    redoStack.current = [];
    refreshDrawingHistoryControls();
  };

  const loadCanvasSnapshot = (
    dataUrl,
    autosave = true
  ) => {
    if (!dataUrl) return;

    const img = new Image();

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx =
        canvas.getContext("2d");

      const {
        width,
        height,
        dpr,
      } = canvasMetrics.current;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      ctx.fillStyle = "#F2F1EC";
      ctx.fillRect(
        0,
        0,
        width,
        height
      );

      ctx.drawImage(
        img,
        0,
        0,
        width,
        height
      );

      if (autosave) {
        saveDrawingDraftNow();
      }
    };

    img.src = dataUrl;
  };

  const undoDrawing = () => {
    if (!undoStack.current.length) return;

    const current = canvasSnapshot();

    if (current) {
      redoStack.current.push(current);
    }

    const previous =
      undoStack.current.pop();

    loadCanvasSnapshot(previous);
    refreshDrawingHistoryControls();
  };

  const redoDrawing = () => {
    if (!redoStack.current.length) return;

    const current = canvasSnapshot();

    if (current) {
      undoStack.current.push(current);
    }

    const next =
      redoStack.current.pop();

    loadCanvasSnapshot(next);
    refreshDrawingHistoryControls();
  };

  const resetDrawingHistory = () => {
    undoStack.current = [];
    redoStack.current = [];
    refreshDrawingHistoryControls();
  };

  const clearDrawingDraft = () => {
    try {
      localStorage.removeItem(
        SCRATCH_DRAWING_DRAFT_KEY
      );
    } catch {}
  };

  const saveDrawingDraftNow = (
    editingIdOverride = editingId
  ) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    try {
      const content =
        canvas.toDataURL("image/png");

      localStorage.setItem(
        SCRATCH_DRAWING_DRAFT_KEY,
        JSON.stringify({
          content,
          editingId:
            editingIdOverride || null,
          updatedAt: Date.now(),
        })
      );
    } catch (error) {
      console.warn(
        "Notes drawing autosave failed:",
        error
      );
    }
  };

  const scheduleDrawingDraftSave = (
    editingIdOverride = editingId
  ) => {
    if (drawingAutosaveTimer.current) {
      window.clearTimeout(
        drawingAutosaveTimer.current
      );
    }

    drawingAutosaveTimer.current =
      window.setTimeout(() => {
        drawingAutosaveTimer.current =
          null;

        saveDrawingDraftNow(
          editingIdOverride
        );
      }, 350);
  };

  const restoreDrawingDraft = () => {
    if (
      drawingRestoreComplete.current ||
      !canvasRef.current
    ) {
      return;
    }

    drawingRestoreComplete.current = true;

    let draft = null;

    try {
      const raw =
        localStorage.getItem(
          SCRATCH_DRAWING_DRAFT_KEY
        );

      draft = raw
        ? JSON.parse(raw)
        : null;
    } catch {}

    if (!draft?.content) return;

    if (draft.editingId) {
      setEditingId(draft.editingId);
    }

    const img = new Image();

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx =
        canvas.getContext("2d");

      const {
        width,
        height,
        dpr,
      } = canvasMetrics.current;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      ctx.drawImage(
        img,
        0,
        0,
        width,
        height
      );
    };

    img.src = draft.content;
  };

  const paintPaper = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height, dpr } = canvasMetrics.current;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#F2F1EC";
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const resizeCanvas = (preserve = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const width =
      Math.max(
        1,
        rect.width || 380
      );

    const height =
      drawingFullscreenRef.current
        ? Math.max(
            1,
            rect.height ||
              window.innerHeight - 100
          )
        : width * (260 / 380);

    const dpr =
      Math.max(
        1,
        window.devicePixelRatio || 1
      );

    let snapshot = null;
    if (preserve && canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d").drawImage(canvas, 0, 0);
    }

    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvasMetrics.current = { width, height, dpr };

    paintPaper();
    if (snapshot) {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, width, height);
    }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      resizeCanvas(false);

      // After the canvas has real dimensions, restore any
      // drawing that was autosaved before a refresh/update.
      restoreDrawingDraft();
    });

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() =>
            resizeCanvas(true)
          )
        : null;

    if (observer && wrapRef.current) {
      observer.observe(wrapRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);

      if (drawingAutosaveTimer.current) {
        window.clearTimeout(
          drawingAutosaveTimer.current
        );
      }

      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    drawingFullscreenRef.current =
      isDrawingFullscreen;

    const previousOverflow =
      document.body.style.overflow;

    if (isDrawingFullscreen) {
      document.body.style.overflow =
        "hidden";
    }

    const resizeFrame =
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resizeCanvas(true);
        });
      });

    const handleEscape = (event) => {
      if (
        event.key === "Escape" &&
        isDrawingFullscreen
      ) {
        saveDrawingDraftNow();
        setIsDrawingFullscreen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      cancelAnimationFrame(
        resizeFrame
      );

      window.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [isDrawingFullscreen]);

  const toggleDrawingFullscreen = () => {
    saveDrawingDraftNow();
    setIsDrawingFullscreen(
      (current) => !current
    );
  };

  const getPos = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const e = event.nativeEvent || event;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : (e.pointerType === "pen" ? 0.35 : 0.5);
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure };
  };

  const onDown = (e) => {
    e.preventDefault();

    // Save the canvas exactly as it looked before this stroke.
    pushUndoSnapshot();

    drawing.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const p = getPos(e);
    lastPoint.current = p;
  };

  const onMove = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { dpr } = canvasMetrics.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const native = e.nativeEvent || e;
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [native];

    samples.forEach((sample) => {
      const rect = canvas.getBoundingClientRect();
      const pressure = sample.pressure && sample.pressure > 0 ? sample.pressure : (sample.pointerType === "pen" ? 0.35 : 0.5);
      const point = { x: sample.clientX - rect.left, y: sample.clientY - rect.top, pressure };
      const prev = lastPoint.current || point;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineWidth = Math.max(1.25, pressure * 5.5);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPoint.current = point;
    });

    // Throttled so Apple Pencil / pointer movement stays smooth.
    scheduleDrawingDraftSave();
  };

  const onUp = (e) => {
    drawing.current = false;
    lastPoint.current = null;

    try {
      e.currentTarget.releasePointerCapture(
        e.pointerId
      );
    } catch {}

    saveDrawingDraftNow();
  };

  const clearCanvas = (
    removeDraft = true
  ) => {
    paintPaper();
    drawing.current = false;
    lastPoint.current = null;

    if (removeDraft) {
      clearDrawingDraft();
    }
  };

  const clearCanvasWithHistory = () => {
    pushUndoSnapshot();
    clearCanvas();
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl =
      canvas.toDataURL("image/png");

    const savedAt = Date.now();

    if (editingId) {
      setPages((prev) =>
        prev.map((pg) =>
          pg.id === editingId
            ? {
                ...pg,
                type: "draw",
                content: dataUrl,
                createdAt:
                  savedCreatedAt(pg) ||
                  savedAt,
                updatedAt: savedAt,
              }
            : pg
        )
      );

      setEditingId(null);
    } else {
      setPages((prev) => [
        {
          id: savedAt,
          type: "draw",
          content: dataUrl,
          date: formatDateLabel(
            REFERENCE_DATE_KEY
          ),
          createdAt: savedAt,
          updatedAt: savedAt,
        },
        ...prev,
      ]);
    }

    // The permanent page now owns the drawing.
    clearDrawingDraft();
    clearCanvas(false);
    resetDrawingHistory();
  };

  const saveTyped = () => {
    const effectiveBlocks =
      normalizeWorkspaceBlocks(
        typedBlocks,
        typedDraft
      );

    const plain =
      workspaceBlocksToPlainText(
        effectiveBlocks
      );

    const html =
      workspaceBlocksToHtml(
        effectiveBlocks
      );

    if (!plain) return;

    const savedAt = Date.now();

    if (editingId) {
      setPages((prev) =>
        prev.map((pg) => {
          if (
            pg.id !== editingId
          ) {
            return pg;
          }

          const updatedPage = {
            ...pg,

            type:
              "type",

            content:
              html,

            contentHtml:
              html,

            workspaceBlocks:
              effectiveBlocks,

            references:
              workspaceBlockReferences(
                effectiveBlocks
              ),

            createdAt:
              savedCreatedAt(pg) ||
              savedAt,

            updatedAt:
              savedAt,
          };

          saveNoteToCloud(
            updatedPage
          );

          return updatedPage;
        })
      );

      setEditingId(null);
    } else {
      const newPage = {
        id:
          savedAt,

        type:
          "type",

        content:
          html,

        contentHtml:
          html,

        workspaceBlocks:
          effectiveBlocks,

        references:
          workspaceBlockReferences(
            effectiveBlocks
          ),

        date:
          formatDateLabel(
            REFERENCE_DATE_KEY
          ),

        createdAt:
          savedAt,

        updatedAt:
          savedAt,
      };

      setPages(
        (
          prev
        ) => [
          newPage,
          ...prev,
        ]
      );

      saveNoteToCloud(
        newPage
      );
    }

    setTypedDraft("");
    setTypedBlocks([]);
  };

  const editPage = (pg) => {
    setEditingId(pg.id);

    if (pg.type === "type") {
      setTool("type");

      const legacyHtml =
        pg.contentHtml ||
        (
          String(
            pg.content || ""
          ).includes("<")
            ? pg.content
            : plainTextToHtml(
                pg.content || ""
              )
        );

      setTypedDraft(
        legacyHtml
      );

      setTypedBlocks(
        normalizeWorkspaceBlocks(
          pg.workspaceBlocks,
          legacyHtml
        )
      );

      return;
    }

    setTool("draw");
    resetDrawingHistory();

    requestAnimationFrame(() => {
      resizeCanvas(false);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const { width, height, dpr } =
          canvasMetrics.current;

        ctx.setTransform(
          dpr,
          0,
          0,
          dpr,
          0,
          0
        );

        ctx.drawImage(
          img,
          0,
          0,
          width,
          height
        );

        // Entering edit mode itself establishes a recoverable
        // drawing draft, even before the next Pencil stroke.
        saveDrawingDraftNow(pg.id);
      };

      img.src = pg.content;
    });
  };

  const deletePage = (id) => {
    const pageToDelete =
      pages.find(
        (page) =>
          page.id === id
      );

    setPages(
      (prev) =>
        prev.filter(
          (pg) =>
            pg.id !== id
        )
    );

    if (
      pageToDelete?.type ===
      "type"
    ) {
      deleteNoteFromCloud(
        id
      );
    }

    if (
      editingId === id
    ) {
      setEditingId(null);
      clearDrawingDraft();
      clearCanvas(false);
      setTypedDraft("");
      setTypedBlocks([]);
    }
  };

  return (
    <>
      <Header eyebrow="Type, or use Apple Pencil on iPad" title="Notes" />
      <div className="scroll">
        <div className="segmented">
          <div className={`seg-btn ${tool === "draw" ? "active" : ""}`} onClick={() => setTool("draw")}>Draw</div>
          <div className={`seg-btn ${tool === "type" ? "active" : ""}`} onClick={() => setTool("type")}>Type</div>
        </div>
        {editingId && <div className="insight-line" style={{ padding: "0 4px 10px 4px" }}>Editing this saved page — add to it or change anything, then save to update the same page.</div>}
        {tool === "draw" ? (
          <div
            style={
              isDrawingFullscreen
                ? {
                    position: "fixed",
                    inset: 0,
                    zIndex: 20000,
                    background:
                      "var(--appBg)",
                    display: "flex",
                    flexDirection: "column",
                    paddingTop:
                      "env(safe-area-inset-top, 0px)",
                    paddingBottom:
                      "env(safe-area-inset-bottom, 0px)",
                  }
                : undefined
            }
          >
            {isDrawingFullscreen && (
              <div
                style={{
                  minHeight: 46,
                  padding: "8px 12px 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    Notes
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--text3)",
                      marginTop: 1,
                    }}
                  >
                    Drawing autosaves as you work
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    toggleDrawingFullscreen
                  }
                  aria-label="Exit full screen"
                  title="Exit full screen"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border:
                      "1px solid var(--pillBorder)",
                    background:
                      "var(--pillBg)",
                    color: "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            )}

            <div
              className="scratch-toolbar"
              style={{
                margin:
                  isDrawingFullscreen
                    ? "4px 10px 8px"
                    : undefined,
                padding:
                  isDrawingFullscreen
                    ? "8px 10px"
                    : undefined,
                borderRadius:
                  isDrawingFullscreen
                    ? 14
                    : undefined,
                background:
                  isDrawingFullscreen
                    ? "var(--card)"
                    : undefined,
                border:
                  isDrawingFullscreen
                    ? "1px solid var(--cardBorder)"
                    : undefined,
                flexWrap: "wrap",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {[
                  "#141A28",
                  "#E8B45C",
                  "#8FA88A",
                  "#D98595",
                  "#7C93C9",
                ].map((c) => (
                  <div
                    key={c}
                    className={`swatch-mini ${
                      color === c
                        ? "selected"
                        : ""
                    }`}
                    style={{
                      background: c,
                    }}
                    onClick={() =>
                      setColor(c)
                    }
                  />
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 7,
                  alignItems: "center",
                  marginLeft: "auto",
                }}
              >
                <button
                  type="button"
                  className="tool-btn"
                  aria-label="Undo"
                  title="Undo"
                  disabled={
                    !undoStack.current.length
                  }
                  onClick={undoDrawing}
                  style={{
                    opacity:
                      undoStack.current.length
                        ? 1
                        : 0.38,
                  }}
                >
                  <Undo2 size={15} />
                </button>

                <button
                  type="button"
                  className="tool-btn"
                  aria-label="Redo"
                  title="Redo"
                  disabled={
                    !redoStack.current.length
                  }
                  onClick={redoDrawing}
                  style={{
                    opacity:
                      redoStack.current.length
                        ? 1
                        : 0.38,
                  }}
                >
                  <Redo2 size={15} />
                </button>

                <button
                  type="button"
                  className="tool-btn"
                  aria-label="Clear page"
                  title="Clear page"
                  onClick={
                    clearCanvasWithHistory
                  }
                >
                  <Trash2 size={15} />
                </button>

                {!isDrawingFullscreen && (
                  <button
                    type="button"
                    className="tool-btn"
                    aria-label="Full screen"
                    title="Full screen"
                    onClick={
                      toggleDrawingFullscreen
                    }
                  >
                    <Maximize2 size={15} />
                  </button>
                )}

                <button
                  type="button"
                  className="tool-btn active"
                  aria-label="Save drawing"
                  title={
                    editingId
                      ? "Update drawing"
                      : "Save drawing"
                  }
                  onClick={saveDrawing}
                >
                  <Check size={16} />
                </button>
              </div>
            </div>

            <div
              ref={wrapRef}
              className="scratch-canvas-wrap"
              style={
                isDrawingFullscreen
                  ? {
                      flex: 1,
                      minHeight: 0,
                      height:
                        "calc(100vh - 118px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                      margin: "0 10px 10px",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow:
                        "0 8px 28px rgba(0,0,0,0.18)",
                    }
                  : undefined
              }
            >
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height:
                    isDrawingFullscreen
                      ? "100%"
                      : undefined,
                  aspectRatio:
                    isDrawingFullscreen
                      ? "auto"
                      : "380 / 260",
                  display: "block",
                  touchAction: "none",
                  cursor: "crosshair",
                }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onPointerLeave={(e) => {
                  if (
                    drawing.current &&
                    e.buttons === 0
                  ) {
                    onUp(e);
                  }
                }}
              />
            </div>

            {!isDrawingFullscreen && (
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text3)",
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <PenTool size={12} />
                High-resolution, pressure-sensitive canvas for finger, mouse, or Apple Pencil. Drawing autosaves as you work.
              </div>
            )}
          </div>
        ) : (
          <>
            <WorkspaceEditor
              key={`notes-${editingId || "new"}`}
              initialBlocks={normalizeWorkspaceBlocks(
                typedBlocks,
                typedDraft
              )}
              onChange={(blocks) => {
                setTypedBlocks(blocks);

                setTypedDraft(
                  workspaceBlocksToHtml(
                    blocks
                  )
                );
              }}
              placeholder="Jot it down… Type / for blocks or @ to mention."
            />

            <div
              style={{
                fontSize: 11,
                color: "var(--text3)",
                marginTop: 7,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Check size={11} />
              {htmlToPlainText(typedDraft)
                ? "Draft autosaved"
                : "Your note will autosave here"}
            </div>

            <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>Select text to bold, italicize, underline, change font, or highlight it.</div>
            <div className="filter-chip active" style={{ display: "inline-flex", marginTop: 10 }} onClick={saveTyped}><Type size={12} />{editingId ? "Update Note" : "Save Note"}</div>
          </>
        )}
        <div className="section-label">Past Pages</div>

        <div
          style={{
            position: "relative",
            marginBottom: 10,
          }}
        >
          <Search
            size={15}
            color="var(--text3)"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />

          <input
            value={scratchSearch}
            onChange={(event) =>
              setScratchSearch(
                event.target.value
              )
            }
            placeholder="Search Notes…"
            aria-label="Search Notes"
            style={{
              width: "100%",
              height: 42,
              padding:
                scratchSearch
                  ? "0 40px 0 36px"
                  : "0 12px 0 36px",
              borderRadius: 12,
              border:
                "1px solid var(--inputBorder)",
              background: "var(--inputBg)",
              color: "var(--text)",
              fontSize: 13.5,
              outline: "none",
            }}
          />

          {scratchSearch && (
            <button
              type="button"
              aria-label="Clear Notes search"
              onClick={() =>
                setScratchSearch("")
              }
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform:
                  "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--text3)",
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {scratchSearch && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text3)",
              margin: "-2px 3px 9px",
              lineHeight: 1.45,
            }}
          >
            {filteredScratchPages.length}
            {" "}
            {filteredScratchPages.length === 1
              ? "page"
              : "pages"}
            {" found"}
            {" · "}
            Typed notes are searchable by text.
            Drawings can be found by date.
          </div>
        )}

        {scratchSearch &&
          filteredScratchPages.length === 0 && (
            <div
              className="insight-line"
              style={{
                marginBottom: 10,
              }}
            >
              No Notes pages match your search.
            </div>
          )}

        <div className="scratch-grid">
          {filteredScratchPages.map((pg) => (
            <div
              key={pg.id}
              className="scratch-item card"
              role="button"
              tabIndex={0}
              onClick={() =>
                editPage(pg)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  editPage(pg);
                }
              }}
              style={{
                cursor:
                  "pointer",
              }}
            >
              {pg.type === "draw" ? (
                <img
                  src={pg.content}
                  className="scratch-thumb"
                  alt="scratch page"
                />
              ) : (
                <div
                  style={{
                    padding:
                      10,
                    fontSize:
                      12.5,
                    color:
                      "var(--body2)",
                    minHeight:
                      70,
                    lineHeight:
                      1.45,
                  }}
                  dangerouslySetInnerHTML={{
                    __html:
                      pg.contentHtml ||
                      (
                        String(
                          pg.content ||
                          ""
                        ).includes("<")
                          ? pg.content
                          : plainTextToHtml(
                              pg.content ||
                              ""
                            )
                      ),
                  }}
                />
              )}

              <div
                style={{
                  padding:
                    "0 10px 8px",
                }}
              >
                <SavedTimestampLine
                  item={pg}
                />
              </div>

              <div className="cap">
                <span>
                  {pg.date}
                </span>

                <span className="cap-icons">
                  <Pencil
                    size={12}
                    onClick={(event) => {
                      event.stopPropagation();
                      editPage(pg);
                    }}
                  />

                  <Trash2
                    size={12}
                    onClick={(event) => {
                      event.stopPropagation();
                      deletePage(pg.id);
                    }}
                  />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function LinkCard({ icon: Icon, tint, name, desc, placeholder, initialUrl = "", storageKey }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = usePersistentState(storageKey || `abide-link-${name}`, initialUrl);
  useEffect(() => {
    if (!url && initialUrl) setUrl(initialUrl);
  }, [initialUrl]);
  return (
    <div className="link-card">
      <div className="link-icon" style={{ background: tint + "22" }}><Icon size={19} color={tint} /></div>
      <div style={{ flex: 1 }}>
        <div className="link-name">{name}</div>
        <div className="link-desc">{desc}</div>
        {editing || !url ? <input className="link-url-input" placeholder={placeholder} value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => url && setEditing(false)} /> : <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#E8B45C", marginTop: 3, display: "inline-block" }}>{url}</a>}
      </div>
      {url && !editing && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Pencil size={14} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => setEditing(true)} /><a href={url} target="_blank" rel="noreferrer" style={{ display: "flex", color: "inherit" }}><ExternalLink size={15} color="var(--text3)" /></a></div>}
    </div>
  );
}

/* ---------------------------------------------------------------
   NOTIFICATION CENTER + SETTINGS (reached from bottom of Insights)
----------------------------------------------------------------*/
function RemindersTab({ tasks, goals, areas, onUpdateTask, onDeleteTask, onCreateArea }) {
  const [prefs, setPrefs] = usePersistentState("abide-notification-prefs", { tasks: true, calendar: true, review: true, streak: true, milestones: true });
  const [editingTask, setEditingTask] = useState(null);
  const [permission, setPermission] = useState(() => typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const [backgroundPushStatus, setBackgroundPushStatus] = useState({
    supported: false,
    permission: "default",
    registered: false,
  });
  const [backgroundPushBusy, setBackgroundPushBusy] = useState(false);
  const [backgroundPushError, setBackgroundPushError] = useState("");
  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const rows = [{ k: "tasks", label: "Task reminders" }, { k: "calendar", label: "Calendar event alerts" }, { k: "review", label: "Weekly review nudge" }, { k: "streak", label: "Journal streak reminder" }, { k: "milestones", label: "Goal milestone alerts" }];
  const reminders = tasks.filter((t) => !t.done && t.reminder && t.reminder !== "None").sort((a, b) => taskDateKey(a).localeCompare(taskDateKey(b)));

  useEffect(() => {
    if (typeof window === "undefined") return;

    let taskId = "";

    try {
      const params = new URLSearchParams(window.location.search);
      taskId = params.get("taskId") || "";
    } catch {
      return;
    }

    if (!taskId) return;

    const targetTask = tasks.find(
      (task) => String(task.id) === String(taskId)
    );

    if (!targetTask) return;

    setEditingTask(targetTask);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("taskId");
      url.searchParams.delete("tab");

      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch {}
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;

    const refreshBackgroundPushStatus = async () => {
      try {
        const status = await getBackgroundPushStatus();

        if (!cancelled) {
          setBackgroundPushStatus(status);
        }
      } catch {
        // Keep the default status if this browser cannot inspect FCM.
      }
    };

    refreshBackgroundPushStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === "granted") {
      new Notification("Abide notifications enabled", {
        body: "Notification permission is enabled on this device.",
      });
    }
  };

  const registerBackgroundNotifications = async () => {
    if (backgroundPushBusy) return;

    setBackgroundPushBusy(true);
    setBackgroundPushError("");

    try {
      await enableBackgroundPush();

      const status = await getBackgroundPushStatus();

      setBackgroundPushStatus(status);

      if (typeof Notification !== "undefined") {
        setPermission(Notification.permission);
      }
    } catch (error) {
      console.error("Background notification registration failed:", error);

      setBackgroundPushError(
        error?.message ||
          "Abide could not register this device for background notifications."
      );

      try {
        const status = await getBackgroundPushStatus();
        setBackgroundPushStatus(status);
      } catch {}
    } finally {
      setBackgroundPushBusy(false);
    }
  };

  const unregisterBackgroundNotifications = async () => {
    if (backgroundPushBusy) return;

    setBackgroundPushBusy(true);
    setBackgroundPushError("");

    try {
      await disableBackgroundPush();

      const status = await getBackgroundPushStatus();
      setBackgroundPushStatus(status);
    } catch (error) {
      setBackgroundPushError(
        error?.message ||
          "Abide could not disable background notifications."
      );
    } finally {
      setBackgroundPushBusy(false);
    }
  };

  const testNotification = () => {
    if (permission !== "granted") return;
    new Notification("Abide test reminder", { body: "Notifications are working on this device." });
  };

  useEffect(() => {
    if (permission !== "granted" || !prefs.tasks) return;
    const check = () => {
      // When this device is registered for Firebase background push,
      // the server scheduler is authoritative. Avoid showing a second
      // local notification for the same task.
      if (localStorage.getItem("abide-fcm-device-token-local")) return;

      const now = Date.now();
      tasks.forEach((task) => {
        if (task.done || !task.reminder || task.reminder === "None") return;
        const moment = taskReminderMoment(task);
        if (!moment) return;
        const diff = now - moment.getTime();
        if (diff < 0 || diff > 60000) return;
        const firedKey = `abide-notification-fired:${task.id}:${moment.toISOString()}`;
        try {
          if (localStorage.getItem(firedKey)) return;
          new Notification(task.title, { body: `${task.reminder} · ${formatDateLabel(taskDateKey(task))}${task.dueTime ? ` · ${formatTimeLabel(task.dueTime)}` : ""}`, tag: String(task.id) });
          localStorage.setItem(firedKey, "1");
        } catch {}
      });
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => window.clearInterval(id);
  }, [tasks, prefs.tasks, permission]);

  return (
    <>
      <Header eyebrow="Alerts & reminders" title="Reminders" />
      <div className="scroll">
        {editingTask && <TaskEditor task={editingTask} goals={goals} areas={areas} onSave={(u) => { onUpdateTask(u); setEditingTask(null); }} onCancel={() => setEditingTask(null)} onDelete={(id) => { onDeleteTask(id); setEditingTask(null); }} onCreateArea={onCreateArea} />}

        <div className="section-label">Device Notifications</div>
        <div className="card">
          <div className="notification-status">
            <div>
              <div style={{ fontWeight: 650, color: "var(--text)", fontSize: 13.5 }}>Notification permission</div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>{permission === "granted" ? "Enabled on this device" : permission === "denied" ? "Blocked in browser settings" : permission === "unsupported" ? "Not supported by this browser" : "Not enabled yet"}</div>
            </div>
            {permission !== "granted" ? <div className="filter-chip active" onClick={enableNotifications}>Enable</div> : <div className="filter-chip" onClick={testNotification}>Test</div>}
          </div>
        </div>
        <div className="section-label">Background Delivery</div>

        <div className="card">
          <div
            className="settings-row"
            style={{
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="settings-row-name"
                style={{
                  fontWeight: 700,
                }}
              >
                Background notifications
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text3)",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                {backgroundPushStatus.registered
                  ? "This device is registered for Firebase push delivery."
                  : backgroundPushStatus.supported
                    ? "Register this device so reminders can arrive when Abide is closed."
                    : "Checking whether background push is available on this device…"}
              </div>
            </div>

            {backgroundPushStatus.registered ? (
              <div
                className="filter-chip active"
                style={{
                  flexShrink: 0,
                  cursor: backgroundPushBusy ? "default" : "pointer",
                  opacity: backgroundPushBusy ? 0.6 : 1,
                }}
                onClick={unregisterBackgroundNotifications}
              >
                <Check size={11} />
                Registered
              </div>
            ) : (
              <div
                className="filter-chip active"
                style={{
                  flexShrink: 0,
                  cursor: backgroundPushBusy ? "default" : "pointer",
                  opacity: backgroundPushBusy ? 0.6 : 1,
                }}
                onClick={registerBackgroundNotifications}
              >
                <Bell size={11} />
                {backgroundPushBusy ? "Registering…" : "Enable"}
              </div>
            )}
          </div>
        </div>

        {backgroundPushError && (
          <div
            style={{
              margin: "7px 4px 0",
              padding: "9px 10px",
              borderRadius: 10,
              background: "rgba(230,128,128,0.08)",
              border: "1px solid rgba(230,128,128,0.18)",
              color: "#E68080",
              fontSize: 11.5,
              lineHeight: 1.45,
            }}
          >
            {backgroundPushError}
          </div>
        )}

        <div
          style={{
            fontSize: 11.5,
            color: "var(--text3)",
            margin: "7px 4px 0",
            lineHeight: 1.45,
          }}
        >
          When registered, Firebase can deliver task reminders to this device
          even when the Abide interface is closed.
        </div>

        <div className="section-label">Upcoming Notifications</div>
        <div className="card">{reminders.length ? reminders.map((t) => <div key={t.id} className="review-item" style={{ cursor: "pointer" }} onClick={() => setEditingTask(t)}><span><strong>{t.title}</strong><span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>{formatDateLabel(taskDateKey(t))}{t.dueTime ? ` · ${formatTimeLabel(t.dueTime)}` : ""}</span></span><span className="review-count">{taskReminderLabel(t)}</span></div>) : <div className="insight-line">No task reminders scheduled yet.</div>}</div>
        <div className="section-label">Notification Types</div>
        <div className="card">{rows.map((r) => <div key={r.k} className="settings-row"><span className="settings-row-name">{r.label}</span><Toggle on={prefs[r.k]} onClick={() => toggle(r.k)} /></div>)}</div>
      </div>
    </>
  );
}

function NotificationCenter({ onBack, tasks = [] }) {
  const [prefs, setPrefs] = usePersistentState(
    "abide-notification-prefs",
    {
      tasks: true,
      calendar: true,
      review: true,
      streak: true,
      milestones: true,
    }
  );

  const [pushStatus, setPushStatus] = useState({
    supported: null,
    permission: "default",
    registered: false,
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  const toggle = (k) =>
    setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const rows = [
    { k: "tasks", label: "Task reminders" },
    { k: "calendar", label: "Calendar event alerts" },
    { k: "review", label: "Weekly review nudge" },
    { k: "streak", label: "Journal streak reminder" },
    { k: "milestones", label: "Goal milestone alerts" },
  ];

  const reminders = tasks
    .filter(
      (t) =>
        !t.done &&
        t.reminder &&
        t.reminder !== "None"
    )
    .sort((a, b) =>
      taskDateKey(a).localeCompare(taskDateKey(b))
    );

  const refreshPushStatus = async () => {
    const status = await getBackgroundPushStatus();
    setPushStatus(status);
  };

  useEffect(() => {
    refreshPushStatus().catch(() => {
      setPushStatus({
        supported: false,
        permission: "unsupported",
        registered: false,
      });
    });
  }, []);

  const enablePush = async () => {
    if (pushBusy) return;

    setPushBusy(true);
    setPushMessage("");

    try {
      await enableBackgroundPush();
      await refreshPushStatus();
      setPushMessage(
        "This device is registered for Abide background notifications."
      );
    } catch (error) {
      setPushMessage(
        error?.message ||
          "Abide could not enable background notifications."
      );
      await refreshPushStatus().catch(() => {});
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    if (pushBusy) return;

    setPushBusy(true);
    setPushMessage("");

    try {
      await disableBackgroundPush();
      await refreshPushStatus();
      setPushMessage(
        "Background notifications are disabled on this device."
      );
    } catch (error) {
      setPushMessage(
        error?.message ||
          "Abide could not disable background notifications."
      );
    } finally {
      setPushBusy(false);
    }
  };

  const pushEnabled =
    pushStatus.permission === "granted" &&
    pushStatus.registered;

  return (
    <>
      <Header
        eyebrow="Reminders & alerts"
        title="Notification Center"
        onBack={onBack}
      />

      <div className="scroll">
        <div className="section-label">
          Background Notifications
        </div>

        <div
          className="card"
          style={{ padding: 14 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {pushEnabled
                  ? "Background notifications are on"
                  : "Get reminders when Abide is closed"}
              </div>

              <div
                style={{
                  fontSize: 11.75,
                  lineHeight: 1.5,
                  color: "var(--text3)",
                  marginTop: 5,
                }}
              >
                {pushStatus.supported === false
                  ? "This browser or device does not currently support Abide background notifications. On iPhone and iPad, install Abide to the Home Screen first."
                  : pushEnabled
                    ? "This device is registered with Abide. Task reminders can arrive through Firebase even when Abide is closed."
                    : "Allow notifications and register this device so Abide can deliver reminders even when the app is not open."}
              </div>
            </div>

            <div
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                flexShrink: 0,
                fontSize: 10.5,
                fontWeight: 750,
                background: pushEnabled
                  ? "rgba(143,168,138,.12)"
                  : "var(--pillBg)",
                border: pushEnabled
                  ? "1px solid rgba(143,168,138,.22)"
                  : "1px solid var(--pillBorder)",
                color: pushEnabled
                  ? "#8FA88A"
                  : "var(--text3)",
              }}
            >
              {pushEnabled ? "Registered" : "Not registered"}
            </div>
          </div>

          {pushStatus.supported !== false && (
            <button
              type="button"
              disabled={pushBusy}
              onClick={
                pushEnabled
                  ? disablePush
                  : enablePush
              }
              style={{
                width: "100%",
                border: pushEnabled
                  ? "1px solid var(--pillBorder)"
                  : "1px solid #E8B45C",
                background: pushEnabled
                  ? "var(--pillBg)"
                  : "#E8B45C",
                color: pushEnabled
                  ? "var(--text2)"
                  : "#14100A",
                borderRadius: 11,
                padding: "10px 12px",
                font: "inherit",
                fontSize: 12.5,
                fontWeight: 750,
                cursor: pushBusy
                  ? "default"
                  : "pointer",
                opacity: pushBusy ? .6 : 1,
                marginTop: 13,
              }}
            >
              {pushBusy
                ? "Working…"
                : pushEnabled
                  ? "Disable Background Notifications"
                  : "Enable Background Notifications"}
            </button>
          )}

          {pushMessage && (
            <div
              style={{
                fontSize: 11.5,
                lineHeight: 1.45,
                color:
                  pushEnabled
                    ? "#8FA88A"
                    : "var(--text3)",
                marginTop: 9,
              }}
            >
              {pushMessage}
            </div>
          )}

          {pushStatus.permission === "denied" && (
            <div
              style={{
                fontSize: 11.5,
                lineHeight: 1.45,
                color: "#E68080",
                marginTop: 9,
              }}
            >
              Notifications are blocked for Abide in your device settings.
              Re-enable them there before trying again.
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: 11.5,
            color: "var(--text3)",
            margin: "7px 4px 0",
            lineHeight: 1.5,
          }}
        >
          Registered devices receive scheduled task reminders through
          Firebase Cloud Messaging, so delivery does not depend on keeping
          Abide open.
        </div>

        <div className="section-label">
          Upcoming Notifications
        </div>

        <div className="card">
          {reminders.length ? (
            reminders.map((t) => (
              <div
                key={t.id}
                className="review-item"
              >
                <span>
                  <strong>{t.title}</strong>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      color: "var(--text3)",
                      marginTop: 2,
                    }}
                  >
                    {formatDateLabel(taskDateKey(t))}
                    {t.dueTime
                      ? ` · ${formatTimeLabel(t.dueTime)}`
                      : ""}
                  </span>
                </span>

                <span className="review-count">
                  {t.reminder}
                </span>
              </div>
            ))
          ) : (
            <div className="insight-line">
              No task reminders scheduled yet.
            </div>
          )}
        </div>

        <div className="section-label">
          Notification Types
        </div>

        <div className="card">
          {rows.map((r) => (
            <div
              key={r.k}
              className="settings-row"
            >
              <span className="settings-row-name">
                {r.label}
              </span>

              <Toggle
                on={prefs[r.k]}
                onClick={() => toggle(r.k)}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


function ProtectedBlockRow({ block, onEdit, onDelete }) {
  return (
    <div className="settings-row">
      <div className="settings-row-name"><ShieldCheck size={15} color="#8FA88A" />{block.day} · {block.start}–{block.end} · {block.label}</div>
      <div style={{ display: "flex", gap: 12 }}><Pencil size={14} color="var(--text3)" style={{ cursor: "pointer" }} onClick={onEdit} /><Trash2 size={14} color="var(--text3)" style={{ cursor: "pointer" }} onClick={onDelete} /></div>
    </div>
  );
}

function ProtectedBlockComposer({ initial, onSave, onCancel }) {
  const [day, setDay] = useState(initial?.day || "Tue");
  const [start, setStart] = useState(initial?.start || "6:00 PM");
  const [end, setEnd] = useState(initial?.end || "7:00 PM");
  const [label, setLabel] = useState(initial?.label || "Time with the Lord");
  return (
    <div className="card composer-card">
      <div className="fb-label" style={{ marginTop: 0 }}>Day</div>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>{weekDayLabels().map((d) => <div key={d} className={`filter-chip ${day === d ? "active" : ""}`} onClick={() => setDay(d)}>{d}</div>)}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><div className="fb-label">Start</div><input className="input-line" style={{ marginTop: 0 }} value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div style={{ flex: 1 }}><div className="fb-label">End</div><input className="input-line" style={{ marginTop: 0 }} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="fb-label">Label</div>
      <input className="input-line" style={{ marginTop: 0 }} value={label} onChange={(e) => setLabel(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={() => onSave({ id: initial?.id || Date.now(), day, start, end, label })}>Save Block</div>
        <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</div>
      </div>
    </div>
  );
}

function AreaComposer({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || "#8FA88A");
  const save = () => { if (!name.trim()) return; onSave({ id: initial?.id || `area_${Date.now()}`, name: name.trim(), color }); };
  return (
    <div className="card composer-card">
      <div className="fb-label" style={{ marginTop: 0 }}>Area Name</div>
      <input className="input-line" style={{ marginTop: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home, Church, Writing" />
      <div className="fb-label">Color</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 36, border: "none", background: "transparent", cursor: "pointer" }} /><span className="chip" style={{ background: color + "26", color }}>{name || "Area"}</span></div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={save}>{initial ? "Save Area" : "Add Area"}</div><div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</div></div>
    </div>
  );
}

function SettingsScreen({
  onBack,
  theme,
  setTheme,
  protectedBlocks,
  setProtectedBlocks,
  areas,
  setAreas,
  onDeleteArea,
  onOpenCalendar,
  accountSync,
  onOpenHowAbideWorks,
  primaryNavigation = DEFAULT_PRIMARY_NAV,
  setPrimaryNavigation,
  highlightMeanings = DEFAULT_HIGHLIGHT_MEANINGS,
  setHighlightMeanings,
}) {
  const [blockComposer, setBlockComposer] = useState(null);
  const [areaComposer, setAreaComposer] = useState(null); // null | "add" | areaId
  const [highlightSettingsOpen, setHighlightSettingsOpen] = useState(false);
  const {
    available: updateAvailable,
    checking: updateChecking,
    message: updateMessage,
    checkNow: checkForUpdatesNow,
    updateNow,
  } = usePwaUpdateStatus();
  const saveBlock = (b) => { setProtectedBlocks((prev) => prev.some((x) => x.id === b.id) ? prev.map((x) => x.id === b.id ? b : x) : [...prev, b]); setBlockComposer(null); };
  const deleteBlock = (id) => setProtectedBlocks((prev) => prev.filter((b) => b.id !== id));
  const saveArea = ({ id, name, color }) => { setAreas((prev) => ({ ...prev, [id]: { name, color } })); setAreaComposer(null); };

  const safePrimaryNavigation = normalizePrimaryNav(primaryNavigation);

  const updatePrimaryNavigationSlot = (index, destinationId) => {
    if (!setPrimaryNavigation) return;

    const next = [...safePrimaryNavigation];

    if (
      next.some(
        (id, existingIndex) =>
          existingIndex !== index && id === destinationId
      )
    ) {
      return;
    }

    next[index] = destinationId;
    setPrimaryNavigation(normalizePrimaryNav(next));
  };

  const restoreDefaultNavigation = () => {
    setPrimaryNavigation?.([...DEFAULT_PRIMARY_NAV]);
  };

  return (
    <>
      <Header eyebrow="Insights" title="Settings" onBack={onBack} />
      <div className="scroll">
        <div className="section-label">Appearance</div>
        <div className="segmented"><div className={`seg-btn ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}>Light</div><div className={`seg-btn ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}>Dark</div></div>

        <div className="section-label">Journal & Highlights</div>

        <div className="card">
          <div
            className="nav-row"
            onClick={() => setHighlightSettingsOpen(true)}
          >
            <div className="nav-row-left">
              <div
                className="nav-icon"
                style={{ background: "#E8B45C22" }}
              >
                <SettingsIcon size={16} color="#E8B45C" />
              </div>

              <div>
                <div
                  style={{
                    fontWeight: 650,
                    color: "var(--text)",
                    fontSize: 13.5,
                  }}
                >
                  Highlight Meanings
                </div>

                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text3)",
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}
                >
                  Decide what each journal highlight color means to you.
                </div>
              </div>
            </div>

            <ChevronRight size={16} color="var(--text3)" />
          </div>
        </div>

        {highlightSettingsOpen && setHighlightMeanings && (
          <HighlightSettingsEditor
            meanings={highlightMeanings}
            setMeanings={setHighlightMeanings}
            onClose={() => setHighlightSettingsOpen(false)}
          />
        )}

        <div
          className="section-label"
          style={{ alignItems: "center" }}
        >
          <span>Customize Navigation</span>
          <div
            onClick={restoreDefaultNavigation}
            style={{
              color: "#E8B45C",
              fontSize: 10.5,
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            Restore Default
          </div>
        </div>

        <div className="card" style={{ padding: "4px 14px" }}>
          <div
            style={{
              padding: "11px 2px 10px",
              fontSize: 11.5,
              lineHeight: 1.45,
              color: "var(--text3)",
              borderBottom: "1px solid var(--divider)",
            }}
          >
            Today and More stay fixed. Choose what belongs in the three
            middle positions.
          </div>

          {safePrimaryNavigation.map((selectedId, index) => {
            const selectedDestination =
              PRIMARY_NAV_DESTINATIONS.find(
                (destination) => destination.id === selectedId
              ) || PRIMARY_NAV_DESTINATIONS[0];

            const SelectedIcon = selectedDestination.icon;

            return (
              <div
                key={index}
                style={{
                  minHeight: 58,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "9px 2px",
                  borderBottom:
                    index === 2
                      ? "none"
                      : "1px solid var(--divider)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--pillBg)",
                      border: "1px solid var(--pillBorder)",
                      flexShrink: 0,
                    }}
                  >
                    <SelectedIcon size={14} color="#E8B45C" />
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--text3)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: .45,
                      }}
                    >
                      Position {index + 2}
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--text)",
                        fontWeight: 650,
                        marginTop: 2,
                      }}
                    >
                      {selectedDestination.label}
                    </div>
                  </div>
                </div>

                <select
                  value={selectedId}
                  onChange={(event) =>
                    updatePrimaryNavigationSlot(
                      index,
                      event.target.value
                    )
                  }
                  style={{
                    maxWidth: 145,
                    minWidth: 120,
                    border: "1px solid var(--inputBorder)",
                    background: "var(--inputBg)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "8px 9px",
                    font: "inherit",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  {PRIMARY_NAV_DESTINATIONS.map((destination) => {
                    const usedElsewhere =
                      safePrimaryNavigation.some(
                        (id, existingIndex) =>
                          existingIndex !== index &&
                          id === destination.id
                      );

                    return (
                      <option
                        key={destination.id}
                        value={destination.id}
                        disabled={usedElsewhere}
                      >
                        {destination.label}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.45,
            color: "var(--text3)",
            margin: "7px 4px 0",
          }}
        >
          Anything you remove from the tab bar remains available from More.
        </div>

        <div className="section-label"><span>Areas</span><Plus size={14} color="#E8B45C" style={{ cursor: "pointer" }} onClick={() => setAreaComposer(areaComposer === "add" ? null : "add")} /></div>
        {areaComposer === "add" && <AreaComposer onSave={saveArea} onCancel={() => setAreaComposer(null)} />}
        <div
          className="card"
          style={{
            padding: Object.keys(areas).length ? "4px 14px" : undefined,
          }}
        >
          {Object.entries(areas).map(([id, area]) =>
            areaComposer === id ? (
              <AreaComposer
                key={id}
                initial={{ id, ...area }}
                onSave={saveArea}
                onCancel={() => setAreaComposer(null)}
              />
            ) : (
              <div
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent(
                      "abide:open-area",
                      {
                        detail: {
                          areaId: id,
                        },
                      }
                    )
                  );
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();

                    window.dispatchEvent(
                      new CustomEvent(
                        "abide:open-area",
                        {
                          detail: {
                            areaId: id,
                          },
                        }
                      )
                    );
                  }
                }}
                style={{
                  cursor: "pointer",
                  minHeight: 52,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "10px 2px",
                  borderBottom: "1px solid var(--divider)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: area.color,
                      boxShadow: `0 0 0 4px ${area.color}18`,
                      flexShrink: 0,
                    }}
                  />

                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 650,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {area.name}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <div
                    onClick={(event) => {
                      event.stopPropagation();
                      setAreaComposer(id);
                    }}
                    aria-label={`Edit ${area.name}`}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--pillBg)",
                      border: "1px solid var(--pillBorder)",
                      cursor: "pointer",
                    }}
                  >
                    <Pencil size={13} color="var(--text2)" />
                  </div>

                  <div
                    onClick={(event) => {
                      event.stopPropagation();

                      if (
                        window.confirm(
                          `Delete the "${area.name}" area? Tasks and goals using it will become unassigned.`
                        )
                      ) {
                        onDeleteArea(id);
                      }
                    }}
                    aria-label={`Delete ${area.name}`}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(230,128,128,.08)",
                      border: "1px solid rgba(230,128,128,.15)",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} color="#E68080" />
                  </div>
                </div>
              </div>
            )
          )}

          {Object.keys(areas).length === 0 && (
            <div className="insight-line">
              No areas yet. Add one with the + button.
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.45,
            color: "var(--text3)",
            margin: "7px 4px 0",
          }}
        >
          Areas organize responsibilities without becoming another task list.
          Editing an Area keeps its existing tasks and goals connected.
        </div>

        <div className="section-label"><span>Protected Time Blocks</span><Plus size={14} color="#E8B45C" style={{ cursor: "pointer" }} onClick={() => setBlockComposer(blockComposer === "add" ? null : "add")} /></div>
        {blockComposer === "add" && <ProtectedBlockComposer onSave={saveBlock} onCancel={() => setBlockComposer(null)} />}
        <div className="card">{protectedBlocks.length ? protectedBlocks.map((b) => blockComposer === b.id ? <ProtectedBlockComposer key={b.id} initial={b} onSave={saveBlock} onCancel={() => setBlockComposer(null)} /> : <ProtectedBlockRow key={b.id} block={b} onEdit={() => setBlockComposer(b.id)} onDelete={() => deleteBlock(b.id)} />) : <div className="insight-line">No protected time blocks yet.</div>}</div>

        <div className="section-label">Connected Calendars</div>
        <div className="card"><div className="nav-row" onClick={onOpenCalendar}><div className="nav-row-left"><CalendarDays size={16} color="#8FA88A" />Manage calendars in Calendar</div><ChevronRight size={16} color="var(--text3)" /></div></div>

        
        {/* ABIDE WEEK SETTINGS V1 */}
        <div className="section-label">
          Calendar & Week
        </div>

        <WeekStartSetting />


        {/* ABIDE EXPORT SETTINGS V1 */}
        <div className="section-label">
          Data & Backup
        </div>

        <div className="card">
          <div
            className="nav-row"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(
                  "abide:open-export-center"
                )
              )
            }
          >
            

            <ChevronRight
              size={16}
              color="var(--text3)"
            />
          </div>
        </div>

<div className="section-label">Abide</div>

        <div
          className="card"
          style={{
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <img
              src="/abide-logo.png"
              alt=""
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                boxShadow: "0 4px 12px rgba(0,0,0,.12)",
                flexShrink: 0,
              }}
            />

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 750,
                  color: "var(--text)",
                  letterSpacing: "-.1px",
                }}
              >
                Abide
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "3px 8px",
                  marginTop: 3,
                  fontSize: 11.5,
                  color: "var(--text3)",
                  lineHeight: 1.4,
                }}
              >
                <span>Version {APP_VERSION}</span>
                <span style={{ opacity: .55 }}>·</span>
                <span>
                  Updated{" "}
                  {new Date(APP_BUILD_DATE).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 15,
              padding: 12,
              borderRadius: 12,
              background: "var(--subtleBg)",
              border: "1px solid var(--divider)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                minWidth: 0,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 29,
                  height: 29,
                  borderRadius: 9,
                  background: updateAvailable
                    ? "rgba(232,180,92,.14)"
                    : "var(--pillBg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <RefreshCw
                  size={13}
                  color={updateAvailable ? "#E8B45C" : "var(--text2)"}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  {updateAvailable ? "Update ready" : "App updates"}
                </div>

                <div
                  style={{
                    fontSize: 11.25,
                    color: "var(--text3)",
                    lineHeight: 1.45,
                    marginTop: 2,
                  }}
                >
                  {updateAvailable
                    ? "A newer version of Abide is ready to install."
                    : updateMessage ||
                      "Updates install here without removing the Home Screen app."}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={updateAvailable ? updateNow : checkForUpdatesNow}
              disabled={updateChecking}
              style={{
                border: updateAvailable
                  ? "1px solid #E8B45C"
                  : "1px solid var(--pillBorder)",
                background: updateAvailable
                  ? "#E8B45C"
                  : "var(--pillBg)",
                color: updateAvailable
                  ? "#14100A"
                  : "var(--text2)",
                borderRadius: 10,
                padding: "7px 10px",
                font: "inherit",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: updateChecking ? "default" : "pointer",
                opacity: updateChecking ? .6 : 1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {updateAvailable
                ? "Update"
                : updateChecking
                  ? "Checking…"
                  : "Check"}
            </button>
          </div>
        </div>

        <div className="section-label">Learn Abide</div>
        <div className="card">
          <div className="nav-row" onClick={onOpenHowAbideWorks}>
            <div className="nav-row-left">
              <BookOpen size={16} color="#E8B45C" />
              <div>
                <div style={{ fontWeight: 650, color: "var(--text)", fontSize: 13.5 }}>How Abide Works</div>
                <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2, lineHeight: 1.4 }}>A guided tour of Abide’s purpose and rhythm</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text3)" />
          </div>
        </div>

        <div className="section-label">Account & Sync</div>

        <div
          className="card"
          style={{
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                Abide account
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text3)",
                  marginTop: 4,
                  overflowWrap: "anywhere",
                  lineHeight: 1.45,
                }}
              >
                {accountSync?.email || "Signed in"}
              </div>
            </div>

            <div
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                background: accountSync?.syncError
                  ? "rgba(230,128,128,.10)"
                  : "rgba(143,168,138,.12)",
                border: accountSync?.syncError
                  ? "1px solid rgba(230,128,128,.20)"
                  : "1px solid rgba(143,168,138,.22)",
                color: accountSync?.syncError ? "#E68080" : "#789873",
                fontSize: 10.5,
                fontWeight: 750,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {accountSync?.syncError ? "Sync issue" : "Synced"}
            </div>
          </div>

          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "var(--text3)",
              marginTop: 12,
            }}
          >
            Your Abide data is private to this account and stays synced across
            your signed-in devices.
          </div>

          {accountSync?.syncError && (
            <div
              style={{
                marginTop: 12,
                padding: 11,
                borderRadius: 10,
                background: "rgba(230,128,128,.07)",
                border: "1px solid rgba(230,128,128,.14)",
                fontSize: 11.5,
                lineHeight: 1.45,
                color: "#E68080",
              }}
            >
              {accountSync.syncError}
            </div>
          )}

          <div
            style={{
              height: 1,
              background: "var(--divider)",
              margin: "15px 0 13px",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: "var(--text2)",
                }}
              >
                Finished on this device?
              </div>

              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: "var(--text3)",
                  marginTop: 2,
                }}
              >
                Signing out does not delete your Abide data.
              </div>
            </div>

            <div
              onClick={() => accountSync?.signOut?.()}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(230,128,128,.20)",
                background: "rgba(230,128,128,.08)",
                color: "#E68080",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Sign Out
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


const WEEKLY_REVIEW_BLUEPRINT = [
  {
    phase: "Clear",
    title: "Clear what actually needs a decision",
    copy: "Deal with the loose edges, not everything in the system. The goal is a trusted list, not a perfect one.",
    checks: [
      "Resolve the overdue or stale items that still matter",
      "Clarify uncategorized captures or loose ends that need a next action",
    ],
    noteLabel: "Anything I need to decide before moving on?",
    shortcut: "today",
    shortcutLabel: "Open Today",
  },
  {
    phase: "Get Current",
    title: "Look at what is already true",
    copy: "Scan the near-term calendar and active outcomes. Only stop where reality requires an adjustment.",
    checks: [
      "Scan the coming week for commitments, preparation, or follow-up",
      "Check active goals for anything stalled or missing a real next action",
    ],
    noteLabel: "What needs to change because reality changed?",
    shortcut: "calendar",
    shortcutLabel: "Open Calendar",
  },
  {
    phase: "Choose",
    title: "Choose a small, meaningful week",
    copy: "Name the few outcomes worth protecting. Three is a ceiling, not a quota.",
    checks: [
      "Choose up to seven outcomes that would make this week meaningful",
      "Make sure each chosen outcome has a concrete next action",
    ],
    noteLabel: "What matters most this week?",
    focusLabel: "Up to three weekly outcomes",
    shortcut: "goals",
    shortcutLabel: "Open Goals & Horizons",
  },
  {
    phase: "Protect",
    title: "Protect an unhurried pace",
    copy: "Finish by making room. A trustworthy week includes margin, rest, and explicit limits.",
    checks: [
      "Notice anything that should be deferred, delegated, simplified, or declined",
      "Protect the rhythms, relationships, rest, and margin that should not be crowded out",
    ],
    noteLabel: "What am I protecting or intentionally not doing?",
    complete: true,
  },
];

const MONTHLY_REVIEW_BLUEPRINT = [
  {
    phase: "Clear",
    title: "Clear stale commitments first",
    copy: "Start by removing drag. Resolve what should not quietly follow you into another month.",
    checks: [
      "Resolve overdue, stale, or ambiguous commitments that still matter",
      "Drop, defer, delegate, or clarify anything that no longer belongs as-is",
    ],
    noteLabel: "What needs a decision before I plan the month?",
    shortcut: "today",
    shortcutLabel: "Open Today",
  },
  {
    phase: "Survey",
    title: "Survey the next four to six weeks",
    copy: "The calendar is the hard landscape. Start with what is already true before choosing anything new.",
    checks: [
      "Scan deadlines, travel, events, preparation needs, and unusually demanding weeks",
      "Notice where recovery time, buffer, or advance preparation needs to exist",
    ],
    noteLabel: "What is already true about the month ahead?",
    shortcut: "calendar",
    shortcutLabel: "Open Calendar",
  },
  {
    phase: "Attend",
    title: "Notice what needs attention",
    copy: "Look across Areas and active goals so the month is not shaped only by whichever deadline is loudest.",
    checks: [
      "Notice any Area that is being neglected or demanding disproportionate energy",
      "Notice active goals that are stalled or missing a concrete next action",
    ],
    noteLabel: "Where does life need appropriate attention?",
    shortcut: "goals",
    shortcutLabel: "Open Goals & Horizons",
  },
  {
    phase: "Choose",
    title: "Choose the month's few meaningful outcomes",
    copy: "Choose no more than three directional outcomes. They should fit the season and the capacity you actually have.",
    checks: [
      "Choose up to seven outcomes that would make this month meaningful",
      "Make sure each outcome has a real next action in Abide",
    ],
    noteLabel: "What would make this month meaningful and well-lived?",
    focusLabel: "Up to three monthly outcomes",
  },
  {
    phase: "Protect",
    title: "Subtract before adding more",
    copy: "An unhurried month is built as much by what you refuse as by what you organize.",
    checks: [
      "Name at least one thing to stop, pause, simplify, delegate, or decline",
      "Protect important rhythms, relationships, rest, and unscheduled margin",
    ],
    noteLabel: "What am I intentionally making room for?",
    complete: true,
  },
];

function ReviewTab({ tasks, goals, protectedBlocks, areas, onOpen, onOpenAdd, onCreateTask, onUpdateTask, onDeleteTask, onCreateArea }) {
  const [cadence, setCadence] = usePersistentState("abide-review-cadence", "weekly");

  /* ABIDE FLEXIBLE WEEKLY REVIEW V2 */
  const weekStart =
    useAbideWeekStart();

  const [
    reviewPlanStartOverride,
    setReviewPlanStartOverride,
  ] = useState("");

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

  const overdueTasks = tasks
    .filter((t) => !t.done && taskDateKey(t) < REFERENCE_DATE_KEY)
    .sort((a, b) => taskDateKey(a).localeCompare(taskDateKey(b)));

  const unassignedTasks = tasks
    .filter((t) => !t.done && !t.area)
    .sort((a, b) => taskDateKey(a).localeCompare(taskDateKey(b)));

  const somedayTasks = tasks.filter(
    (t) => !t.done && t.status === "someday"
  );

  const goalsWithoutNextAction = goals.filter((goal) => {
    return !tasks.some((task) => {
      if (task.done) return false;

      const taskGoalId = task.goal ?? task.goalId ?? null;
      return String(taskGoalId || "") === String(goal.id);
    });
  });

  const reviewAttentionTasks = [
    ...overdueTasks.slice(0, 3),
    ...unassignedTasks
      .filter(
        (task) =>
          !overdueTasks.some(
            (overdueTask) => String(overdueTask.id) === String(task.id)
          )
      )
      .slice(0, 2),
  ].slice(0, 4);

  const officialWeekKeys =
    buildWeekKeys(
      REFERENCE_DATE_KEY,
      weekStart
    );

  const officialWeekStart =
    officialWeekKeys[0];

  const todayWeekIndex =
    officialWeekKeys.indexOf(
      REFERENCE_DATE_KEY
    );

  const automaticReviewStart =
    todayWeekIndex === 6
      ? shiftDateKey(
          officialWeekStart,
          7
        )
      : REFERENCE_DATE_KEY;

  const reviewPlanningStart =
    reviewPlanStartOverride ||
    automaticReviewStart;

  const planningOfficialWeek =
    buildWeekKeys(
      reviewPlanningStart,
      weekStart
    );

  const reviewPlanningEnd =
    planningOfficialWeek[
      planningOfficialWeek.length - 1
    ];

  const weekKeys =
    Array.from(
      { length: 7 },
      (_, index) =>
        shiftDateKey(
          reviewPlanningStart,
          index
        )
    ).filter(
      (key) =>
        key <= reviewPlanningEnd
    );

  const weekEnd =
    reviewPlanningEnd;

  const reviewTimingLabel =
    !reviewPlanStartOverride &&
    todayWeekIndex === 6
      ? "Reviewing early · preparing the upcoming week"
      : reviewPlanningStart === officialWeekStart
        ? "Full week"
        : reviewPlanningStart === REFERENCE_DATE_KEY
          ? (
              todayWeekIndex === 0
                ? "Starting the week"
                : "Starting from today"
            )
          : "Custom planning window";

  const nextMonthDate = new Date(dateFromKey(REFERENCE_DATE_KEY));
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1, 1);

  const monthLabel = nextMonthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const reviewReferenceDate = dateFromKey(REFERENCE_DATE_KEY);

  const weeklyStart = new Date(reviewReferenceDate);
  const mondayOffset = (weeklyStart.getDay() + 6) % 7;
  weeklyStart.setDate(weeklyStart.getDate() - mondayOffset);

  const weeklyEnd = new Date(weeklyStart);
  weeklyEnd.setDate(weeklyEnd.getDate() + 6);

  const weeklyStartLabel = weeklyStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const weeklyEndLabel =
    weeklyStart.getMonth() === weeklyEnd.getMonth()
      ? weeklyEnd.toLocaleDateString("en-US", {
          day: "numeric",
        })
      : weeklyEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

  const periodLabel =
    cadence === "weekly"
      ? `This Week · ${weeklyStartLabel}–${weeklyEndLabel}`
      : reviewReferenceDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

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
      planningStart:
        cadence === "weekly"
          ? reviewPlanningStart
          : null,
      planningEnd:
        cadence === "weekly"
          ? reviewPlanningEnd
          : null,
      weekStart:
        cadence === "weekly"
          ? weekStart
          : null,
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
          <div className="review-hero-copy">{cadence === "weekly" ? "Get clear, get current, and plan faithfully from where you are now. Review can happen early, on time, or late without losing the shape of your week." : "Use last month only as information. Clear the system, survey the next 4–6 weeks, choose a few outcomes, create their next actions, and protect the rhythms and margin that make the month livable."}</div>
          {/* ABIDE REVIEW PLANNING WINDOW UI V2 */}
          {cadence === "weekly" && (
            <div
              style={{
                marginTop: 14,
                marginBottom: 13,
                padding: 12,
                borderRadius: 12,
                background: "var(--subtleBg)",
                border: "1px solid var(--divider)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11.75,
                      fontWeight: 750,
                      color: "var(--text)",
                    }}
                  >
                    Planning window
                  </div>

                  <div
                    style={{
                      fontSize: 10.25,
                      color: "#8FA88A",
                      marginTop: 2,
                    }}
                  >
                    {reviewTimingLabel}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--text3)",
                    textAlign: "right",
                  }}
                >
                  {weekStart === "sunday"
                    ? "Sunday → Saturday"
                    : "Monday → Sunday"}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  marginTop: 10,
                  alignItems: "center",
                }}
              >
                <input
                  type="date"
                  className="input-line"
                  style={{ margin: 0 }}
                  value={reviewPlanningStart}
                  onChange={(event) =>
                    setReviewPlanStartOverride(
                      event.target.value
                    )
                  }
                  aria-label="Start planning from"
                />

                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--text3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  through{" "}
                  {formatDateLabel(
                    reviewPlanningEnd
                  )}
                </div>
              </div>

              <div
                className="filter-row"
                style={{
                  padding: "9px 0 0",
                  overflowX: "visible",
                  flexWrap: "wrap",
                }}
              >
                <div
                  className={`filter-chip ${
                    !reviewPlanStartOverride
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setReviewPlanStartOverride("")
                  }
                >
                  Auto
                </div>

                <div
                  className="filter-chip"
                  onClick={() =>
                    setReviewPlanStartOverride(
                      officialWeekStart
                    )
                  }
                >
                  Full Week
                </div>

                <div
                  className="filter-chip"
                  onClick={() =>
                    setReviewPlanStartOverride(
                      REFERENCE_DATE_KEY
                    )
                  }
                >
                  Start Today
                </div>

                <div
                  className="filter-chip"
                  onClick={() =>
                    setReviewPlanStartOverride(
                      shiftDateKey(
                        officialWeekStart,
                        7
                      )
                    )
                  }
                >
                  Next Week
                </div>
              </div>

              <div
                style={{
                  fontSize: 10.25,
                  lineHeight: 1.45,
                  color: "var(--text3)",
                  marginTop: 8,
                }}
              >
                Your official week still follows Settings.
                Review can begin early, on time, late,
                or from a custom date.
              </div>
            </div>
          )}

          <div className="review-progress"><div className="review-progress-fill" style={{ width: `${progress}%` }} /></div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>{progress}% checked · step {stepIndex + 1} of {blueprint.length}</div>
        </div>

        <div className="section-label">Needs Attention</div>

        <div className="card" style={{ marginBottom: 14 }}>
          {reviewAttentionTasks.length === 0 &&
          goalsWithoutNextAction.length === 0 ? (
            <div className="insight-line">
              Nothing obvious needs intervention right now. Keep the review light.
            </div>
          ) : (
            <>
              {reviewAttentionTasks.map((task) => {
                const isOverdue =
                  taskDateKey(task) < REFERENCE_DATE_KEY;

                return (
                  <div
                    key={task.id}
                    className="nav-row"
                    style={{ cursor: "pointer" }}
                    onClick={() => setEditingTask(task)}
                  >
                    <div
                      className="nav-row-left"
                      style={{ minWidth: 0, alignItems: "flex-start" }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          marginTop: 5,
                          borderRadius: 999,
                          background: isOverdue ? "#E68080" : "#E8B45C",
                          flexShrink: 0,
                        }}
                      />

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 650,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {task.title}
                        </div>

                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--text3)",
                            marginTop: 2,
                          }}
                        >
                          {isOverdue
                            ? `Overdue · ${formatDateLabel(taskDateKey(task))}`
                            : "Needs an Area"}
                        </div>
                      </div>
                    </div>

                    <ChevronRight size={15} color="var(--text3)" />
                  </div>
                );
              })}

              {goalsWithoutNextAction.slice(0, 2).map((goal) => (
                <div
                  key={`goal-${goal.id}`}
                  className="nav-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpen("goals")}
                >
                  <div
                    className="nav-row-left"
                    style={{ minWidth: 0, alignItems: "flex-start" }}
                  >
                    <Target
                      size={14}
                      color="#7C93C9"
                      style={{ marginTop: 1, flexShrink: 0 }}
                    />

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 650,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {goal.name || goal.title || "Untitled goal"}
                      </div>

                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text3)",
                          marginTop: 2,
                        }}
                      >
                        No open next action
                      </div>
                    </div>
                  </div>

                  <ChevronRight size={15} color="var(--text3)" />
                </div>
              ))}
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            margin: "-5px 0 15px",
          }}
        >
          {overdueTasks.length > 0 && (
            <div className="filter-chip">
              {overdueTasks.length} overdue
            </div>
          )}

          {unassignedTasks.length > 0 && (
            <div className="filter-chip">
              {unassignedTasks.length} without an Area
            </div>
          )}

          {goalsWithoutNextAction.length > 0 && (
            <div className="filter-chip">
              {goalsWithoutNextAction.length} goal
              {goalsWithoutNextAction.length === 1 ? "" : "s"} without a next action
            </div>
          )}

          {somedayTasks.length > 0 && (
            <div className="filter-chip">
              {somedayTasks.length} Someday / Maybe
            </div>
          )}
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

function MoreTab({
  onOpen,
  theme,
  setTheme,
  protectedBlocks,
  setProtectedBlocks,
  areas,
  setAreas,
  onDeleteArea,
  onOpenCalendar,
  accountSync,
  onOpenHowAbideWorks,
  primaryNavigation,
  setPrimaryNavigation,
  highlightMeanings,
  setHighlightMeanings,
}) {
  const [screen, setScreen] = useState("more");

  if (screen === "settings") {
    return (
      <SettingsScreen
        onBack={() => setScreen("more")}
        theme={theme}
        setTheme={setTheme}
        protectedBlocks={protectedBlocks}
        setProtectedBlocks={setProtectedBlocks}
        areas={areas}
        setAreas={setAreas}
        onDeleteArea={onDeleteArea}
        onOpenCalendar={onOpenCalendar}
        accountSync={accountSync}
        onOpenHowAbideWorks={onOpenHowAbideWorks}
        primaryNavigation={primaryNavigation}
        setPrimaryNavigation={setPrimaryNavigation}
        highlightMeanings={highlightMeanings}
        setHighlightMeanings={setHighlightMeanings}
      />
    );
  }

  const cards = [
    { id: "calendar", label: "Calendar", copy: "Events, protected time, and connected calendars", icon: CalendarDays, tint: "#8FA88A" },
    { id: "review", label: "Review", copy: "A short weekly reset and monthly preparation", icon: RefreshCw, tint: "#E8B45C" },
    { id: "journal", label: "Journal", copy: "Time with the Lord and reflection history", icon: BookOpen, tint: "#A98BE0" },
    { id: "goals", label: "Goals", copy: "Projects, outcomes, and higher horizons", icon: Target, tint: "#7C93C9" },
    { id: "scratch", label: "Notes", copy: "Thinking space that does not become a task list", icon: PenTool, tint: "#D98595" },
    { id: "reminders", label: "Reminders", copy: "Upcoming alerts and notification controls", icon: Bell, tint: "#E8B45C" },
    { id: "insights", label: "Insights", copy: "Patterns and history, not another scoreboard", icon: BarChart3, tint: "#8FA88A" },
    { id: "export-center", label: "Export Center", copy: "Reports, exports, backups, and custom data views", icon: Download, tint: "#E8B45C" },
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
              <div
                className="card more-card"
                key={item.id}
                onClick={() => {
                  if (item.id === "export-center") {
                    window.dispatchEvent(
                      new Event("abide:open-export-center")
                    );
                    return;
                  }

                  onOpen(item.id);
                }}
              >
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


function InsightsTab({
  theme,
  setTheme,
  protectedBlocks,
  setProtectedBlocks,
  areas,
  setAreas,
  onDeleteArea,
  tasks,
  goals,
  journalEntries,
  setJournalEntries,
  onOpenJournal,
  onOpenCalendar,
  accountSync,
  onOpenHowAbideWorks,
  primaryNavigation,
  setPrimaryNavigation,
  highlightMeanings,
  setHighlightMeanings,
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [screen, setScreen] = useState("dashboard");
  const [selectedHeatDate, setSelectedHeatDate] = useState(REFERENCE_DATE_KEY);

  if (screen === "notifications") return <NotificationCenter onBack={() => setScreen("dashboard")} tasks={tasks} />;
  if (screen === "settings") {
    return (
      <SettingsScreen
        onBack={() => setScreen("dashboard")}
        theme={theme}
        setTheme={setTheme}
        protectedBlocks={protectedBlocks}
        setProtectedBlocks={setProtectedBlocks}
        areas={areas}
        setAreas={setAreas}
        onDeleteArea={onDeleteArea}
        onOpenCalendar={onOpenCalendar}
        accountSync={accountSync}
        onOpenHowAbideWorks={onOpenHowAbideWorks}
        primaryNavigation={primaryNavigation}
        setPrimaryNavigation={setPrimaryNavigation}
        highlightMeanings={highlightMeanings}
        setHighlightMeanings={setHighlightMeanings}
      />
    );
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const completionRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const openCount = tasks.filter((t) => !t.done).length;
  const streak = journalStreak(journalEntries);
  const overdueCount = tasks.filter((t) => !t.done && taskDateKey(t) < REFERENCE_DATE_KEY).length;
  const unassignedCount = tasks.filter((t) => !t.area).length;
  const stalledGoals = goals.filter((g) => !g.progress).length;

  const weekKeys = buildPreferenceWeekKeys(REFERENCE_DATE_KEY);
  const weekBars = weekKeys.map((key) => ({ d: dateFromKey(key).toLocaleDateString("en-US", { weekday: "narrow" }), done: tasks.filter((t) => t.done && taskDateKey(t) === key).length }));
  const areaSplit = Object.entries(areas).map(([id, area]) => ({ name: area.name, value: tasks.filter((t) => t.area === id).length, color: area.color })).filter((a) => a.value > 0);
  const heatKeys = lastNDateKeys(30);
  const entriesFor = (key) => journalEntries.filter((e) => (e.dateKey || e.date) === key);
  const selectedEntries = entriesFor(selectedHeatDate);

  const toggleHeatDate = (key) => {
    setSelectedHeatDate(key);
    const entries = entriesFor(key);
    const written = entries.some((e) => (e.note || "").trim() || (e.ref || "").trim());
    if (written) return;
    if (entries.length) setJournalEntries((prev) => prev.filter((e) => (e.dateKey || e.date) !== key));
    else setJournalEntries((prev) => [{ id: Date.now(), dateKey: key, date: formatDateLabel(key), ref: "", note: "", tag: "yellow" }, ...prev]);
  };

  return (
    <>
      <Header eyebrow="Live from your Abide data" title="Insights" />
      <div className="scroll">
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-num">{completionRate}%</div><div className="stat-label">Task completion rate</div></div>
          <div className="stat-card"><div className="stat-num" style={{ display: "flex", alignItems: "center", gap: 5 }}>{streak}<Flame size={16} color="#E8B45C" /></div><div className="stat-label">Journal streak (days)</div></div>
          <div className="stat-card"><div className="stat-num">{openCount}</div><div className="stat-label">Open tasks</div></div>
          <div className="stat-card"><div className="stat-num">{goals.length}</div><div className="stat-label">Active goals</div></div>
        </div>

        <div className="section-label" onClick={() => setReviewOpen(!reviewOpen)} style={{ cursor: "pointer" }}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={12} />Weekly Review (GTD)</span>{reviewOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
        {reviewOpen && <div className="card"><div className="review-item"><span>Overdue items to reschedule</span><span className="review-count">{overdueCount}</span></div><div className="review-item"><span>Tasks with no Area</span><span className="review-count">{unassignedCount}</span></div><div className="review-item"><span>Someday / Maybe to revisit</span><span className="review-count">{tasks.filter((t) => t.status === "someday").length}</span></div><div className="review-item"><span>Goals with no progress yet</span><span className="review-count">{stalledGoals}</span></div></div>}

        <div className="section-label">Completed Tasks by Due Date — This Week</div>
        <div className="card" style={{ padding: "14px 6px" }}>
          {tasks.length ? <ResponsiveContainer width="100%" height={130}><BarChart data={weekBars}><XAxis dataKey="d" tick={{ fill: "#8E97A8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: theme === "dark" ? "#1C2333" : "#fff", border: "none", borderRadius: 8, fontSize: 12 }} /><Bar dataKey="done" fill="#E8B45C" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="insight-line">Add and complete tasks to populate this chart.</div>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>Source: your Abide task list. Until completion timestamps are stored in Firestore, this groups completed tasks by their due date.</div>

        <div className="section-label">Tasks by Area</div>
        <div className="card" style={{ padding: 14 }}>
          {areaSplit.length ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}><ResponsiveContainer width={120} height={120}><PieChart><Pie data={areaSplit} dataKey="value" innerRadius={32} outerRadius={55} paddingAngle={3}>{areaSplit.map((a, i) => <Cell key={i} fill={a.color} stroke="none" />)}</Pie></PieChart></ResponsiveContainer><div style={{ flex: 1 }}>{areaSplit.map((a, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--body)", marginBottom: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: a.color }} />{a.name} · {a.value}</div>)}</div></div> : <div className="insight-line">No task data yet.</div>}
        </div>

        <div className="section-label">Time with the Lord — 30 Days</div>
        <div className="card" style={{ padding: 14 }}>
          <div className="heat-row">{heatKeys.map((key) => { const active = entriesFor(key).length > 0; return <div key={key} className="heat-cell" title={`${formatDateLabel(key)} · ${active ? "journal activity" : "no entry"}`} onClick={() => toggleHeatDate(key)} style={{ cursor: "pointer", background: active ? "rgba(232,180,92,0.82)" : "var(--emptyHeat)", outline: selectedHeatDate === key ? "2px solid #E8B45C" : "none", outlineOffset: 1 }} />; })}</div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>Source: Time with the Lord journal entries. Tap an empty day to add a simple check-in; tap a simple check-in again to remove it. Written journal entries are protected from being deleted here.</div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 12.5, color: "var(--body)" }}>{formatDateLabel(selectedHeatDate)} · {selectedEntries.length ? `${selectedEntries.length} journal item${selectedEntries.length === 1 ? "" : "s"}` : "No journal activity"}</span>{selectedEntries.some((e) => (e.note || "").trim() || (e.ref || "").trim()) && <div className="filter-chip" onClick={onOpenJournal}>Edit in Journal</div>}</div>
        </div>

        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={12} />Pattern Noticed</div>
        <div className="card insight-line" style={{ marginBottom: 14, padding: 14 }}>{tasks.length >= 10 ? "As you build real task history, Abide will use completion timestamps to surface patterns here." : "No pattern generated yet. This section will stay empty until there is enough real task history to support a useful observation."}</div>

        <div className="section-label">More</div>
        <div className="card"><div className="nav-row" onClick={() => setScreen("notifications")}><div className="nav-row-left"><div className="nav-icon" style={{ background: "#E8B45C22" }}><Bell size={16} color="#E8B45C" /></div>Notification Center</div><ChevronRight size={16} color="var(--text3)" /></div>
<div className="nav-row" onClick={() => setScreen("settings")}><div className="nav-row-left"><div className="nav-icon" style={{ background: "#8FA88A22" }}><SettingsIcon size={16} color="#8FA88A" /></div>Settings</div><ChevronRight size={16} color="var(--text3)" /></div></div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   ROOT APP
----------------------------------------------------------------*/

/* =========================================================
   ABIDE WEEK START V1
   ========================================================= */

function getAbideWeekStart() {
  try {
    const raw = window.localStorage.getItem("abide-week-start");

    if (!raw) return "sunday";

    try {
      const parsed = JSON.parse(raw);
      return parsed === "monday" ? "monday" : "sunday";
    } catch {
      return raw === "monday" ? "monday" : "sunday";
    }
  } catch {
    return "sunday";
  }
}


/* ABIDE LIVE WEEK SYSTEM V3 */
function setAbideWeekStart(nextWeekStart) {
  const normalized =
    nextWeekStart === "monday"
      ? "monday"
      : "sunday";

  try {
    window.localStorage.setItem(
      "abide-week-start",
      JSON.stringify(normalized)
    );
  } catch {}

  window.dispatchEvent(
    new CustomEvent(
      "abide:week-start-change",
      {
        detail: {
          weekStart: normalized,
        },
      }
    )
  );
}


function useAbideWeekStart() {
  const [weekStart, setWeekStartState] =
    useState(() => getAbideWeekStart());

  useEffect(() => {
    const refresh = () => {
      setWeekStartState(
        getAbideWeekStart()
      );
    };

    const handleCustom = (event) => {
      const next =
        event?.detail?.weekStart;

      setWeekStartState(
        next === "monday"
          ? "monday"
          : "sunday"
      );
    };

    window.addEventListener("storage", refresh);
    window.addEventListener(
      "abide:week-start-change",
      handleCustom
    );

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(
        "abide:week-start-change",
        handleCustom
      );
    };
  }, []);

  return weekStart;
}


function abideDateKey(date) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function buildPreferenceWeekKeys(
  anchorKey = REFERENCE_DATE_KEY
) {
  return buildWeekKeys(
    anchorKey,
    getAbideWeekStart()
  );
}


function WeekStartSetting() {
  const weekStart = useAbideWeekStart();

  return (
    <div
      className="card"
      style={{ padding: 14 }}
    >
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: "var(--text)",
        }}
      >
        Start the week on
      </div>

      <div
        style={{
          fontSize: 11.25,
          lineHeight: 1.45,
          color: "var(--text3)",
          marginTop: 4,
        }}
      >
        This changes Calendar, Weekly Review,
        weekly summaries, and every “this week”
        calculation.
      </div>

      <div
        className="segmented"
        style={{
          marginTop: 12,
          marginBottom: 0,
        }}
      >
        <div
          className={`seg-btn ${
            weekStart === "sunday"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setAbideWeekStart("sunday")
          }
        >
          Sunday
        </div>

        <div
          className={`seg-btn ${
            weekStart === "monday"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setAbideWeekStart("monday")
          }
        >
          Monday
        </div>
      </div>

      <div
        style={{
          fontSize: 10.5,
          color: "#8FA88A",
          fontWeight: 650,
          marginTop: 9,
        }}
      >
        Active week:{" "}
        {weekStart === "sunday"
          ? "Sunday → Saturday"
          : "Monday → Sunday"}
      </div>
    </div>
  );
}



/* =========================================================
   ABIDE EXPORT CENTER V4
   CSV · EXCEL · WORD · PDF · ZIP
   ========================================================= */

function abideDownload(
  filename,
  content,
  mime = "application/octet-stream"
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
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1200
  );
}


function abideCsvValue(value) {
  if (value == null) return "";

  const text =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}


function abideCsv(
  rows,
  columns
) {
  return [
    columns
      .map(
        ([key, label]) =>
          abideCsvValue(label || key)
      )
      .join(","),

    ...rows.map(
      (row) =>
        columns
          .map(
            ([key]) =>
              abideCsvValue(row?.[key])
          )
          .join(",")
    ),
  ].join("\n");
}


function abideNoteText(note) {
  if (
    Array.isArray(note?.blocks)
  ) {
    return note.blocks
      .map((block) => {
        if (
          typeof block === "string"
        ) {
          return block;
        }

        if (
          typeof block?.text === "string"
        ) {
          return block.text;
        }

        if (
          typeof block?.content === "string"
        ) {
          return block.content;
        }

        if (
          Array.isArray(block?.content)
        ) {
          return block.content
            .map(
              (part) =>
                typeof part === "string"
                  ? part
                  : part?.text || ""
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
}


function abideReadNotes() {
  const found = [];
  const seen = new Set();

  if (
    typeof window === "undefined"
  ) {
    return found;
  }

  const visit = (
    value,
    storageKey
  ) => {
    if (!value) return;

    if (Array.isArray(value)) {
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
      typeof value !== "object"
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
      const id =
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

      if (!seen.has(id)) {
        seen.add(id);

        found.push({
          ...value,
          _storageKey:
            storageKey,
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
    let i = 0;
    i < localStorage.length;
    i += 1
  ) {
    const key =
      localStorage.key(i);

    if (!key) continue;

    const lower =
      key.toLowerCase();

    if (
      !lower.includes("note") &&
      !lower.includes("scratch")
    ) {
      continue;
    }

    try {
      visit(
        JSON.parse(
          localStorage.getItem(key)
        ),
        key
      );
    } catch {}
  }

  return found;
}


function ExportCenter({
  tasks,
  goals,
  areas,
  journalEntries,
  onBack,
}) {
  /* ABIDE REPORT BUILDER CONNECTION V1 */
  const [
    reportBuilderOpen,
    setReportBuilderOpen,
  ] = useState(false);

  if (reportBuilderOpen) {
    return (
      <ReportBuilder
        tasks={tasks}
        goals={goals}
        areas={areas}
        journalEntries={journalEntries}
        onBack={() =>
          setReportBuilderOpen(false)
        }
      />
    );
  }

  const notes =
    abideReadNotes();

  const stamp =
    new Date()
      .toISOString()
      .slice(0, 10);


  const taskRows =
    tasks.map(
      (task) => ({
        id:
          task.id || "",

        title:
          task.title || "",

        kind:
          task.kind || "task",

        parentTaskId:
          task.parentTaskId || "",

        area:
          task.area &&
          areas?.[task.area]
            ? areas[
                task.area
              ].name
            : "",

        areaId:
          task.area || "",

        goalId:
          task.goal || "",

        dueDate:
          taskDateKey(task) || "",

        dueTime:
          task.dueTime || "",

        finishBy:
          task.targetDate || "",

        priority:
          task.priority || "",

        progress:
          taskProgress(task),

        completed:
          Boolean(task.done),

        completedAt:
          task.completedAt || "",

        reminder:
          task.reminder || "",

        notes:
          task.notes || "",
      })
    );


  const goalRows =
    goals.map(
      (goal) => ({
        id:
          goal.id || "",

        goal:
          goal.name || "",

        area:
          goal.area &&
          areas?.[goal.area]
            ? areas[
                goal.area
              ].name
            : "",

        areaId:
          goal.area || "",

        targetDate:
          goal.targetDate || "",

        progress:
          goal.progress ?? "",

        notes:
          goal.notes || "",

        linkedTasks:
          tasks.filter(
            (task) =>
              String(
                task.goal || ""
              ) ===
              String(
                goal.id || ""
              )
          ).length,
      })
    );


  const topLevel =
    tasks.filter(
      (task) =>
        !task.parentTaskId
    );

  const subtasks =
    tasks.filter(
      (task) =>
        Boolean(
          task.parentTaskId
        )
    );

  const open =
    tasks.filter(
      (task) => !task.done
    );

  const completed =
    tasks.filter(
      (task) => task.done
    );

  const overdue =
    tasks.filter(
      (task) =>
        !task.done &&
        taskDateKey(task) <
          REFERENCE_DATE_KEY
    );


  const insightRows = [
    {
      metric:
        "Total task records",
      value:
        tasks.length,
    },

    {
      metric:
        "Top-level tasks",
      value:
        topLevel.length,
    },

    {
      metric:
        "Subtasks",
      value:
        subtasks.length,
    },

    {
      metric:
        "Open records",
      value:
        open.length,
    },

    {
      metric:
        "Completed records",
      value:
        completed.length,
    },

    {
      metric:
        "Overdue records",
      value:
        overdue.length,
    },

    {
      metric:
        "Completion rate",
      value:
        tasks.length
          ? `${Math.round(
              completed.length /
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
        "Week starts on",
      value:
        getAbideWeekStart(),
    },
  ];


  const taskColumns = [
    ["id", "ID"],
    ["title", "Title"],
    ["kind", "Kind"],
    [
      "parentTaskId",
      "Parent Task ID",
    ],
    ["area", "Area"],
    ["areaId", "Area ID"],
    ["goalId", "Goal ID"],
    ["dueDate", "Due Date"],
    ["dueTime", "Due Time"],
    ["finishBy", "Finish By"],
    ["priority", "Priority"],
    ["progress", "Progress"],
    ["completed", "Completed"],
    [
      "completedAt",
      "Completed At",
    ],
    ["reminder", "Reminder"],
    ["notes", "Notes"],
  ];


  const goalColumns = [
    ["id", "ID"],
    ["goal", "Goal"],
    ["area", "Area"],
    ["areaId", "Area ID"],
    [
      "targetDate",
      "Target Date",
    ],
    ["progress", "Progress"],
    ["notes", "Notes"],
    [
      "linkedTasks",
      "Linked Tasks",
    ],
  ];


  const insightColumns = [
    ["metric", "Metric"],
    ["value", "Value"],
  ];


  const exportCsv =
    (type) => {
      if (type === "tasks") {
        abideDownload(
          `abide-tasks-${stamp}.csv`,
          abideCsv(
            taskRows,
            taskColumns
          ),
          "text/csv"
        );
      }

      if (type === "goals") {
        abideDownload(
          `abide-goals-${stamp}.csv`,
          abideCsv(
            goalRows,
            goalColumns
          ),
          "text/csv"
        );
      }

      if (
        type === "insights"
      ) {
        abideDownload(
          `abide-insights-${stamp}.csv`,
          abideCsv(
            insightRows,
            insightColumns
          ),
          "text/csv"
        );
      }
    };


  const exportExcel =
    async (
      scope = "everything"
    ) => {
      const XLSX =
        await import("xlsx");

      const workbook =
        XLSX.utils.book_new();


      if (
        scope === "everything" ||
        scope === "tasks"
      ) {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            taskRows
          ),
          "Tasks"
        );
      }


      if (
        scope === "everything" ||
        scope === "goals"
      ) {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            goalRows
          ),
          "Goals"
        );
      }


      if (
        scope === "everything" ||
        scope === "insights"
      ) {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            insightRows
          ),
          "Insights"
        );
      }


      if (
        scope === "everything"
      ) {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            Object.entries(
              areas
            ).map(
              ([id, area]) => ({
                id,
                name:
                  area.name,
                color:
                  area.color,
              })
            )
          ),
          "Areas"
        );


        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            journalEntries
          ),
          "Journal"
        );


        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            notes.map(
              (note, index) => ({
                title:
                  note.title ||
                  note.name ||
                  `Note ${index + 1}`,

                text:
                  abideNoteText(
                    note
                  ),

                updatedAt:
                  note.updatedAt ||
                  "",
              })
            )
          ),
          "Notes"
        );
      }


      XLSX.writeFile(
        workbook,

        scope === "everything"
          ? `abide-export-${stamp}.xlsx`
          : `abide-${scope}-${stamp}.xlsx`
      );
    };


  const exportPdf =
    async (
      title,
      sections,
      filename
    ) => {
      const {
        jsPDF,
      } =
        await import("jspdf");

      const doc =
        new jsPDF();

      const pageHeight =
        doc.internal.pageSize
          .getHeight();

      let y = 18;

      const ensureSpace =
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
      doc.text(title, 18, y);
      y += 10;

      doc.setFontSize(8);

      doc.text(
        `Exported ${new Date().toLocaleString()}`,
        18,
        y
      );

      y += 10;


      for (
        const section of sections
      ) {
        ensureSpace(12);

        doc.setFontSize(13);

        doc.text(
          section.heading,
          18,
          y
        );

        y += 7;

        doc.setFontSize(9);


        for (
          const value of section.lines
        ) {
          const lines =
            doc.splitTextToSize(
              String(value || ""),
              175
            );

          ensureSpace(
            lines.length * 4.5 + 3
          );

          doc.text(
            lines,
            18,
            y
          );

          y +=
            lines.length * 4.5 +
            2;
        }

        y += 3;
      }


      doc.save(filename);
    };


  const exportWord =
    async (
      title,
      sections,
      filename
    ) => {
      const {
        Document,
        Packer,
        Paragraph,
        HeadingLevel,
      } =
        await import("docx");

      const children = [
        new Paragraph({
          text: title,

          heading:
            HeadingLevel.HEADING_1,
        }),

        new Paragraph({
          text:
            `Exported ${new Date().toLocaleString()}`,
        }),
      ];


      sections.forEach(
        (section) => {
          children.push(
            new Paragraph({
              text:
                section.heading,

              heading:
                HeadingLevel.HEADING_2,
            })
          );

          section.lines
            .forEach(
              (line) =>
                children.push(
                  new Paragraph({
                    text:
                      String(
                        line || ""
                      ),
                  })
                )
            );
        }
      );


      const document =
        new Document({
          sections: [
            { children },
          ],
        });


      const blob =
        await Packer.toBlob(
          document
        );


      abideDownload(
        filename,
        blob,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    };


  const journalSections =
    journalEntries.map(
      (entry) => ({
        heading:
          `${entry.dateKey || entry.date || "Undated"}${
            entry.ref
              ? ` — ${entry.ref}`
              : ""
          }`,

        lines: [
          entry.note || "",
        ],
      })
    );


  const noteSections =
    notes.map(
      (note, index) => ({
        heading:
          note.title ||
          note.name ||
          `Note ${index + 1}`,

        lines: [
          abideNoteText(note),
        ],
      })
    );


  const tasksPdf =
    () =>
      exportPdf(
        "Abide Tasks",
        [
          {
            heading:
              "Summary",

            lines: [
              `${topLevel.length} top-level tasks`,
              `${subtasks.length} subtasks`,
              `${open.length} open records`,
              `${completed.length} completed records`,
            ],
          },

          {
            heading:
              "Tasks",

            lines:
              taskRows.map(
                (task) =>
                  `${task.completed ? "Completed" : "Open"} | ${task.title} | ${task.area || "No Area"} | Due ${task.dueDate || "No date"}`
              ),
          },
        ],
        `abide-tasks-${stamp}.pdf`
      );


  const goalsPdf =
    () =>
      exportPdf(
        "Abide Goals",
        [
          {
            heading: "Goals",

            lines:
              goalRows.map(
                (goal) =>
                  `${goal.goal} | ${goal.area || "No Area"} | Target ${goal.targetDate || "None"}`
              ),
          },
        ],
        `abide-goals-${stamp}.pdf`
      );


  const insightsPdf =
    () =>
      exportPdf(
        "Abide Insights",
        [
          {
            heading:
              "Current Snapshot",

            lines:
              insightRows.map(
                (row) =>
                  `${row.metric}: ${row.value}`
              ),
          },
        ],
        `abide-insights-${stamp}.pdf`
      );


  const journalPdf =
    () =>
      exportPdf(
        "Abide Journal",
        journalSections,
        `abide-journal-${stamp}.pdf`
      );


  const notesPdf =
    () =>
      exportPdf(
        "Abide Notes",
        noteSections,
        `abide-notes-${stamp}.pdf`
      );


  const journalWord =
    () =>
      exportWord(
        "Abide Journal",
        journalSections,
        `abide-journal-${stamp}.docx`
      );


  const notesWord =
    () =>
      exportWord(
        "Abide Notes",
        noteSections,
        `abide-notes-${stamp}.docx`
      );


  const fullSections = [
    {
      heading: "Insights",

      lines:
        insightRows.map(
          (row) =>
            `${row.metric}: ${row.value}`
        ),
    },

    {
      heading: "Goals",

      lines:
        goalRows.map(
          (goal) =>
            `${goal.goal} — ${goal.area || "No Area"}`
        ),
    },

    {
      heading: "Tasks",

      lines:
        taskRows.map(
          (task) =>
            `${task.completed ? "Completed" : "Open"} — ${task.title} — ${task.area || "No Area"}`
        ),
    },

    ...journalSections.map(
      (section) => ({
        heading:
          `Journal — ${section.heading}`,

        lines:
          section.lines,
      })
    ),

    ...noteSections.map(
      (section) => ({
        heading:
          `Note — ${section.heading}`,

        lines:
          section.lines,
      })
    ),
  ];


  const fullPdf =
    () =>
      exportPdf(
        "Abide Export",
        fullSections,
        `abide-export-${stamp}.pdf`
      );


  const fullWord =
    () =>
      exportWord(
        "Abide Export",
        fullSections,
        `abide-export-${stamp}.docx`
      );


  const exportZip =
    async () => {
      const JSZipModule =
        await import("jszip");

      const JSZip =
        JSZipModule.default ||
        JSZipModule;

      const zip =
        new JSZip();


      zip.file(
        "Tasks.csv",
        abideCsv(
          taskRows,
          taskColumns
        )
      );


      zip.file(
        "Goals.csv",
        abideCsv(
          goalRows,
          goalColumns
        )
      );


      zip.file(
        "Insights.csv",
        abideCsv(
          insightRows,
          insightColumns
        )
      );


      zip.file(
        "Journal.md",
        journalEntries
          .map(
            (entry) => [
              `# ${entry.dateKey || entry.date || "Undated"}`,
              entry.ref
                ? `\n${entry.ref}\n`
                : "",
              entry.note || "",
            ].join("\n")
          )
          .join("\n\n---\n\n")
      );


      zip.file(
        "Notes.md",
        notes
          .map(
            (note, index) => [
              `# ${
                note.title ||
                note.name ||
                `Note ${index + 1}`
              }`,
              "",
              abideNoteText(note),
            ].join("\n")
          )
          .join("\n\n---\n\n")
      );


      zip.file(
        "Abide Backup.json",
        JSON.stringify(
          {
            format:
              "abide-full-backup",

            version: 2,

            exportedAt:
              new Date()
                .toISOString(),

            preferences: {
              weekStartsOn:
                getAbideWeekStart(),
            },

            tasks,
            goals,
            areas,
            journalEntries,
            notes,
          },
          null,
          2
        )
      );


      const blob =
        await zip.generateAsync({
          type: "blob",
        });


      abideDownload(
        `abide-export-${stamp}.zip`,
        blob,
        "application/zip"
      );
    };


  return (
    <>
      <Header
        eyebrow="Your data belongs to you"
        title="Export Center"
      />

      <div className="scroll">

        {/* ABIDE BUILD REPORT LAUNCHER V1 */}
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 14,
            border: "1px solid rgba(232,180,92,.28)",
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "#E8B45C",
            }}
          >
            Custom Reporting
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 15,
              fontWeight: 760,
              color: "var(--text)",
            }}
          >
            Build a Report
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              lineHeight: 1.5,
              color: "var(--text3)",
            }}
          >
            Filter by Area, Goal, dates, status, priority,
            favorites, keywords, and more. Choose your fields,
            sort and group the results, preview them, and export.
          </div>

          <div
            className="filter-chip active"
            onClick={() =>
              setReportBuilderOpen(true)
            }
            style={{
              width: "fit-content",
              marginTop: 12,
              cursor: "pointer",
            }}
          >
            Build a Report →
          </div>
        </div>

        <div
          className="filter-chip"
          onClick={onBack}
          style={{
            width: "fit-content",
            marginBottom: 14,
          }}
        >
          ← Back
        </div>


        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 15,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 750,
              color: "var(--text)",
            }}
          >
            Export Everything
          </div>

          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: "var(--text3)",
              marginTop: 5,
            }}
          >
            Tasks, Goals, Insights, Areas,
            Journal, and Notes.
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 12,
            }}
          >
            <div
              className="filter-chip active"
              onClick={() =>
                exportExcel(
                  "everything"
                )
              }
            >
              Excel
            </div>

            <div
              className="filter-chip"
              onClick={fullWord}
            >
              Word
            </div>

            <div
              className="filter-chip"
              onClick={fullPdf}
            >
              PDF
            </div>

            <div
              className="filter-chip"
              onClick={exportZip}
            >
              ZIP Bundle
            </div>
          </div>
        </div>


        <div className="section-label">
          Tasks
        </div>

        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text3)",
              marginBottom: 9,
            }}
          >
            {topLevel.length} top-level ·{" "}
            {subtasks.length} subtasks ·{" "}
            {tasks.length} stored records
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
            }}
          >
            <div
              className="filter-chip"
              onClick={() =>
                exportCsv("tasks")
              }
            >
              CSV
            </div>

            <div
              className="filter-chip"
              onClick={() =>
                exportExcel("tasks")
              }
            >
              Excel
            </div>

            <div
              className="filter-chip"
              onClick={tasksPdf}
            >
              PDF
            </div>
          </div>
        </div>


        <div className="section-label">
          Goals
        </div>

        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
            }}
          >
            <div
              className="filter-chip"
              onClick={() =>
                exportCsv("goals")
              }
            >
              CSV
            </div>

            <div
              className="filter-chip"
              onClick={() =>
                exportExcel("goals")
              }
            >
              Excel
            </div>

            <div
              className="filter-chip"
              onClick={goalsPdf}
            >
              PDF
            </div>
          </div>
        </div>


        <div className="section-label">
          Insights
        </div>

        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
            }}
          >
            <div
              className="filter-chip"
              onClick={() =>
                exportCsv(
                  "insights"
                )
              }
            >
              CSV
            </div>

            <div
              className="filter-chip"
              onClick={() =>
                exportExcel(
                  "insights"
                )
              }
            >
              Excel
            </div>

            <div
              className="filter-chip"
              onClick={
                insightsPdf
              }
            >
              PDF
            </div>
          </div>
        </div>


        <div className="section-label">
          Journal
        </div>

        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
            }}
          >
            <div
              className="filter-chip"
              onClick={journalWord}
            >
              Word
            </div>

            <div
              className="filter-chip"
              onClick={journalPdf}
            >
              PDF
            </div>
          </div>
        </div>


        <div className="section-label">
          Notes
        </div>

        <div
          className="card"
          style={{
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
            }}
          >
            <div
              className="filter-chip"
              onClick={notesWord}
            >
              Word
            </div>

            <div
              className="filter-chip"
              onClick={notesPdf}
            >
              PDF
            </div>
          </div>
        </div>


        <div style={{ height: 100 }} />
      </div>
    </>
  );
}


function getViewport(w) {
  if (w < 760) return "phone";
  if (w < 1120) return "tablet";
  return "desktop";
}

export default function App({ accountSync }) {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "today";

    try {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get("tab");

      if (params.get("taskId")) return "reminders";

      if (
        requestedTab &&
        ["today", "calendar", "review", "goals", "journal", "scratch", "reminders", "insights", "more"].includes(requestedTab)
      ) {
        return requestedTab;
      }
    } catch {}

    return "today";
  });
  const [tasks, setTasks] = usePersistentState("abide-tasks", seedTasks);
  const [goals, setGoals] = usePersistentState("abide-goals", seedGoals);
  const [areas, setAreas] = usePersistentState("abide-areas", AREAS);
  const [journalEntries, setJournalEntries] = usePersistentState("abide-journal", seedJournal);
  const [highlightMeanings, setHighlightMeanings] = usePersistentState(
    "abide-highlight-meanings",
    DEFAULT_HIGHLIGHT_MEANINGS
  );
  const [expandedId, setExpandedId] = useState(null);

  const [
    selectedAreaId,
    setSelectedAreaId,
  ] = useState(null);

  useEffect(() => {
    const openArea = (event) => {
      const areaId =
        event?.detail?.areaId;

      if (
        areaId &&
        areas[areaId]
      ) {
        setSelectedAreaId(areaId);
      }
    };

    window.addEventListener(
      "abide:open-area",
      openArea
    );

    return () => {
      window.removeEventListener(
        "abide:open-area",
        openArea
      );
    };
  }, [areas]);

  useEffect(() => {
    setSelectedAreaId(null);
  }, [tab]);


  const [theme, setTheme] = usePersistentState("abide-theme", "dark");
  const [primaryNavigation, setPrimaryNavigation] = usePersistentState(
    "abide-primary-navigation",
    DEFAULT_PRIMARY_NAV
  );
  const safePrimaryNavigation = normalizePrimaryNav(primaryNavigation);
  const [protectedBlocks, setProtectedBlocks] = usePersistentState("abide-protected-blocks", []);
  const [onboardingComplete, setOnboardingComplete] = usePersistentState("abide-onboarding-complete", false);
  const [onboardingAreaName, setOnboardingAreaName] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [quickAddSignal, setQuickAddSignal] = useState(0);

  /* ABIDE EXPORT ROOT V1 */
  const [
    exportCenterOpen,
    setExportCenterOpen,
  ] = useState(false);

  useEffect(() => {
    const handler = () =>
      setExportCenterOpen(true);

    window.addEventListener(
      "abide:open-export-center",
      handler
    );

    return () =>
      window.removeEventListener(
        "abide:open-export-center",
        handler
      );
  }, []);

  /* ABIDE CENTRAL NAVIGATION V1 */
  const navigateToTab = (nextTab) => {
    setExportCenterOpen(false);
    setSelectedAreaId(null);
    setTab(nextTab);
  };

  useEffect(() => {
    const goToday = () => {
      navigateToTab("today");
    };

    window.addEventListener(
      "abide:go-today",
      goToday
    );

    return () => {
      window.removeEventListener(
        "abide:go-today",
        goToday
      );
    };
  }, []);

  const [viewport, setViewport] = useState(() => (typeof window !== "undefined" ? getViewport(window.innerWidth) : "phone"));
  const tk = THEME[theme] || THEME.dark;

  useEffect(() => {
    const root = document.documentElement;
    const entries = {
      "--pageBg": tk.pageBg, "--appBg": tk.appBg, "--shadow": tk.shadow, "--card": tk.card, "--cardBorder": tk.cardBorder,
      "--text": tk.text, "--text2": tk.text2, "--text3": tk.text3, "--body": tk.body, "--body2": tk.body2,
      "--pillBg": tk.pillBg, "--pillBorder": tk.pillBorder, "--inputBg": tk.inputBg, "--inputBorder": tk.inputBorder,
      "--track": tk.track, "--divider": tk.divider, "--subtleBg": tk.subtleBg, "--tabbarBg": tk.tabbarBg,
      "--segActive": tk.segActive, "--protectedText": tk.protectedText, "--emptyHeat": tk.emptyHeat,
    };
    Object.entries(entries).forEach(([key,value]) => root.style.setProperty(key,value));
  }, [tk]);


  useEffect(() => {
    const onResize = () => setViewport(getViewport(window.innerWidth));
    onResize(); window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (
      JSON.stringify(primaryNavigation) !==
      JSON.stringify(safePrimaryNavigation)
    ) {
      setPrimaryNavigation(safePrimaryNavigation);
    }
  }, [primaryNavigation]);


  const toggleDone = (id) => setTasks((prev) => {
    const task = prev.find((t) => t.id === id);
    if (!task) return prev;
    if (!task.done && task.recurrence?.freq) {
      const nextDate = nextRecurrenceDate(taskDateKey(task), task.recurrence);
      const completed = prev.map((t) => t.id === id ? { ...t, done: true, progress: "completed", completedAt: new Date().toISOString() } : t);
      if (!nextDate) return completed;
      const nextTask = { ...task, id: `rec_${Date.now()}`, done: false, progress: "not_started", completedAt: null, dueDate: nextDate, dueOffsetDays: offsetFromDateKey(nextDate), due: task.dueTime ? formatTimeLabel(task.dueTime) : formatDateLabel(nextDate), parentRecurringId: task.parentRecurringId || task.id };
      return [nextTask, ...completed];
    }
    return prev.map((t) => t.id === id ? {
      ...t,
      done: !t.done,
      progress: !t.done ? "completed" : "not_started",
      completedAt: !t.done ? new Date().toISOString() : null,
    } : t);
  });
  const updateTask = (updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const createTask = (task) => {
    const dueDate = task.dueDate || REFERENCE_DATE_KEY;
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const normalized = {
      ...task,
      dueDate,
      dueOffsetDays: Number.isFinite(task.dueOffsetDays) ? task.dueOffsetDays : offsetFromDateKey(dueDate),
      due: task.due || (task.dueTime ? formatTimeLabel(task.dueTime) : formatDateLabel(dueDate)),
      notes: task.notes || "",
      activities: Array.isArray(task.activities) ? task.activities : [],
      reminder: task.reminder || "None",
      status: task.status || "next",
      kind: task.kind || "task",
      done: Boolean(task.done),
      progress: Boolean(task.done) ? "completed" : (task.progress || "not_started"),
    };
    setTasks((prev) => [{ id, ...normalized }, ...prev]);
    return id;
  };
  const createArea = ({ name, color = "#8FA88A" }) => {
    const id = `area_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setAreas((prev) => ({ ...prev, [id]: { name: String(name || "").trim(), color } }));
    return id;
  };

  const isFreshAccount =
    !onboardingComplete &&
    tasks.length === 0 &&
    goals.length === 0 &&
    journalEntries.length === 0 &&
    Object.keys(areas).length === 0;

  const finishOnboarding = () => {
    const name = onboardingAreaName.trim();

    if (name) {
      createArea({ name });
    }

    setOnboardingComplete(true);
    setOnboardingOpen(false);
    setOnboardingStep(0);
    setOnboardingAreaName("");
  };

  const openHowAbideWorks = () => {
    setOnboardingStep(0);
    setOnboardingAreaName("");
    setOnboardingOpen(true);
  };

  const deleteArea = (id) => {
    setAreas((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTasks((prev) => prev.map((t) => t.area === id ? { ...t, area: null } : t));
    setGoals((prev) => prev.map((g) => g.area === id ? { ...g, area: null } : g));
  };

  useEffect(() => {
    setTasks((prev) => {
      const parentsWithEmbeddedSubtasks = prev.filter(
        (task) =>
          Array.isArray(task.subtasks) &&
          task.subtasks.length > 0
      );

      if (!parentsWithEmbeddedSubtasks.length) return prev;

      const existingIds = new Set(
        prev.map((task) => String(task.id))
      );

      const existingLegacyKeys = new Set(
        prev
          .map((task) => task.legacySubtaskKey)
          .filter(Boolean)
      );

      const children = [];

      const nextParents = prev.map((parent) => {
        if (
          !Array.isArray(parent.subtasks) ||
          parent.subtasks.length === 0
        ) {
          return parent;
        }

        parent.subtasks.forEach((sub, index) => {
          const legacyKey = `${parent.id}:${sub.id || index}`;

          if (existingLegacyKeys.has(legacyKey)) return;

          let childId =
            sub.id ||
            `child_${parent.id}_${index}`;

          if (existingIds.has(String(childId))) {
            childId = `child_${parent.id}_${sub.id || index}`;
          }

          existingIds.add(String(childId));
          existingLegacyKeys.add(legacyKey);

          const dueDate =
            sub.dueDate ||
            parent.dueDate ||
            taskDateKey(parent);

          const dueTime = sub.dueTime || null;
          const done = Boolean(sub.done);

          children.push({
            id: childId,
            legacySubtaskKey: legacyKey,
            parentTaskId: parent.id,
            kind: "task",
            title:
              String(sub.label || sub.title || "").trim() ||
              "Subtask",
            notes: sub.notes || "",
            activities: Array.isArray(sub.activities)
              ? sub.activities
              : [],
            area:
              sub.area !== undefined
                ? sub.area
                : parent.area || null,
            goal:
              sub.goal !== undefined
                ? sub.goal
                : parent.goal || null,
            dueDate,
            dueTime,
            dueOffsetDays: offsetFromDateKey(dueDate),
            due: dueTime
              ? formatTimeLabel(dueTime)
              : formatDateLabel(dueDate),
            priority:
              sub.priority ||
              parent.priority ||
              "med",
            status: sub.status || "next",
            progress: done
              ? "completed"
              : sub.progress || "not_started",
            done,
            completedAt: done
              ? sub.completedAt ||
                new Date().toISOString()
              : null,
            recurrence: sub.recurrence || null,
            repeat:
              sub.repeat ||
              (sub.recurrence
                ? recurrenceLabel(sub.recurrence)
                : null),
            reminder: sub.reminder || "None",
            bypassProtected:
              sub.bypassProtected ??
              parent.bypassProtected ??
              false,
            createdAt:
              sub.createdAt ||
              parent.createdAt ||
              new Date().toISOString(),
          });
        });

        const { subtasks: _legacySubtasks, ...cleanParent } = parent;
        return cleanParent;
      });

      return [...children, ...nextParents];
    });
  }, []);

  useEffect(() => {
    const goalsWithLegacyMilestones = goals.filter(
      (goal) => Array.isArray(goal.milestones) &&
        goal.milestones.length > 0 &&
        goal.targetDate
    );

    if (!goalsWithLegacyMilestones.length) return;

    setTasks((prev) => {
      const next = [...prev];

      goalsWithLegacyMilestones.forEach((goal) => {
        goal.milestones.forEach((milestone) => {
          const legacyKey = `${goal.id}:${milestone.id}`;

          if (next.some((task) => task.legacyMilestoneKey === legacyKey)) return;

          const dueDate = milestone.dueDate || goal.targetDate;

          next.unshift({
            id: `milestone_${goal.id}_${milestone.id}`,
            kind: "milestone",
            legacyMilestoneKey: legacyKey,
            title: milestone.label || "Milestone",
            goal: goal.id,
            area: goal.area || null,
            dueDate,
            dueOffsetDays: offsetFromDateKey(dueDate),
            due: formatDateLabel(dueDate),
            dueTime: null,
            priority: "med",
            status: "next",
            progress: milestone.done ? "completed" : "not_started",
            done: Boolean(milestone.done),
            completedAt: milestone.done ? new Date().toISOString() : null,
            reminder: "None",
            notes: "",
            activities: [],
                  recurrence: null,
            repeat: null,
          });
        });
      });

      return next;
    });

    setGoals((prev) =>
      prev.map((goal) =>
        goalsWithLegacyMilestones.some((item) => String(item.id) === String(goal.id))
          ? { ...goal, milestones: [] }
          : goal
      )
    );
  }, [goals]);

  const openGlobalAdd = () => { setTab("calendar"); setQuickAddSignal((n) => n + 1); };

  if (isFreshAccount || onboardingOpen) {
    const step = ONBOARDING_STEPS[Math.min(onboardingStep, ONBOARDING_STEPS.length - 1)];
    const isFirst = onboardingStep === 0;
    const isLast = onboardingStep === ONBOARDING_STEPS.length - 1;

    return (
      <div
        style={{
          minHeight: "100dvh",
          width: "100%",
          background: tk.pageBg,
          display: "grid",
          placeItems: "center",
          padding: 16,
          boxSizing: "border-box",
          fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif',
        }}
      >
        <div
          style={{
            width: "min(100%, 440px)",
            maxHeight: "calc(100dvh - 32px)",
            overflowY: "auto",
            boxSizing: "border-box",
            background: tk.card,
            border: `1px solid ${tk.cardBorder}`,
            borderRadius: 26,
            padding: 22,
            boxShadow: tk.shadow,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
              <img src="/abide-logo.png" alt="Abide" style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.15, color: "#E8B45C" }}>
                  {step.eyebrow}
                </div>
                <div style={{ fontSize: 11.5, color: tk.text3, marginTop: 3 }}>
                  {onboardingStep + 1} of {ONBOARDING_STEPS.length}
                </div>
              </div>
            </div>

            {onboardingOpen && !isFreshAccount && (
              <button
                type="button"
                onClick={() => { setOnboardingOpen(false); setOnboardingStep(0); }}
                style={{ border: 0, background: "transparent", color: tk.text3, font: "inherit", fontSize: 12, cursor: "pointer" }}
              >
                Close
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 5, margin: "18px 0 20px" }}>
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                style={{
                  height: 3,
                  flex: 1,
                  borderRadius: 999,
                  background: index <= onboardingStep ? "#E8B45C" : tk.divider,
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: 26, lineHeight: 1.12, fontWeight: 760, color: tk.text }}>
            {step.title}
          </div>

          <div
            style={{
              display: "inline-flex",
              marginTop: 12,
              padding: "6px 9px",
              borderRadius: 999,
              background: "rgba(143,168,138,.14)",
              color: "#8FA88A",
              fontSize: 11.5,
              fontWeight: 750,
            }}
          >
            {step.scripture}
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.6, color: tk.body, marginTop: 17 }}>
            {step.copy}
          </div>

          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.58,
              color: tk.text2,
              marginTop: 13,
              padding: 14,
              borderRadius: 14,
              background: tk.subtleBg,
              border: `1px solid ${tk.divider}`,
            }}
          >
            {step.detail}
          </div>

          {step.areaStep && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: tk.text3, marginBottom: 7 }}>
                Your first Area
              </div>

              <input
                type="text"
                value={onboardingAreaName}
                onChange={(event) => setOnboardingAreaName(event.target.value)}
                placeholder="Example: Personal"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  border: `1px solid ${tk.inputBorder}`,
                  background: tk.inputBg,
                  color: tk.text,
                  borderRadius: 12,
                  padding: "12px 13px",
                  font: "inherit",
                  fontSize: 14,
                  outline: "none",
                }}
              />

              <div style={{ fontSize: 11.5, color: tk.text3, lineHeight: 1.45, marginTop: 7 }}>
                Optional. You can create or change Areas anytime in Settings.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 9, marginTop: 22 }}>
            {!isFirst && (
              <button
                type="button"
                onClick={() => setOnboardingStep((value) => Math.max(0, value - 1))}
                style={{
                  flex: 1,
                  border: `1px solid ${tk.inputBorder}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: tk.subtleBg,
                  color: tk.text,
                  font: "inherit",
                  fontSize: 13.5,
                  fontWeight: 750,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLast) finishOnboarding();
                else setOnboardingStep((value) => Math.min(ONBOARDING_STEPS.length - 1, value + 1));
              }}
              style={{
                flex: 1.35,
                border: 0,
                borderRadius: 12,
                padding: "12px 14px",
                background: "#E8B45C",
                color: "#14100A",
                font: "inherit",
                fontSize: 13.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {isLast
                ? (onboardingAreaName.trim() ? "Create Area & Begin" : "Begin Abide")
                : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "today", label: "Today", icon: ListTodo },
    ...safePrimaryNavigation
      .map((id) =>
        PRIMARY_NAV_DESTINATIONS.find(
          (destination) => destination.id === id
        )
      )
      .filter(Boolean),
    { id: "more", label: "More", icon: SettingsIcon },
  ];

  const vars = {
    "--pageBg": tk.pageBg, "--appBg": tk.appBg, "--shadow": tk.shadow, "--card": tk.card, "--cardBorder": tk.cardBorder,
    "--text": tk.text, "--text2": tk.text2, "--text3": tk.text3, "--body": tk.body, "--body2": tk.body2,
    "--pillBg": tk.pillBg, "--pillBorder": tk.pillBorder, "--inputBg": tk.inputBg, "--inputBorder": tk.inputBorder,
    "--track": tk.track, "--divider": tk.divider, "--subtleBg": tk.subtleBg, "--tabbarBg": tk.tabbarBg,
    "--segActive": tk.segActive, "--protectedText": tk.protectedText, "--emptyHeat": tk.emptyHeat,
  };

  const activeTab =
    selectedAreaId &&
    areas[selectedAreaId]
      ? (
        <AreaDetailView
          areaId={selectedAreaId}
          areas={areas}
          tasks={tasks}
          goals={goals}
          onBack={() =>
            setSelectedAreaId(null)
          }
          onToggleDone={toggleDone}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onCreateTask={createTask}
          onCreateArea={createArea}
        />
      )
      : (
    <>
      {tab === "today" && <TodayTab tasks={tasks} goals={goals} areas={areas} expandedId={expandedId} setExpandedId={setExpandedId} toggleDone={toggleDone} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateTask={createTask} onCreateArea={createArea} />}
      {tab === "calendar" && <CalendarTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} areas={areas} toggleDone={toggleDone} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateTask={createTask} openAddSignal={quickAddSignal} onCreateArea={createArea} />}
      {tab === "review" && <ReviewTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} areas={areas} onOpen={navigateToTab} onOpenAdd={openGlobalAdd} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateArea={createArea} />}
      {tab === "goals" && (
        <GoalsTab
          goals={goals}
          setGoals={setGoals}
          viewport={viewport}
          areas={areas}
          tasks={tasks}
          onCreateTask={createTask}
          onUpdateTask={updateTask}
          onCreateArea={createArea}
        />
      )}
      {tab === "journal" && (
        <>
          <JournalTab
            entries={journalEntries}
            setEntries={setJournalEntries}
            highlightMeanings={highlightMeanings}
            setHighlightMeanings={setHighlightMeanings}
          />

          {/* ABIDE JOURNAL FAVORITES V1 */}
          <JournalFavoriteDock
            entries={journalEntries}
            setEntries={setJournalEntries}
          />
        </>
      )}
      {tab === "scratch" && <ScratchTab />}
      {tab === "reminders" && <RemindersTab tasks={tasks} goals={goals} areas={areas} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateArea={createArea} />}
      {tab === "insights" && (
        <InsightsTab
          theme={theme}
          setTheme={setTheme}
          protectedBlocks={protectedBlocks}
          setProtectedBlocks={setProtectedBlocks}
          areas={areas}
          setAreas={setAreas}
          onDeleteArea={deleteArea}
          tasks={tasks}
          goals={goals}
          journalEntries={journalEntries}
          setJournalEntries={setJournalEntries}
          onOpenJournal={() => navigateToTab("journal")}
          onOpenCalendar={() => navigateToTab("calendar")}
          accountSync={accountSync}
          onOpenHowAbideWorks={openHowAbideWorks}
          primaryNavigation={safePrimaryNavigation}
          setPrimaryNavigation={setPrimaryNavigation}
          highlightMeanings={highlightMeanings}
          setHighlightMeanings={setHighlightMeanings}
        />
      )}

      {tab === "more" && (
        <MoreTab
          onOpen={navigateToTab}
          theme={theme}
          setTheme={setTheme}
          protectedBlocks={protectedBlocks}
          setProtectedBlocks={setProtectedBlocks}
          areas={areas}
          setAreas={setAreas}
          onDeleteArea={deleteArea}
          onOpenCalendar={() => navigateToTab("calendar")}
          accountSync={accountSync}
          onOpenHowAbideWorks={openHowAbideWorks}
          primaryNavigation={safePrimaryNavigation}
          setPrimaryNavigation={setPrimaryNavigation}
          highlightMeanings={highlightMeanings}
          setHighlightMeanings={setHighlightMeanings}
        />
      )}
    </>
  );

  return (
    <div className={`viewport-${viewport}`} style={{ display: "flex", justifyContent: viewport === "phone" ? "center" : "stretch", padding: 0, background: viewport === "phone" ? tk.appBg : tk.pageBg, height: "100vh", minHeight: "100vh", width: "100%", overflow: "hidden", ...vars }}>
      <style>{styles}</style>
      {!["journal", "scratch"].includes(tab) && (
        <AbideCommandLayer />
      )}
      <PwaUpdateBanner />
      {viewport === "phone" ? (
        <div className="app">
          <div className="statusbar"><span
              className="brand"
              role="button"
              tabIndex={0}
              aria-label="Go to Today"
              title="Go to Today"
              onClick={() =>
                navigateToTab("today")
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  navigateToTab("today");
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <img
                className="brand-mark"
                src="/abide-logo.png"
                alt=""
              />
              <span className="brand-word">
                {APP_NAME.toUpperCase()}
              </span>
            </span><div className="theme-toggle" style={{ cursor: "pointer" }} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon size={15} color="#E8B45C" /> : <Sun size={15} color="#D69A3A" />}</div></div>
          <div className="phone-content">
            {exportCenterOpen ? (
              <ExportCenter
                tasks={tasks}
                goals={goals}
                areas={areas}
                journalEntries={journalEntries}
                onBack={() =>
                  setExportCenterOpen(false)
                }
              />
            ) : activeTab}
          </div>

          <PhoneQuickAccess
            tab={tab}
            setTab={navigateToTab}
          />

          <button className="fab" onClick={openGlobalAdd} aria-label="Add task or event"><Plus size={24} strokeWidth={2.5} /></button>
          <div className="tabbar">{tabs.map((t) => { const Icon = t.icon; const active = navTabIsActive(tab, t.id); return <div key={t.id} className={`tab ${active ? "active" : ""}`} style={{ cursor: "pointer" }} onClick={() => navigateToTab(t.id)}><Icon size={20} strokeWidth={active ? 2.3 : 1.8} /><span>{t.label}</span></div>; })}</div>
        </div>
      ) : (
        <div className="shell"><Sidebar
            tabs={tabs}
            tab={tab}
            setTab={navigateToTab}
            viewport={viewport}
            theme={theme}
            setTheme={setTheme}
          /><div className="shell-main">
          {exportCenterOpen ? (
            <ExportCenter
              tasks={tasks}
              goals={goals}
              areas={areas}
              journalEntries={journalEntries}
              onBack={() =>
                setExportCenterOpen(false)
              }
            />
          ) : activeTab}
          <button className="fab shell-fab" onClick={openGlobalAdd} aria-label="Add task or event"><Plus size={24} strokeWidth={2.5} /></button></div></div>
      )}
    </div>
  );
}
