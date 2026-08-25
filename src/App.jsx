import ImportTasksPanel from "./ImportTasksPanel.jsx";
import { registerSW } from "virtual:pwa-register";
import packageInfo from "../package.json";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ListTodo, CalendarDays, Target, BookOpen, BarChart3, Plus, X,
  Flag, Repeat, ChevronRight, ChevronDown, ChevronLeft, Flame, TrendingUp,
  Check, Clock, Pencil, Sparkles, Filter, PenTool, Type, Trash2,
  RefreshCw, ShieldCheck, Archive, Bell, SlidersHorizontal, Sun, Moon,
  Dumbbell, Salad, ExternalLink, Settings as SettingsIcon
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

  .tabbar { position: relative; z-index: 80; flex-shrink: 0; width: 100%; height: calc(64px + env(safe-area-inset-bottom, 0px)); padding: 10px 0 env(safe-area-inset-bottom, 0px); background: var(--tabbarBg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 1px solid var(--divider); display: flex; align-items: flex-start; }
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
const AREAS = {
  chialpha: { name: "Chi Alpha", color: "#7C93C9" },
  margin: { name: "The Margin", color: "#E8B45C" },
  personal: { name: "Personal", color: "#8FA88A" },
  wedding: { name: "Wedding", color: "#D98595" },
  home: { name: "Project Oἰκία", color: "#A896B8" },
};

const TAGS = {
  yellow: { label: "Main Point", hex: "#E6C84D" },
  green: { label: "People / Places", hex: "#7CBE86" },
  pink: { label: "Cost / Tradeoff", hex: "#E086A0" },
  blue: { label: "Future-Facing", hex: "#6FA8DC" },
  orange: { label: "Command", hex: "#E5934A" },
};

// Core app starts empty. The user-requested task migration below is merged once into local data.
const seedTasks = [];
const somedayTasks = [];
const seedGoals = [];
const seedJournal = [];

const USER_TASK_MIGRATION_AREAS = {
  homeArea: { name: "Home", color: "#A896B8" },
  apartmentCleaning: { name: "Apartment Cleaning", color: "#D98595" },
};

const USER_TASK_MIGRATION_TASKS = [
  { id: "user_home_stack_laundry", title: "Stack the washer and dryer", area: "homeArea", dueDate: "2026-09-01", dueTime: null, due: "Sep 1", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_home_tools", title: "Organize the tools", area: "homeArea", dueDate: "2026-09-02", dueTime: null, due: "Sep 2", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_home_books", title: "Get all books on the bookshelf", area: "homeArea", dueDate: "2026-09-03", dueTime: null, due: "Sep 3", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_home_desk", title: "Organize desk", area: "homeArea", dueDate: "2026-09-04", dueTime: null, due: "Sep 4", priority: "low", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_home_closet", title: "Purchase closet equipment", area: "homeArea", dueDate: "2026-09-05", dueTime: null, due: "Sep 5", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [{ id: "user_home_closet_hang", label: "Hang closet equipment to the wall", done: false }] },
  { id: "user_apartment_clothes", title: "Bring clothes to the house", area: "apartmentCleaning", dueDate: "2026-08-22", dueTime: null, due: "Aug 22", priority: "high", status: "next", done: false, reminder: "None", notes: "Apartment clean-out · finish by August 30", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_apartment_couch", title: "Sell or get rid of the couch", area: "apartmentCleaning", dueDate: "2026-08-23", dueTime: null, due: "Aug 23", priority: "high", status: "next", done: false, reminder: "None", notes: "Apartment clean-out · finish by August 30", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_apartment_wardrobe", title: "Sell or get rid of the exposed wardrobe", area: "apartmentCleaning", dueDate: "2026-08-24", dueTime: null, due: "Aug 24", priority: "high", status: "next", done: false, reminder: "None", notes: "Apartment clean-out · finish by August 30", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_apartment_bathroom", title: "Clean out bathroom", area: "apartmentCleaning", dueDate: "2026-08-26", dueTime: null, due: "Aug 26", priority: "med", status: "next", done: false, reminder: "None", notes: "Apartment clean-out · finish by August 30", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_apartment_kitchen", title: "Pack kitchen or throw away dishes", area: "apartmentCleaning", dueDate: "2026-08-28", dueTime: null, due: "Aug 28", priority: "high", status: "next", done: false, reminder: "None", notes: "Apartment clean-out · finish by August 30", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_apartment_coffee_table", title: "Bring Coffee Table to the house", area: "apartmentCleaning", dueDate: "2026-08-29", dueTime: null, due: "Aug 29", priority: "med", status: "next", done: false, reminder: "None", notes: "Apartment clean-out · finish by August 30", recurrence: null, repeat: null, subtasks: [] },
].map((task) => ({ ...task, dueOffsetDays: Math.round((dateFromKey(task.dueDate) - dateFromKey(localDateKey())) / 86400000) }));


const USER_TASK_MIGRATION_WORK_MARGIN_AREAS = {
  workArea: { name: "Work", color: "#4C9AFF" },
};

// Imported from the user's Apple Reminders screenshots. Due dates below were intentionally
// rescheduled into the future. Work items are next week; The Margin avoids Oct 14–30, 2026.
const USER_TASK_MIGRATION_WORK_MARGIN_TASKS = [
  // Work — next week
  { id: "user_work_rachelle_102", title: "Get Rachelle vision and copy and wording on post for 10:2 Post", area: "workArea", dueDate: "2026-08-24", dueTime: null, due: "Aug 24", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_work_film_102", title: "Confirm filming date and studio location for 10-2 video", area: "workArea", dueDate: "2026-08-25", dueTime: null, due: "Aug 25", priority: "high", status: "next", done: false, reminder: "None", notes: "I sent an email - awaiting confirmation", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_work_our_story", title: "Write Our Story copy", area: "workArea", dueDate: "2026-08-26", dueTime: null, due: "Aug 26", priority: "med", status: "next", done: false, reminder: "None", notes: "Ask John what Alex's vision is for the Our Story page", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_work_q2_comms", title: "Begin planning Q2 Communications plan, including prep for Chi Alpha Leadership Conference (XALC) expected in February", area: "workArea", dueDate: "2026-08-28", dueTime: null, due: "Aug 28", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },

  // The Margin — sequenced around content, website, giving, launch, and backend work.
  { id: "user_margin_phase1", title: "PHASE 1 - CONTENT", area: "margin", dueDate: "2026-08-24", dueTime: null, due: "Aug 24", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_tally_articles", title: "Tally articles published YTD vs 13", area: "margin", dueDate: "2026-08-25", dueTime: null, due: "Aug 25", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_publish_targets", title: "Set monthly publish targets to reach 13 by Dec 20", area: "margin", dueDate: "2026-08-26", dueTime: null, due: "Aug 26", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_batch_draft", title: "Batch-draft next month's content", area: "margin", dueDate: "2026-08-27", dueTime: null, due: "Aug 27", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_movement1", title: "Write Movement 1 readings - Read it cold (mornings 1-7)", area: "margin", dueDate: "2026-08-31", dueTime: null, due: "Aug 31", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_movement2", title: "Write Movement 2 readings - The world behind it (mornings 8-14)", area: "margin", dueDate: "2026-09-07", dueTime: null, due: "Sep 7", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_movement3", title: "Write Movement 3 readings - What scholars see (mornings 15-21)", area: "margin", dueDate: "2026-09-14", dueTime: null, due: "Sep 14", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_movement4", title: "Write Movement 4 readings - Make it yours (mornings 22-30)", area: "margin", dueDate: "2026-09-21", dueTime: null, due: "Sep 21", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_brand_templates", title: "Build reusable brand templates (Canva framed + Procreate annotated)", area: "margin", dueDate: "2026-09-23", dueTime: null, due: "Sep 23", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_small_group_guide", title: "Small Group Discussion Guide", area: "margin", dueDate: "2026-09-24", dueTime: null, due: "Sep 24", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_cadence", title: "Define the ongoing cadence after series 1", area: "margin", dueDate: "2026-09-25", dueTime: null, due: "Sep 25", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_phase2", title: "PHASE 2 - WEBSITE", area: "margin", dueDate: "2026-09-28", dueTime: null, due: "Sep 28", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_final_copy", title: "Final copy pass on all website pages", area: "margin", dueDate: "2026-09-29", dueTime: null, due: "Sep 29", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_substack", title: "Step 4 - Wire the Subscribe form to Substack", area: "margin", dueDate: "2026-09-30", dueTime: null, due: "Sep 30", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_module_page", title: "Build the module page (series syllabus view)", area: "margin", dueDate: "2026-10-01", dueTime: null, due: "Oct 1", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_domain", title: "Buy domain + set up DNS & hosting", area: "margin", dueDate: "2026-10-02", dueTime: null, due: "Oct 2", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_device_check", title: "Step 5 - Final device check + fix list", area: "margin", dueDate: "2026-10-05", dueTime: null, due: "Oct 5", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_mobile_qa", title: "Mobile/responsive QA pass on the site", area: "margin", dueDate: "2026-10-06", dueTime: null, due: "Oct 6", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_analytics", title: "Set up basic analytics", area: "margin", dueDate: "2026-10-07", dueTime: null, due: "Oct 7", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_alpha_test", title: "Alpha test - full end-to-end walkthrough", area: "margin", dueDate: "2026-10-08", dueTime: null, due: "Oct 8", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_phase3", title: "PHASE 3 - GIVING", area: "margin", dueDate: "2026-10-09", dueTime: null, due: "Oct 9", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_giving_setup", title: "Set up one-time + recurring giving", area: "margin", dueDate: "2026-10-10", dueTime: null, due: "Oct 10", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_giving_links", title: "Connect giving links across the site (nav, footer, support block)", area: "margin", dueDate: "2026-10-12", dueTime: null, due: "Oct 12", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_welcome_email", title: "Write welcome email + first week's email sequence", area: "margin", dueDate: "2026-10-13", dueTime: null, due: "Oct 13", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },

  // Honeymoon / wedding blackout: no Margin due dates Oct 14–30.
  { id: "user_margin_phase4", title: "PHASE 4 - LAUNCH & GROW", area: "margin", dueDate: "2026-10-31", dueTime: null, due: "Oct 31", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_weekly_batch", title: "Set a weekly Sunday batch day (cut next week's posts from the essay)", area: "margin", dueDate: "2026-11-01", dueTime: null, due: "Nov 1", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_soft_launch", title: "Soft launch to a small list; gather feedback", area: "margin", dueDate: "2026-11-03", dueTime: null, due: "Nov 3", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_feedback", title: "Incorporate feedback from soft launch", area: "margin", dueDate: "2026-11-06", dueTime: null, due: "Nov 6", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_public_launch", title: "Public launch announcement", area: "margin", dueDate: "2026-11-09", dueTime: null, due: "Nov 9", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_series2", title: "Plan series #2", area: "margin", dueDate: "2026-11-11", dueTime: null, due: "Nov 11", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_phase5", title: "PHASE 5 - BACKEND & APP (post-validation)", area: "margin", dueDate: "2026-11-16", dueTime: null, due: "Nov 16", priority: "med", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_review_30day", title: "Review 30-day completion + giving data; decide whether to build the backend", area: "margin", dueDate: "2026-12-09", dueTime: null, due: "Dec 9", priority: "high", status: "next", done: false, reminder: "None", notes: "Scheduled 30 days after the public launch announcement.", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_backend_path", title: "Decide backend build path", area: "margin", dueDate: "2026-12-10", dueTime: null, due: "Dec 10", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_backend_tables", title: "Stand up the 4 backend tables", area: "margin", dueDate: "2026-12-14", dueTime: null, due: "Dec 14", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_auth", title: "Build real authentication", area: "margin", dueDate: "2026-12-16", dueTime: null, due: "Dec 16", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_real_server", title: "Point existing login/dashboard screens at the real server", area: "margin", dueDate: "2026-12-18", dueTime: null, due: "Dec 18", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
  { id: "user_margin_sync", title: "Build progress syncing across devices", area: "margin", dueDate: "2026-12-21", dueTime: null, due: "Dec 21", priority: "high", status: "next", done: false, reminder: "None", notes: "", recurrence: null, repeat: null, subtasks: [] },
].map((task) => ({ ...task, dueOffsetDays: Math.round((dateFromKey(task.dueDate) - dateFromKey(localDateKey())) / 86400000) }));

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_OPTIONS = [
  { label: "Sunday", code: "SU" }, { label: "Monday", code: "MO" }, { label: "Tuesday", code: "TU" },
  { label: "Wednesday", code: "WE" }, { label: "Thursday", code: "TH" }, { label: "Friday", code: "FR" }, { label: "Saturday", code: "SA" },
];
const REPEAT_UNITS = ["None", "Daily", "Weekly", "Monthly", "Yearly"];
const IRON_LOG_URL = "https://lamound2407-jpg.github.io/iron-log/";
const TROPHE_URL = "https://lamound2407-jpg.github.io/trophe/";

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

const MORE_TAB_IDS = new Set(["goals", "scratch", "reminders", "insights"]);

function navTabIsActive(currentTab, itemId) {
  return currentTab === itemId || (itemId === "more" && MORE_TAB_IDS.has(currentTab));
}

function Sidebar({ tabs, tab, setTab, viewport, theme, setTheme }) {
  const compact = viewport === "tablet";
  return (
    <div className={`sidebar ${compact ? "sidebar-compact" : "sidebar-wide"}`}>
      <div className="sidebar-brand">
        <img className="sidebar-brand-logo" src="/abide-logo.png" alt="Abide" />
        <span className="sidebar-brand-word">ABIDE</span>
      </div>
      <div className="sidebar-nav">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = navTabIsActive(tab, t.id);
          return (
            <div key={t.id} className={`sidebar-item ${active ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
              <span>{t.label}</span>
            </div>
          );
        })}
      </div>
      <div className="sidebar-footer" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        {theme === "dark" ? <Moon size={16} color="#E8B45C" /> : <Sun size={16} color="#D69A3A" />}
        <span>{theme === "dark" ? "Dark" : "Light"} Mode</span>
      </div>
    </div>
  );
}

function TaskRow({ task, expanded, onToggleExpand, onToggleDone, goals, areas = AREAS, onEdit }) {
  const area = task.area && areas[task.area] ? areas[task.area] : { name: "No Area", color: "#9AA2B1" };
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
            <span className="chip" style={{ background: area.color + "26", color: area.color }}>{area.name}</span>
            {task.dueOffsetDays < 0 && !task.done && <span className="chip" style={{ background: "#E0707026", color: "#E68080" }}>Overdue</span>}
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
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Reminder</span><span className="field-value"><Bell size={11} color="var(--text2)" />{task.reminder || "None"}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Goal</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{goal ? goal.name : "No goal — standalone"}</span></div>
          {(task.subtasks || []).length > 0 && <div style={{ paddingTop: 8 }}>{task.subtasks.map((sub) => <div key={sub.id} className="subtask-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><Check size={12} color={sub.done ? "#E8B45C" : "var(--text3)"} /><span style={{ textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.65 : 1 }}>{sub.label}</span></div>)}</div>}
          <div className="notes-box" style={{ minHeight: 38, cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}>
            {normalizeActivity(task).length ? `${normalizeActivity(task).length} activit${normalizeActivity(task).length === 1 ? "y" : "ies"} · ${normalizeActivity(task)[normalizeActivity(task).length - 1].text}` : "Add an activity update…"}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduledSubtaskRow({ entry, areas, onToggle }) {
  const { parent, sub } = entry;
  const area = parent.area && areas[parent.area] ? areas[parent.area] : { name: "No Area", color: "#9AA2B1" };

  return (
    <div className="task-row">
      <div
        className={`checkbox ${sub.done ? "done" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(parent.id, sub.id);
        }}
      >
        {sub.done && <Check size={13} color="#14100A" strokeWidth={3} />}
      </div>

      <div style={{ flex: 1 }}>
        <div className={`task-title ${sub.done ? "done" : ""}`}>{sub.label}</div>
        <div className="task-meta">
          <span className="chip" style={{ background: area.color + "26", color: area.color }}>{area.name}</span>
          <span className="time-chip">Subtask of {parent.title}</span>
          <span className="time-chip">
            <Clock size={11} />
            {sub.dueTime ? formatTimeLabel(sub.dueTime) : formatDateLabel(sub.dueDate)}
          </span>
          {parent.priority === "high" && <Flag size={12} color="#E68080" fill="#E68080" />}
        </div>
      </div>
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

function scheduledSubtaskEntries(tasks = []) {
  return tasks.flatMap((parent) =>
    (parent.subtasks || [])
      .filter((sub) => Boolean(sub.dueDate))
      .map((sub) => ({
        parent,
        sub,
        dueDate: sub.dueDate,
        dueTime: sub.dueTime || null,
        dueOffsetDays: offsetFromDateKey(sub.dueDate),
      }))
  );
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

function buildWeekKeys(anchorKey = REFERENCE_DATE_KEY) {
  const d = dateFromKey(anchorKey);
  const mondayOffset = (d.getDay() + 6) % 7;
  const monday = shiftDateKey(anchorKey, -mondayOffset);
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(monday, i));
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


const REMINDER_OPTIONS = ["None", "At time", "5 min before", "15 min before", "30 min before", "1 hour before", "1 day before"];

function ReminderPicker({ value, onChange }) {
  const known = REMINDER_OPTIONS.includes(value);
  return (
    <>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
        {REMINDER_OPTIONS.map((option) => <div key={option} className={`filter-chip ${value === option ? "active" : ""}`} onClick={() => onChange(option)}><Bell size={11} />{option}</div>)}
      </div>
      {!known && <input className="input-line" style={{ marginTop: 4 }} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Custom reminder, e.g. 2 hours before" />}
      <div className="filter-chip" style={{ display: "inline-flex", marginTop: 5 }} onClick={() => { if (known) onChange("Custom"); }}>Custom</div>
    </>
  );
}

function QuickAreaPicker({ areas, value, onChange, onCreateArea, allowNone = true }) {
  const [addingArea, setAddingArea] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [areaColor, setAreaColor] = useState("#8FA88A");

  const create = () => {
    if (!areaName.trim() || !onCreateArea) return;
    const id = onCreateArea({ name: areaName.trim(), color: areaColor });
    if (id) onChange(id);
    setAreaName("");
    setAreaColor("#8FA88A");
    setAddingArea(false);
  };

  return (
    <>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
        {allowNone && <div className={`filter-chip ${value === "" ? "active" : ""}`} onClick={() => onChange("")}>No Area</div>}
        {Object.entries(areas).map(([k, v]) => <div key={k} className={`filter-chip ${value === k ? "active" : ""}`} style={{ borderColor: v.color + "55" }} onClick={() => onChange(k)}>{v.name}</div>)}
        {onCreateArea && <div className={`filter-chip ${addingArea ? "active" : ""}`} onClick={() => setAddingArea(!addingArea)}><Plus size={11} />New Area</div>}
      </div>
      {addingArea && (
        <div className="quick-area-create">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input-line" style={{ margin: 0, flex: 1 }} value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="Area name" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} />
            <input type="color" value={areaColor} onChange={(e) => setAreaColor(e.target.value)} style={{ width: 42, height: 38, border: "none", background: "transparent", cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <div className="filter-chip active" onClick={create}>Add & Select</div>
            <div className="filter-chip" onClick={() => setAddingArea(false)}>Cancel</div>
          </div>
        </div>
      )}
    </>
  );
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
  const offset = reminderOffsetMinutes(task.reminder);
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

function TaskEditor({ task, goals, areas, onSave, onCancel, onDelete, onCreateArea }) {
  const modalRef = useRef(null);
  const [title, setTitle] = useState(task.title || "");
  const [dueDate, setDueDate] = useState(taskDateKey(task));
  const [dueTime, setDueTime] = useState(inferTaskTime(task));
  const [priority, setPriority] = useState(task.priority || "med");
  const [area, setArea] = useState(task.area && areas[task.area] ? task.area : "");
  const [goal, setGoal] = useState(task.goal || "");
  const [recurrence, setRecurrence] = useState(normalizeRecurrence(task, taskDateKey(task)));
  const [reminder, setReminder] = useState(task.reminder || "None");
  const [activities, setActivities] = useState(() => normalizeActivity(task));
  const [activityDraft, setActivityDraft] = useState("");
  const [subtasks, setSubtasks] = useState(task.subtasks || []);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskDueDate, setSubtaskDueDate] = useState("");
  const [subtaskDueTime, setSubtaskDueTime] = useState("");
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


  const addSubtask = () => {
    if (!subtaskDraft.trim()) return;
    setSubtasks((p) => [...p, {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: subtaskDraft.trim(),
      done: false,
      dueDate: subtaskDueDate || null,
      dueTime: subtaskDueTime || null,
    }]);
    setSubtaskDraft("");
    setSubtaskDueDate("");
    setSubtaskDueTime("");
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
    onSave({ ...task, title: title.trim(), dueDate, dueTime: dueTime || null, due, dueOffsetDays, priority, area: area || null, goal: goal || null, repeat: recurrence ? recurrenceLabel(recurrence) : null, recurrence, reminder, notes: "", activities, subtasks });
  };

  return createPortal(
    <div ref={modalRef} className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="task-editor-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="editor-shell">
          <div className="editor-header"><div className="editor-title">Edit Task</div><div className="editor-close" onClick={onCancel}><X size={17} /></div></div>
          <div className="editor-scroll">
            <div className="fb-label" style={{ marginTop:0 }}>Task</div>
            <input className="input-line" style={{ marginTop:0 }} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Task title" />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div><div className="fb-label">Date</div><input type="date" className="input-line" style={{ marginTop:0 }} value={dueDate} onChange={(e)=>{ setDueDate(e.target.value); if (recurrence?.freq === "weekly" && !(recurrence.days||[]).length) setRecurrence({ ...recurrence, days:[weekdayCodeFromDate(e.target.value)] }); }} /></div>
              <div><div className="fb-label">Time</div><input type="time" className="input-line" style={{ marginTop:0 }} value={dueTime} onChange={(e)=>setDueTime(e.target.value)} /></div>
            </div>
            <div className="fb-label">Priority</div><div className="filter-row" style={{ padding:"0 0 2px 0" }}>{[["high","High"],["med","Medium"],["low","Low"]].map(([k,label])=><div key={k} className={`filter-chip ${priority===k?"active":""}`} onClick={()=>setPriority(k)}>{label}</div>)}</div>
            <div className="fb-label">Area</div><QuickAreaPicker areas={areas} value={area} onChange={setArea} onCreateArea={onCreateArea} />
            <div className="fb-label">Goal (optional)</div><div className="filter-row" style={{ padding:"0 0 2px 0" }}><div className={`filter-chip ${goal===""?"active":""}`} onClick={()=>setGoal("")}>No Goal</div>{goals.map((g)=><div key={g.id} className={`filter-chip ${goal===g.id?"active":""}`} onClick={()=>setGoal(g.id)}>{g.name}</div>)}</div>
            <div className="fb-label">Repeat</div><RecurrenceEditor value={recurrence} onChange={setRecurrence} dateKey={dueDate} />
            <div className="fb-label">Reminder</div><ReminderPicker value={reminder} onChange={setReminder} />
            <div className="fb-label">Subtasks</div>
            {subtasks.map((sub)=><div key={sub.id} style={{ padding:"8px 0", borderBottom:"1px solid var(--divider)" }}>
              <div className="subtask-row">
                <input type="checkbox" checked={Boolean(sub.done)} onChange={()=>setSubtasks((p)=>p.map((x)=>x.id===sub.id?{...x,done:!x.done}:x))}/>
                <span style={{ flex:1, textDecoration:sub.done?"line-through":"none", opacity:sub.done?0.65:1 }}>{sub.label}</span>
                <X size={13} style={{ cursor:"pointer" }} onClick={()=>setSubtasks((p)=>p.filter((x)=>x.id!==sub.id))}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:6 }}>
                <input type="date" className="input-line" style={{ margin:0 }} value={sub.dueDate || ""} onChange={(e)=>setSubtasks((p)=>p.map((x)=>x.id===sub.id?{...x,dueDate:e.target.value || null}:x))}/>
                <input type="time" className="input-line" style={{ margin:0 }} value={sub.dueTime || ""} onChange={(e)=>setSubtasks((p)=>p.map((x)=>x.id===sub.id?{...x,dueTime:e.target.value || null}:x))}/>
              </div>
            </div>)}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <input type="date" className="input-line" style={{ margin:0 }} value={subtaskDueDate} onChange={(e)=>setSubtaskDueDate(e.target.value)} />
              <input type="time" className="input-line" style={{ margin:0 }} value={subtaskDueTime} onChange={(e)=>setSubtaskDueTime(e.target.value)} />
            </div>
            <div style={{ display:"flex", gap:8 }}><input className="input-line" style={{ margin:0 }} value={subtaskDraft} onChange={(e)=>setSubtaskDraft(e.target.value)} placeholder="Add a subtask" onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addSubtask(); } }} /><div className="filter-chip active" onClick={addSubtask}>Add</div></div>
            <div className="fb-label">Activity</div>
            <div className="activity-list">{activities.length?activities.map((a)=><div className="activity-item" key={a.id}><div className="activity-time">{activityTimeLabel(a.createdAt)}</div><div className="activity-text">{a.text}</div></div>):<div style={{ fontSize:12, color:"var(--text3)" }}>No activity yet.</div>}</div>
            <div className="activity-compose"><textarea className="notes-box" rows={2} value={activityDraft} onChange={(e)=>setActivityDraft(e.target.value)} placeholder="Add an update or comment…" /><div className="filter-chip active" onClick={addActivity}>Add</div></div>
            <div className="filter-chip editor-delete" onClick={()=>{ if(window.confirm(`Delete "${task.title}"?`)) onDelete(task.id); }}><Trash2 size={12}/>Delete Task</div>
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
function FilterSystem({ areas, selectedAreas, setSelectedAreas, selectedPriorities, setSelectedPriorities, savedFilters, setSavedFilters }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const areaKeys = Object.keys(areas);
  const allAreasOn = areaKeys.length === 0 || areaKeys.every((k) => selectedAreas.includes(k));
  const allPriOn = selectedPriorities.length === 3;

  const toggleArea = (k) => setSelectedAreas((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const togglePri = (k) => setSelectedPriorities((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const applySaved = (f) => { setSelectedAreas(f.areas.filter((a) => areas[a])); setSelectedPriorities(f.priorities); };
  const removeSaved = (id, e) => { e.stopPropagation(); setSavedFilters((p) => p.filter((f) => f.id !== id)); };
  const saveCurrent = () => {
    if (!draftName.trim()) return;
    setSavedFilters((p) => [...p, { id: Date.now(), name: draftName.trim(), areas: selectedAreas, priorities: selectedPriorities }]);
    setDraftName(""); setBuilderOpen(false);
  };

  return (
    <>
      <div className="filter-row">
        <div className={`filter-chip ${allAreasOn && allPriOn ? "active" : ""}`} onClick={() => { setSelectedAreas(areaKeys); setSelectedPriorities(["high", "med", "low"]); }}><Filter size={12} />All</div>
        {savedFilters.map((f) => (
          <div key={f.id} className="filter-chip" onClick={() => applySaved(f)}>{f.name}<X size={11} className="x" onClick={(e) => removeSaved(f.id, e)} /></div>
        ))}
        <div className={`filter-chip ${builderOpen ? "active" : ""}`} onClick={() => setBuilderOpen(!builderOpen)}><SlidersHorizontal size={12} />Customize</div>
      </div>
      {builderOpen && (
        <div className="card filter-builder">
          <div className="fb-label">Areas</div>
          <div className="filter-row" style={{ padding: 0 }}>
            {areaKeys.length ? Object.entries(areas).map(([k, v]) => <div key={k} className={`filter-chip ${selectedAreas.includes(k) ? "active" : ""}`} onClick={() => toggleArea(k)}>{v.name}</div>) : <span style={{ fontSize: 12, color: "var(--text3)" }}>No areas yet.</span>}
          </div>
          <div className="fb-label">Priority</div>
          <div className="filter-row" style={{ padding: 0 }}>{[["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([k, label]) => <div key={k} className={`filter-chip ${selectedPriorities.includes(k) ? "active" : ""}`} onClick={() => togglePri(k)}>{label}</div>)}</div>
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
  const [savedFilters, setSavedFilters] = useState([]);
  const [range, setRange] = useState("week");
  const [somedayOpen, setSomedayOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const keys = Object.keys(areas);
    setSelectedAreas((prev) => {
      const kept = prev.filter((k) => areas[k]);
      const added = keys.filter((k) => !kept.includes(k));
      return [...kept, ...added];
    });
  }, [areas]);

  const matches = (t) => (!t.area || selectedAreas.includes(t.area)) && selectedPriorities.includes(t.priority);
  const overdue = tasks.filter((t) => t.dueOffsetDays < 0 && !t.done && matches(t));
  const today = tasks.filter((t) => t.dueOffsetDays === 0 && matches(t));
  const maxRange = range === "week" ? 7 : 14;
  const upcoming = tasks.filter((t) => t.dueOffsetDays > 0 && t.dueOffsetDays <= maxRange && matches(t));

  const scheduledSubtasks = scheduledSubtaskEntries(tasks).filter(({ parent }) => matches(parent));
  const overdueSubtasks = scheduledSubtasks.filter((entry) => entry.dueOffsetDays < 0 && !entry.sub.done);
  const todaySubtasks = scheduledSubtasks.filter((entry) => entry.dueOffsetDays === 0);
  const upcomingSubtasks = scheduledSubtasks.filter((entry) => entry.dueOffsetDays > 0 && entry.dueOffsetDays <= maxRange);

  const toggleScheduledSubtask = (parentId, subtaskId) => {
    const parent = tasks.find((task) => task.id === parentId);
    if (!parent) return;
    onUpdateTask({
      ...parent,
      subtasks: (parent.subtasks || []).map((sub) =>
        sub.id === subtaskId ? { ...sub, done: !sub.done } : sub
      ),
    });
  };
  const upcomingReminders = tasks.filter((t) => t.reminder && t.reminder !== "None" && !t.done && t.dueOffsetDays <= 1);

  const saveTask = (updated) => { onUpdateTask(updated); setEditingTask(null); };
  const deleteTask = (id) => { onDeleteTask(id); if (editingTask?.id === id) setEditingTask(null); };
  const openEditor = (t) => {
    setAdding(false);
    setEditingTask(t);
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
    />
  );

  const renderScheduledSubtask = (entry) => (
    <ScheduledSubtaskRow
      key={`${entry.parent.id}:${entry.sub.id}`}
      entry={entry}
      areas={areas}
      onToggle={toggleScheduledSubtask}
    />
  );
  const todayLabel = dateFromKey(REFERENCE_DATE_KEY).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <Header eyebrow={todayLabel} title="Today" actions={[{ icon: Bell, onClick: () => setAlertsOpen(!alertsOpen), badge: upcomingReminders.length > 0 }]} />
      <div className="scroll">
        <div className="capture-bar" style={{ cursor: "pointer" }} onClick={() => { setEditingTask(null); setAdding(!adding); }}><Plus size={16} />{adding ? "Close quick add" : "Add a task"}</div>
        {adding && <AddSheet goals={goals} areas={areas} initialDate={REFERENCE_DATE_KEY} allowEvents={false} onClose={() => setAdding(false)} onCreateTask={onCreateTask} onCreateEvent={async () => {}} googleConnected={false} onCreateArea={onCreateArea} />}

        {editingTask && <TaskEditor task={editingTask} goals={goals} areas={areas} onSave={saveTask} onCancel={() => setEditingTask(null)} onDelete={deleteTask} onCreateArea={onCreateArea} />}

        {alertsOpen && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-label" style={{ margin: "10px 14px 4px 0" }}>Upcoming Reminders</div>
            {upcomingReminders.length ? upcomingReminders.map((t) => <div key={t.id} className="review-item"><span>{t.title}</span><span className="review-count">{t.reminder}</span></div>) : <div className="insight-line">No reminders set for the next day.</div>}
          </div>
        )}

        <FilterSystem areas={areas} selectedAreas={selectedAreas} setSelectedAreas={setSelectedAreas} selectedPriorities={selectedPriorities} setSelectedPriorities={setSelectedPriorities} savedFilters={savedFilters} setSavedFilters={setSavedFilters} />

        {(overdue.length > 0 || overdueSubtasks.length > 0) && (<><div className="section-label">Overdue</div><div className="card">{overdue.map(renderTask)}{overdueSubtasks.map(renderScheduledSubtask)}</div></>)}

        <div className="section-label">Today</div>
        <div className="card">{today.length || todaySubtasks.length ? <>{today.map(renderTask)}{todaySubtasks.map(renderScheduledSubtask)}</> : <div className="insight-line">No tasks due today. Tap “Add a task” above to create one.</div>}</div>

        <div className="section-label"><span>Coming Up</span></div>
        <div className="segmented" style={{ margin: "0 0 10px 0" }}>
          <div className={`seg-btn ${range === "week" ? "active" : ""}`} onClick={() => setRange("week")}>This Week</div>
          <div className={`seg-btn ${range === "twoweeks" ? "active" : ""}`} onClick={() => setRange("twoweeks")}>Next 2 Weeks</div>
        </div>
        <div className="card">{upcoming.length || upcomingSubtasks.length ? <>{upcoming.map(renderTask)}{upcomingSubtasks.map(renderScheduledSubtask)}</> : <div className="insight-line">Nothing scheduled in this window.</div>}</div>

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

function AddSheet({ goals, areas, initialDate, onClose, onCreateTask, onCreateEvent, googleConnected, googleAccounts = [], allowEvents = true, onCreateArea }) {
  const [kind, setKind] = useState("task");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || REFERENCE_DATE_KEY);
  const [time, setTime] = useState("");
  const [area, setArea] = useState(Object.keys(areas)[0] || "");
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState("med");
  const [recurrence, setRecurrence] = useState(null);
  const [reminder, setReminder] = useState("None");
  const [activityDraft, setActivityDraft] = useState("");
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskDueDate, setSubtaskDueDate] = useState("");
  const [subtaskDueTime, setSubtaskDueTime] = useState("");
  const [bypass, setBypass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetGoogleAccountId, setTargetGoogleAccountId] = useState(() => googleAccounts[0]?.id || "");
  const addSubtask = () => {
    if (!subtaskDraft.trim()) return;
    setSubtasks((p) => [...p, {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: subtaskDraft.trim(),
      done: false,
      dueDate: subtaskDueDate || null,
      dueTime: subtaskDueTime || null,
    }]);
    setSubtaskDraft("");
    setSubtaskDueDate("");
    setSubtaskDueTime("");
  };

  const save = async () => {
    if (!title.trim() || !date || saving) return;
    setSaving(true);
    try {
      if (kind === "task") {
        onCreateTask({ title: title.trim(), dueDate: date, dueTime: time || null, due: time ? formatTimeLabel(time) : formatDateLabel(date), dueOffsetDays: offsetFromDateKey(date), priority, area: area || null, goal: goal || null, notes: "", activities: activityDraft.trim() ? [{ id: `act_${Date.now()}`, text: activityDraft.trim(), createdAt: new Date().toISOString() }] : [], repeat: recurrence ? recurrenceLabel(recurrence) : null, recurrence, reminder, subtasks, done: false, status: "next", bypassProtected: bypass });
      } else {
        await onCreateEvent({ title: title.trim(), date, time, area: area || null, recurrence, notes: "", activities: activityDraft.trim() ? [{ id: `act_${Date.now()}`, text: activityDraft.trim(), createdAt: new Date().toISOString() }] : [], bypassProtected: bypass, targetGoogleAccountId });
      }
      onClose();
    } finally { setSaving(false); }
  };

  if (kind === "import") {
    return <ImportTasksPanel areas={areas} onCreateArea={onCreateArea} onCreateTask={onCreateTask} onClose={onClose} />;
  }

  return (
    <div className="card composer-card">
      <div className="segmented" style={{ margin: "0 0 4px 0" }}>
        <div className={`seg-btn ${kind === "task" ? "active" : ""}`} onClick={() => setKind("task")}>Task</div>
        {allowEvents && <div className={`seg-btn ${kind === "event" ? "active" : ""}`} onClick={() => setKind("event")}>Event</div>}
        <div className={`seg-btn ${kind === "import" ? "active" : ""}`} onClick={() => setKind("import")}>Import</div>
      </div>
      <input className="input-line" placeholder={kind === "task" ? "Task title" : "Event title"} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}><input type="date" className="input-line" style={{ flex: 1 }} value={date} onChange={(e) => setDate(e.target.value)} /><input type="time" className="input-line" style={{ flex: 1 }} value={time} onChange={(e) => setTime(e.target.value)} /></div>
      <div className="fb-label">Area</div><QuickAreaPicker areas={areas} value={area} onChange={setArea} onCreateArea={onCreateArea} />
      {kind === "task" && <><div className="fb-label">Priority</div><div className="filter-row" style={{ padding: "0 0 2px 0" }}>{[["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([k, label]) => <div key={k} className={`filter-chip ${priority === k ? "active" : ""}`} onClick={() => setPriority(k)}>{label}</div>)}</div><div className="fb-label">Goal (optional)</div><div className="filter-row" style={{ padding: "0 0 2px 0" }}><div className={`filter-chip ${goal === "" ? "active" : ""}`} onClick={() => setGoal("")}>No Goal</div>{goals.map((g) => <div key={g.id} className={`filter-chip ${goal === g.id ? "active" : ""}`} onClick={() => setGoal(g.id)}>{g.name}</div>)}</div><div className="fb-label">Reminder</div><ReminderPicker value={reminder} onChange={setReminder} /><div className="fb-label">Subtasks</div>
{subtasks.map((sub) => <div key={sub.id} style={{ padding:"8px 0", borderBottom:"1px solid var(--divider)" }}>
  <div className="subtask-row">
    <span style={{ flex:1 }}>{sub.label}</span>
    <X size={13} style={{ cursor:"pointer" }} onClick={() => setSubtasks((p) => p.filter((x) => x.id !== sub.id))} />
  </div>
  {(sub.dueDate || sub.dueTime) && <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:4 }}>
    {sub.dueDate ? formatDateLabel(sub.dueDate) : "No date"}{sub.dueTime ? ` · ${formatTimeLabel(sub.dueTime)}` : ""}
  </div>}
</div>)}
<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
  <input type="date" className="input-line" style={{ margin:0 }} value={subtaskDueDate} onChange={(e) => setSubtaskDueDate(e.target.value)} />
  <input type="time" className="input-line" style={{ margin:0 }} value={subtaskDueTime} onChange={(e) => setSubtaskDueTime(e.target.value)} />
</div>
<div style={{ display:"flex", gap:8 }}>
  <input className="input-line" style={{ margin:0 }} value={subtaskDraft} onChange={(e) => setSubtaskDraft(e.target.value)} placeholder="Add a subtask" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }} />
  <div className="filter-chip active" onClick={addSubtask}>Add</div>
</div></>}
      <div className="fb-label">Repeat</div><RecurrenceEditor value={recurrence} onChange={setRecurrence} dateKey={date} />
      <div className="fb-label">First Activity (optional)</div><textarea className="notes-box" rows={2} value={activityDraft} onChange={(e) => setActivityDraft(e.target.value)} placeholder={kind === "task" ? "Add the first task update…" : "Add the first event update…"} />
      {kind === "event" && googleAccounts.length > 0 && <><div className="fb-label">Google account</div><div className="filter-row" style={{ padding: "0 0 2px 0" }}>{googleAccounts.map((account) => <div key={account.id} className={`filter-chip ${targetGoogleAccountId === account.id ? "active" : ""}`} onClick={() => setTargetGoogleAccountId(account.id)}>{account.displayName || "Google Account"}</div>)}</div></>}
      {kind === "event" && <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><RefreshCw size={11} />{googleConnected ? `Will be added to ${googleAccounts.find((a) => a.id === targetGoogleAccountId)?.displayName || "the selected Google account"}.` : "Will stay in Abide until Google Calendar is connected."}</div>}
      <div className="settings-row" style={{ padding: "12px 0 2px 0", borderBottom: "none" }}><div className="settings-row-name"><ShieldCheck size={15} color="#8FA88A" />Bypass protected time blocks</div><Toggle on={bypass} onClick={() => setBypass(!bypass)} /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><div className="filter-chip active" style={{ flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }} onClick={save}>{saving ? "Saving…" : `Save ${kind === "task" ? "Task" : "Event"}`}</div><div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</div></div>
    </div>
  );
}


function EventEditor({ event, areas, onSave, onCancel }) {
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

function CalendarTab({ tasks, goals, protectedBlocks, areas, toggleDone, onUpdateTask, onDeleteTask, onCreateTask, openAddSignal, onCreateArea }) {
  const [mode, setMode] = useState("week");
  const [selectedDateKey, setSelectedDateKey] = useState(REFERENCE_DATE_KEY);
  const [adding, setAdding] = useState(false);
  const [calsOpen, setCalsOpen] = useState(false);
  const [calendarPrefs, setCalendarPrefs] = usePersistentState("abide-google-calendar-prefs", {});
  const [events, setEvents] = usePersistentState("abide-calendar-events", []);
  const [googleError, setGoogleError] = useState("");
  const [googleAccounts, setGoogleAccounts] = useState(() => {
    try {
      const raw = sessionStorage.getItem("abideGoogleCalendarAccounts");
      if (raw) return JSON.parse(raw);
      const legacyToken = sessionStorage.getItem("abideGoogleCalendarToken");
      return legacyToken ? [{ id: "legacy", label: "Previously connected Google", token: legacyToken, calendars: [] }] : [];
    } catch { return []; }
  });
  const tokenClientRef = useRef(null);
  const [overridden, setOverridden] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const googleConfigured = Boolean(googleClientId);
  const googleConnected = googleAccounts.some((a) => Boolean(a.token));
  const weekKeys = buildWeekKeys(selectedDateKey);
  const selectedDate = dateFromKey(selectedDateKey);
  const selectedMonthKey = selectedDateKey.slice(0, 7);
  const monthLabel = selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedDayName = selectedDate.toLocaleDateString("en-US", { weekday: "short" });
  const todaysBlock = protectedBlocks.find((b) => b.day === selectedDayName);
  const connectedGoogleAccounts = googleAccounts.filter((a) => a.token);
  const flatCalendars = connectedGoogleAccounts.flatMap((account) => (account.calendars || []).map((c) => ({ ...c, accountId: account.id, accountLabel: account.label })));
  const activeCount = flatCalendars.filter((c) => c.on).length;
  const visibleCalendarKeys = new Set(flatCalendars.filter((c) => c.on).map((c) => `${c.accountId}::${c.id}`));
  const dayTasks = tasks.filter((t) => taskDateKey(t) === selectedDateKey);
  const daySubtasks = scheduledSubtaskEntries(tasks).filter((entry) => entry.dueDate === selectedDateKey);
  const dayEvents = events.filter((e) => e.date === selectedDateKey && (e.source !== "google" || visibleCalendarKeys.has(e.calendarKey || `${e.accountId || "legacy"}::${e.calendarId}`)));

  const toggleCalendarSubtask = (parentId, subtaskId) => {
    const parent = tasks.find((task) => task.id === parentId);
    if (!parent) return;
    onUpdateTask({
      ...parent,
      subtasks: (parent.subtasks || []).map((sub) =>
        sub.id === subtaskId ? { ...sub, done: !sub.done } : sub
      ),
    });
  };

  useEffect(() => { if (openAddSignal) setAdding(true); }, [openAddSignal]);

  useEffect(() => {
    try {
      sessionStorage.setItem("abideGoogleCalendarAccounts", JSON.stringify(googleAccounts));
      sessionStorage.removeItem("abideGoogleCalendarToken");
    } catch {}
  }, [googleAccounts]);

  const disconnectGoogleAccount = (accountId) => {
    setGoogleAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setEvents((prev) => prev.filter((e) => !(e.source === "google" && e.accountId === accountId)));
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

  const fetchGoogleAccountData = async (token, knownAccountId = "") => {
    if (!token) return null;
    setGoogleError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const calRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers });
      if (calRes.status === 401) {
        if (knownAccountId) disconnectGoogleAccount(knownAccountId);
        throw new Error("A Google Calendar authorization expired. Reconnect that Google account.");
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
          calendarKey: `${accountId}::${cal.id}`,
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
        const nextAccount = { id: accountId, label: accountLabel, displayName, token, calendars: nextCalendars };
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

  const connectGoogle = () => {
    setGoogleError("");
    if (!googleConfigured) { setGoogleError("Add VITE_GOOGLE_CLIENT_ID to Abide first."); return; }
    if (!tokenClientRef.current) { setGoogleError("Google sign-in is still loading. Try again in a moment."); return; }
    tokenClientRef.current.requestAccessToken({ prompt: "select_account consent" });
  };

  const createEvent = async ({ title, date, time, area, recurrence, notes, bypassProtected, targetGoogleAccountId }) => {
    const recurrenceRule = googleRecurrenceRule(recurrence, date);
    const targetAccount = connectedGoogleAccounts.find((a) => a.id === targetGoogleAccountId) || connectedGoogleAccounts[0];
    if (!targetAccount?.token) {
      setEvents((prev) => [...prev, { id: `native:${Date.now()}`, source: "native", title, date, time: time ? formatTimeLabel(time) : "All day", area, repeat: recurrence ? recurrenceLabel(recurrence) : null, recurrence, notes, bypassProtected }]);
      return;
    }
    const body = { summary: title, description: notes || undefined };
    if (recurrenceRule) body.recurrence = [recurrenceRule];
    if (time) {
      const [h, m] = time.split(":").map(Number);
      const start = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      body.start = { dateTime: start.toISOString(), timeZone: "America/Chicago" };
      body.end = { dateTime: end.toISOString(), timeZone: "America/Chicago" };
    } else {
      const end = dateFromKey(date); end.setDate(end.getDate() + 1);
      body.start = { date }; body.end = { date: localDateKey(end) };
    }
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: { Authorization: `Bearer ${targetAccount.token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 401) { disconnectGoogleAccount(targetAccount.id); setGoogleError(`${targetAccount.displayName || "Google account"} authorization expired. Reconnect it and try again.`); throw new Error("Google authorization expired"); }
    if (!res.ok) { setGoogleError(`The event could not be added to ${targetAccount.displayName || "the selected Google account"}.`); throw new Error("Google event creation failed"); }
    await fetchGoogleAccountData(targetAccount.token, targetAccount.id);
  };

  const saveEditedTask = (updated) => { onUpdateTask(updated); setEditingTask(null); };
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
      <div className="card">{dayTasks.length || daySubtasks.length ? <>
        {dayTasks.map((t) => <TaskRow key={t.id} task={t} goals={goals} areas={areas} expanded={false} onToggleExpand={() => { setAdding(false); setEditingTask(t); }} onToggleDone={toggleDone} onEdit={(task) => { setAdding(false); setEditingTask(task); }} />)}
        {daySubtasks.map((entry) => <ScheduledSubtaskRow key={`${entry.parent.id}:${entry.sub.id}`} entry={entry} areas={areas} onToggle={toggleCalendarSubtask} />)}
      </> : <div className="insight-line">No tasks due this day.</div>}</div>
      <div className="section-label">Events</div>
      <div className="card">{dayEvents.length ? dayEvents.map((e) => {
        const areaInfo = e.area && areas[e.area] ? areas[e.area] : null;
        return <div className="task-row" key={e.id} style={{ cursor: "pointer" }} onClick={() => { setAdding(false); setEditingTask(null); setEditingEvent(e); }}><div style={{ width: 22 }} /><div style={{ flex: 1 }}><div className="task-title">{e.title}</div><div className="task-meta"><span className="chip" style={{ background: (e.color || areaInfo?.color || "#8FA88A") + "26", color: e.color || areaInfo?.color || "#8FA88A" }}>{e.source === "google" ? (e.calendarLabel || "Google Calendar") : "Abide"}</span><span className="time-chip"><Clock size={11} />{e.time || "All day"}</span>{e.repeat && <span className="time-chip"><Repeat size={11} />{e.repeat}</span>}{normalizeActivity(e).length > 0 && <span className="time-chip">{normalizeActivity(e).length} update{normalizeActivity(e).length === 1 ? "" : "s"}</span>}</div></div><Pencil size={14} color="var(--text3)" /></div>;
      }) : <div className="insight-line">{googleConnected ? "No calendar events this day." : "No Abide events this day. Connect Google Calendar to pull in your real events."}</div>}</div>
    </>
  );

  const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const monthCells = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <>
      <Header eyebrow={monthLabel} title="Calendar" actions={[{ icon: SlidersHorizontal, onClick: () => setCalsOpen(!calsOpen) }, { icon: adding ? X : Plus, onClick: () => { setEditingTask(null); setEditingEvent(null); setAdding(!adding); } }]} />
      <div className="scroll">
        <div className="gcal-badge" onClick={() => setCalsOpen(!calsOpen)}><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="gcal-dot" />{googleConnected ? `${connectedGoogleAccounts.length} Google account${connectedGoogleAccounts.length === 1 ? "" : "s"} · ${activeCount} calendar${activeCount === 1 ? "" : "s"} visible` : "Google Calendar not connected"}</span>{calsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
        {calsOpen && <CalendarsPanel accounts={googleAccounts} setAccounts={setGoogleAccounts} configured={googleConfigured} onConnect={connectGoogle} onRefresh={refreshAllGoogleAccounts} onDisconnect={disconnectGoogleAccount} onToggleCalendar={toggleGoogleCalendar} onRenameAccount={renameGoogleAccount} error={googleError} />}
        {adding && <AddSheet goals={goals} areas={areas} initialDate={selectedDateKey} onClose={() => setAdding(false)} onCreateTask={onCreateTask} onCreateEvent={createEvent} googleConnected={googleConnected} googleAccounts={connectedGoogleAccounts} onCreateArea={onCreateArea} />}
        {editingTask && <TaskEditor task={editingTask} goals={goals} areas={areas} onSave={saveEditedTask} onCancel={() => setEditingTask(null)} onDelete={deleteEditedTask} onCreateArea={onCreateArea} />}
        {editingEvent && <EventEditor event={editingEvent} areas={areas} onSave={saveEditedEvent} onCancel={() => setEditingEvent(null)} />}

        <div className="segmented"><div className={`seg-btn ${mode === "week" ? "active" : ""}`} onClick={() => setMode("week")}>Week</div><div className={`seg-btn ${mode === "month" ? "active" : ""}`} onClick={() => setMode("month")}>Month</div></div>

        {mode === "week" ? (
          <>
            <div className="weekstrip">{weekKeys.map((key) => { const d = dateFromKey(key); const hasItems = tasks.some((t) => taskDateKey(t) === key) || scheduledSubtaskEntries(tasks).some((entry) => entry.dueDate === key) || events.some((e) => e.date === key); return <div key={key} className={`daypill ${selectedDateKey === key ? "selected" : ""}`} onClick={() => { setSelectedDateKey(key); setOverridden(false); setOverrideOpen(false); }}><span className="dow">{d.toLocaleDateString("en-US", { weekday: "narrow" })}</span><span className="num">{d.getDate()}</span>{hasItems && <span className="dot" />}</div>; })}</div>
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
                  const hasItems = tasks.some((t) => taskDateKey(t) === key) || scheduledSubtaskEntries(tasks).some((entry) => entry.dueDate === key) || events.some((e) => e.date === key);
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
  const [target, setTarget] = useState(initial?.target || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [milestones, setMilestones] = useState(initial?.milestones || []);
  const [mDraft, setMDraft] = useState("");

  const addMilestone = () => { if (!mDraft.trim()) return; setMilestones((p) => [...p, { id: Date.now(), label: mDraft.trim(), done: false }]); setMDraft(""); };
  const removeMilestone = (id) => setMilestones((p) => p.filter((m) => m.id !== id));
  const toggleMilestone = (id) => setMilestones((p) => p.map((m) => m.id === id ? { ...m, done: !m.done } : m));

  const save = () => {
    if (!name.trim()) return;
    const progress = milestones.length ? Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100) : 0;
    onSave({ id: initial?.id || Date.now(), name: name.trim(), area, target, notes, milestones, progress });
  };

  return (
    <div className="card composer-card">
      <div className="fb-label" style={{ marginTop: 0 }}>Goal Name</div>
      <input className="input-line" style={{ marginTop: 0 }} placeholder="e.g. Read Through the New Testament" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="fb-label">Area</div>
      <QuickAreaPicker areas={areas} value={area} onChange={setArea} onCreateArea={onCreateArea} allowNone={false} />
      <div className="fb-label">Target Date</div>
      <input className="input-line" style={{ marginTop: 0 }} placeholder="e.g. Dec 31" value={target} onChange={(e) => setTarget(e.target.value)} />
      <div className="fb-label">Notes</div>
      <textarea className="notes-box" rows={2} placeholder="Why this goal matters, context, links…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="fb-label">Milestones</div>
      {milestones.map((m) => (
        <span key={m.id} className="milestone-chip" style={{ cursor: "pointer", opacity: m.done ? 0.65 : 1, textDecoration: m.done ? "line-through" : "none" }} onClick={() => toggleMilestone(m.id)}>
          <span style={{ width: 14, height: 14, borderRadius: 7, border: "1px solid var(--text3)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{m.done && <Check size={9} />}</span>
          {m.label}<X size={12} style={{ cursor: "pointer", opacity: 0.6 }} onClick={(e) => { e.stopPropagation(); removeMilestone(m.id); }} />
        </span>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input className="input-line" style={{ margin: 0 }} placeholder="Add a milestone…" value={mDraft} onChange={(e) => setMDraft(e.target.value)} />
        <div className="filter-chip active" style={{ flexShrink: 0 }} onClick={addMilestone}>Add</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>Regular tasks link to this goal from their own "Goal" picker when you create or edit them.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={save}>Save Goal</div>
        <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</div>
      </div>
      {onDelete && <div className="filter-chip" style={{ marginTop: 8, justifyContent: "center", color: "#E68080", borderColor: "#E6808055" }} onClick={onDelete}>Delete Goal</div>}
    </div>
  );
}

function GoalsTab({ goals, setGoals, viewport, areas = AREAS, onCreateArea }) {
  const [composer, setComposer] = useState(null); // null | "add" | goalId

  const saveGoal = (g) => {
    setGoals((prev) => prev.some((x) => x.id === g.id) ? prev.map((x) => x.id === g.id ? g : x) : [...prev, g]);
    setComposer(null);
  };
  const deleteGoal = (id) => { setGoals((prev) => prev.filter((g) => g.id !== id)); setComposer(null); };
  const toggleGoalMilestone = (goalId, mId) => setGoals((prev) => prev.map((g) => {
    if (g.id !== goalId) return g;
    const milestones = g.milestones.map((m) => m.id === mId ? { ...m, done: !m.done } : m);
    return { ...g, milestones, progress: milestones.length ? Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100) : g.progress };
  }));

  return (
    <>
      <Header eyebrow={`${goals.length} active · flexible by design`} title="Goals" actions={[{ icon: Plus, onClick: () => setComposer(composer === "add" ? null : "add") }]} />
      <div className="scroll">
        {composer === "add" && <GoalComposer areas={areas} onCreateArea={onCreateArea} onSave={saveGoal} onCancel={() => setComposer(null)} />}
        <div className={viewport === "desktop" ? "goal-grid" : undefined}>
          {goals.map((g) => {
            const area = g.area && areas[g.area] ? areas[g.area] : { name: "No Area", color: "#9AA2B1" };
            if (composer === g.id) {
              return <GoalComposer key={g.id} areas={areas} onCreateArea={onCreateArea} initial={g} onSave={saveGoal} onCancel={() => setComposer(null)} onDelete={() => deleteGoal(g.id)} />;
            }
            return (
              <div key={g.id} className="card goal-card">
                <div className="goal-title-row">
                  <div><span className="chip" style={{ background: area.color + "26", color: area.color }}>{area.name}</span><div className="goal-name" style={{ marginTop: 6 }}>{g.name}</div></div>
                  <Pencil size={15} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => setComposer(g.id)} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12.5, color: "var(--text2)" }}><span>{g.progress}% complete</span><span>Target · {g.target || "—"}</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${g.progress}%`, background: area.color }} /></div>
                {g.milestones.map((m) => (
                  <div className="milestone-row" key={m.id} onClick={() => toggleGoalMilestone(g.id, m.id)}>
                    <span className="dot" style={{ background: m.done ? area.color : "var(--track)" }} />
                    <span style={{ color: m.done ? "var(--text2)" : "var(--body)", textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
                  </div>
                ))}
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

function plainTextToHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML.replace(/\n/g, "<br>");
}

function htmlToPlainText(html = "") {
  if (typeof document === "undefined") return String(html).replace(/<[^>]+>/g, " ").trim();
  const div = document.createElement("div"); div.innerHTML = html; return (div.textContent || "").trim();
}

function RichTextEditor({ value, onChange, placeholder = "Write…", minHeight = 120 }) {
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
        {Object.values(TAGS).map((t) => <button key={t.hex} type="button" className="rich-btn" style={{ minWidth: 24, width: 24, padding: 0, background: t.hex, borderColor: t.hex }} title={`Highlight ${t.label}`} onMouseDown={(e) => { e.preventDefault(); command("hiliteColor", t.hex); }} />)}
        <button type="button" className="rich-btn" onMouseDown={(e) => { e.preventDefault(); command("removeFormat"); }} title="Clear formatting">Clear</button>
      </div>
      <div ref={ref} className="rich-editor" style={{ minHeight }} contentEditable suppressContentEditableWarning data-placeholder={placeholder} onInput={() => { rememberSelection(); commit(); }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={() => { rememberSelection(); commit(); }} />
    </div>
  );
}

/* ---------------------------------------------------------------
   JOURNAL TAB — add / edit / delete
----------------------------------------------------------------*/
function JournalTab({ entries, setEntries }) {
  const [entryDate, setEntryDate] = useState(REFERENCE_DATE_KEY);
  const [ref, setRef] = useState("");
  const [noteHtml, setNoteHtml] = useState("");
  const [tag, setTag] = useState("yellow");
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState(REFERENCE_DATE_KEY);
  const [editRef, setEditRef] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [editTag, setEditTag] = useState("yellow");
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const streak = journalStreak(entries);

  const save = () => {
    if (!htmlToPlainText(noteHtml) && !ref.trim()) return;
    setEntries((p) => [{ id: Date.now(), dateKey: entryDate, date: formatDateLabel(entryDate), ref: ref || "", tag, note: htmlToPlainText(noteHtml), richTextHtml: noteHtml }, ...p]);
    setRef(""); setNoteHtml(""); setTag("yellow");
  };
  const startEdit = (entry) => { setEditingId(entry.id); setEditDate(entry.dateKey || REFERENCE_DATE_KEY); setEditRef(entry.ref || ""); setEditHtml(entry.richTextHtml || plainTextToHtml(entry.note || "")); setEditTag(entry.tag || "yellow"); };
  const saveEdit = (id) => { setEntries((p) => p.map((e) => e.id === id ? { ...e, dateKey: editDate, date: formatDateLabel(editDate), ref: editRef, note: htmlToPlainText(editHtml), richTextHtml: editHtml, tag: editTag } : e)); setEditingId(null); };
  const remove = (id) => setEntries((p) => p.filter((e) => e.id !== id));

  return (
    <>
      <Header eyebrow={streak ? `${streak}-day streak` : "Start your first entry"} title="Time with the Lord" />
      <div className="scroll">

        <div className="card" style={{ marginBottom: 14 }}>
          <div
            onClick={() => setGlossaryOpen(!glossaryOpen)}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", gap:12 }}
          >
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>The whole system · explained</div>
              <div style={{ fontSize:12, color:"var(--text3)", marginTop:3 }}>Every color, in plain words.</div>
            </div>
            {glossaryOpen ? <ChevronDown size={17} color="var(--text3)" /> : <ChevronRight size={17} color="var(--text3)" />}
          </div>

          {glossaryOpen && (
            <div style={{ marginTop:14, display:"grid", gap:10 }}>

              <div style={{ padding:12, borderRadius:12, background:"#F4DE3D20", border:"1px solid #F4DE3D55" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:12, height:12, borderRadius:99, background:"#F4DE3D", flex:"0 0 auto" }} />
                  <strong>Yellow — The point</strong>
                </div>
                <div style={{ fontSize:12.5, color:"var(--body)", marginTop:7, lineHeight:1.5 }}>
                  The single most important line — the one thing to remember. If you could keep only one sentence from the page, this is it.
                </div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:6 }}>
                  Examples: the main idea of a chapter; the decision made in a meeting. Use sparingly — one or two peaks, not everything important.
                </div>
              </div>

              <div style={{ padding:12, borderRadius:12, background:"#5FD79A20", border:"1px solid #5FD79A55" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:12, height:12, borderRadius:99, background:"#5FD79A", flex:"0 0 auto" }} />
                  <strong>Green — Who & where</strong>
                </div>
                <div style={{ fontSize:12.5, color:"var(--body)", marginTop:7, lineHeight:1.5 }}>
                  People, groups, and places. Use it when a name shows up or when you need to remember who owns something.
                </div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:6 }}>
                  Examples: Peter, the Pharisees, Capernaum; Derek owns this.
                </div>
              </div>

              <div style={{ padding:12, borderRadius:12, background:"#F76FA620", border:"1px solid #F76FA655" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:12, height:12, borderRadius:99, background:"#F76FA6", flex:"0 0 auto" }} />
                  <strong>Pink — The cost</strong>
                </div>
                <div style={{ fontSize:12.5, color:"var(--body)", marginTop:7, lineHeight:1.5 }}>
                  The price tag — what gets given up, lost, risked, or sacrificed. Ask: “What’s the price here?”
                </div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:6 }}>
                  Examples: Jesus dying on the cross; pulling Rachelle off the newsletter for a month. Pink is what it costs; orange/purple is what to do.
                </div>
              </div>

              <div style={{ padding:12, borderRadius:12, background:"#5FC2D820", border:"1px solid #5FC2D855" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:12, height:12, borderRadius:99, background:"#5FC2D8", flex:"0 0 auto" }} />
                  <strong>Blue / Aqua — What’s ahead</strong>
                </div>
                <div style={{ fontSize:12.5, color:"var(--body)", marginTop:7, lineHeight:1.5 }}>
                  Future promises, plans, deadlines, and what will happen. Ask: “Is this about later?”
                </div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:6 }}>
                  Examples: God’s promise to Abraham; a project deadline. Blue is what will happen or is promised; orange/purple is what you need to do.
                </div>
              </div>

              <div style={{ padding:12, borderRadius:12, background:"#F6A23C20", border:"1px solid #F6A23C55" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:12, height:12, borderRadius:99, background:"#F6A23C", flex:"0 0 auto" }} />
                  <span style={{ width:12, height:12, borderRadius:99, background:"#A98BE0", flex:"0 0 auto" }} />
                  <strong>Orange / Purple — What to do</strong>
                </div>
                <div style={{ fontSize:12.5, color:"var(--body)", marginTop:7, lineHeight:1.5 }}>
                  An action, command, task, or to-do. Ask: “So what do I do?”
                </div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:6 }}>
                  Examples: Love one another; I draft comms by Friday. Kindle uses orange and Apple uses purple for the same job.
                </div>
              </div>

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

        <div className="card journal-compose">
          <input type="date" className="input-line" style={{ marginTop: 0 }} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <input placeholder="Scripture reference (e.g. Psalm 23:1)" style={{ width: "100%", background: "transparent", border: "none", color: "var(--text)", fontSize: 14.5, fontWeight: 600, outline: "none", marginTop: 10 }} value={ref} onChange={(e) => setRef(e.target.value)} />
          <div style={{ marginTop: 10 }}><RichTextEditor value={noteHtml} onChange={setNoteHtml} placeholder="What is He saying to you right now?" minHeight={150} /></div>
          <div className="tag-row">{Object.entries(TAGS).map(([k, v]) => <div key={k} className={`tag-swatch ${tag === k ? "selected" : ""}`} style={{ background: v.hex }} title={v.label} onClick={() => setTag(k)} />)}</div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>{TAGS[tag].label} · Select text to bold, italicize, underline, change font, or highlight it.</div>
          <div className="filter-chip active" style={{ display: "inline-flex", marginTop: 10 }} onClick={save}>Save Entry</div>
        </div>
        <div className="section-label">Entries</div>
        <div className="card">
          {entries.length ? entries.map((entry) => <div key={entry.id} className="journal-entry">
            {editingId === entry.id ? <><input type="date" className="input-line" style={{ marginTop: 0 }} value={editDate} onChange={(ev) => setEditDate(ev.target.value)} /><input className="input-line" value={editRef} onChange={(ev) => setEditRef(ev.target.value)} placeholder="Scripture reference" /><div style={{ marginTop: 8 }}><RichTextEditor value={editHtml} onChange={setEditHtml} placeholder="Journal note" minHeight={140} /></div><div className="tag-row">{Object.entries(TAGS).map(([k, v]) => <div key={k} className={`tag-swatch ${editTag === k ? "selected" : ""}`} style={{ background: v.hex }} onClick={() => setEditTag(k)} />)}</div><div style={{ display: "flex", gap: 8, marginTop: 10 }}><div className="filter-chip active" onClick={() => saveEdit(entry.id)}>Save</div><div className="filter-chip" onClick={() => setEditingId(null)}>Cancel</div></div></> : <><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="verse-badge" style={{ background: TAGS[entry.tag]?.hex || TAGS.yellow.hex }}>{entry.ref || "Check-in"}</span><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 12, color: "var(--text3)" }}>{entry.date || formatDateLabel(entry.dateKey || REFERENCE_DATE_KEY)}</span><div className="entry-actions"><Pencil size={13} color="var(--text3)" onClick={() => startEdit(entry)} /><Trash2 size={13} color="var(--text3)" onClick={() => remove(entry.id)} /></div></div></div>{entry.richTextHtml ? <div className="rich-output" dangerouslySetInnerHTML={{ __html: entry.richTextHtml }} /> : <div className="rich-output">{entry.note || "Time with the Lord check-in"}</div>}</>}
          </div>) : <div className="insight-line">No journal entries yet.</div>}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   SCRATCHBOOK — add / edit / delete, typed + Apple Pencil drawing
----------------------------------------------------------------*/
function ScratchTab() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [tool, setTool] = useState("draw");
  const [color, setColor] = useState("#141A28");
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const canvasMetrics = useRef({ width: 380, height: 260, dpr: 1 });
  const [pages, setPages] = usePersistentState("abide-scratch-pages", []);
  const [typedDraft, setTypedDraft] = useState("");
  const [editingId, setEditingId] = useState(null);

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
    const width = Math.max(1, rect.width || 380);
    const height = width * (260 / 380);
    const dpr = Math.max(1, window.devicePixelRatio || 1);

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
    const frame = requestAnimationFrame(() => resizeCanvas(false));
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resizeCanvas(true)) : null;
    if (observer && wrapRef.current) observer.observe(wrapRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  const getPos = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const e = event.nativeEvent || event;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : (e.pointerType === "pen" ? 0.35 : 0.5);
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure };
  };

  const onDown = (e) => {
    e.preventDefault();
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
  };

  const onUp = (e) => {
    drawing.current = false;
    lastPoint.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const clearCanvas = () => {
    paintPaper();
    drawing.current = false;
    lastPoint.current = null;
  };

  const saveDrawing = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    if (editingId) {
      setPages((prev) => prev.map((pg) => pg.id === editingId ? { ...pg, type: "draw", content: dataUrl } : pg));
      setEditingId(null);
    } else {
      setPages((prev) => [{ id: Date.now(), type: "draw", content: dataUrl, date: "Today" }, ...prev]);
    }
    clearCanvas();
  };

  const saveTyped = () => {
    if (!htmlToPlainText(typedDraft)) return;
    if (editingId) {
      setPages((prev) => prev.map((pg) => pg.id === editingId ? { ...pg, type: "type", content: typedDraft, contentHtml: typedDraft } : pg));
      setEditingId(null);
    } else {
      setPages((prev) => [{ id: Date.now(), type: "type", content: typedDraft, contentHtml: typedDraft, date: formatDateLabel(REFERENCE_DATE_KEY) }, ...prev]);
    }
    setTypedDraft("");
  };

  const editPage = (pg) => {
    setEditingId(pg.id);
    if (pg.type === "type") {
      setTool("type");
      setTypedDraft(pg.contentHtml || (String(pg.content || "").includes("<") ? pg.content : plainTextToHtml(pg.content || "")));
      return;
    }

    setTool("draw");
    requestAnimationFrame(() => {
      resizeCanvas(false);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const { width, height, dpr } = canvasMetrics.current;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = pg.content;
    });
  };

  const deletePage = (id) => {
    setPages((prev) => prev.filter((pg) => pg.id !== id));
    if (editingId === id) {
      setEditingId(null);
      clearCanvas();
      setTypedDraft("");
    }
  };

  return (
    <>
      <Header eyebrow="Type, or use Apple Pencil on iPad" title="Scratchbook" />
      <div className="scroll">
        <div className="segmented">
          <div className={`seg-btn ${tool === "draw" ? "active" : ""}`} onClick={() => setTool("draw")}>Draw</div>
          <div className={`seg-btn ${tool === "type" ? "active" : ""}`} onClick={() => setTool("type")}>Type</div>
        </div>
        {editingId && <div className="insight-line" style={{ padding: "0 4px 10px 4px" }}>Editing a saved page — save to update it, or delete it below.</div>}
        {tool === "draw" ? (
          <>
            <div className="scratch-toolbar">
              <div style={{ display: "flex", gap: 8 }}>{["#141A28", "#E8B45C", "#8FA88A", "#D98595", "#7C93C9"].map((c) => <div key={c} className={`swatch-mini ${color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
              <div style={{ display: "flex", gap: 8 }}><div className="tool-btn" onClick={clearCanvas}><Trash2 size={16} /></div><div className="tool-btn active" onClick={saveDrawing}><Check size={16} /></div></div>
            </div>
            <div ref={wrapRef} className="scratch-canvas-wrap">
              <canvas
                ref={canvasRef}
                style={{ width: "100%", aspectRatio: "380 / 260", display: "block", touchAction: "none" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onPointerLeave={(e) => { if (drawing.current && e.buttons === 0) onUp(e); }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}><PenTool size={12} />High-resolution, pressure-sensitive canvas calibrated to the visible page for finger, mouse, or Apple Pencil.</div>
          </>
        ) : (
          <>
            <RichTextEditor value={typedDraft} onChange={setTypedDraft} placeholder="Jot it down…" minHeight={180} />
            <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>Select text to bold, italicize, underline, change font, or highlight it.</div>
            <div className="filter-chip active" style={{ display: "inline-flex", marginTop: 10 }} onClick={saveTyped}><Type size={12} />{editingId ? "Update Note" : "Save Note"}</div>
          </>
        )}
        <div className="section-label">Past Pages</div>
        <div className="scratch-grid">
          {pages.map((pg) => (
            <div key={pg.id} className="scratch-item card">
              {pg.type === "draw" ? <img src={pg.content} className="scratch-thumb" alt="scratch page" /> : <div style={{ padding: 10, fontSize: 12.5, color: "var(--body2)", minHeight: 70, lineHeight: 1.45 }} dangerouslySetInnerHTML={{ __html: pg.contentHtml || (String(pg.content || "").includes("<") ? pg.content : plainTextToHtml(pg.content || "")) }} />}
              <div className="cap"><span>{pg.date}</span><span className="cap-icons"><Pencil size={12} onClick={() => editPage(pg)} /><Trash2 size={12} onClick={() => deletePage(pg.id)} /></span></div>
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
  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const rows = [{ k: "tasks", label: "Task reminders" }, { k: "calendar", label: "Calendar event alerts" }, { k: "review", label: "Weekly review nudge" }, { k: "streak", label: "Journal streak reminder" }, { k: "milestones", label: "Goal milestone alerts" }];
  const reminders = tasks.filter((t) => !t.done && t.reminder && t.reminder !== "None").sort((a, b) => taskDateKey(a).localeCompare(taskDateKey(b)));

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") { setPermission("unsupported"); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") new Notification("Abide notifications enabled", { body: "Task reminders can now appear on this device while Abide is running." });
  };

  const testNotification = () => {
    if (permission !== "granted") return;
    new Notification("Abide test reminder", { body: "Notifications are working on this device." });
  };

  useEffect(() => {
    if (permission !== "granted" || !prefs.tasks) return;
    const check = () => {
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
        <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "7px 4px 0" }}>These notifications work while Abide is running. True background push when Abide is fully closed requires the next backend step: Firestore task storage + Firebase Cloud Messaging.</div>

        <div className="section-label">Upcoming Notifications</div>
        <div className="card">{reminders.length ? reminders.map((t) => <div key={t.id} className="review-item" style={{ cursor: "pointer" }} onClick={() => setEditingTask(t)}><span><strong>{t.title}</strong><span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>{formatDateLabel(taskDateKey(t))}{t.dueTime ? ` · ${formatTimeLabel(t.dueTime)}` : ""}</span></span><span className="review-count">{t.reminder}</span></div>) : <div className="insight-line">No task reminders scheduled yet.</div>}</div>
        <div className="section-label">Notification Types</div>
        <div className="card">{rows.map((r) => <div key={r.k} className="settings-row"><span className="settings-row-name">{r.label}</span><Toggle on={prefs[r.k]} onClick={() => toggle(r.k)} /></div>)}</div>
      </div>
    </>
  );
}

function NotificationCenter({ onBack, tasks = [] }) {
  const [prefs, setPrefs] = usePersistentState("abide-notification-prefs", { tasks: true, calendar: true, review: true, streak: true, milestones: true });
  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const rows = [{ k: "tasks", label: "Task reminders" }, { k: "calendar", label: "Calendar event alerts" }, { k: "review", label: "Weekly review nudge" }, { k: "streak", label: "Journal streak reminder" }, { k: "milestones", label: "Goal milestone alerts" }];
  const reminders = tasks.filter((t) => !t.done && t.reminder && t.reminder !== "None").sort((a, b) => taskDateKey(a).localeCompare(taskDateKey(b)));
  return <><Header eyebrow="Insights" title="Notification Center" onBack={onBack} /><div className="scroll"><div className="section-label">What Alerts You</div><div className="card">{rows.map((r) => <div key={r.k} className="settings-row"><span className="settings-row-name">{r.label}</span><Toggle on={prefs[r.k]} onClick={() => toggle(r.k)} /></div>)}</div><div className="section-label">Upcoming</div><div className="card">{reminders.length ? reminders.map((t) => <div key={t.id} className="review-item"><span>{t.title}</span><span className="review-count">{t.reminder}</span></div>) : <div className="insight-line">No notifications yet.</div>}</div></div></>;
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
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>{DAYS_OF_WEEK.map((d) => <div key={d} className={`filter-chip ${day === d ? "active" : ""}`} onClick={() => setDay(d)}>{d}</div>)}</div>
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

function SettingsScreen({ onBack, theme, setTheme, protectedBlocks, setProtectedBlocks, areas, setAreas, onDeleteArea, onOpenCalendar }) {
  const [blockComposer, setBlockComposer] = useState(null);
  const [areaComposer, setAreaComposer] = useState(null); // null | "add" | areaId
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

  return (
    <>
      <Header eyebrow="Insights" title="Settings" onBack={onBack} />
      <div className="scroll">
        <div className="section-label">Appearance</div>
        <div className="segmented"><div className={`seg-btn ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}>Light</div><div className={`seg-btn ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}>Dark</div></div>

        <div className="section-label"><span>Areas</span><Plus size={14} color="#E8B45C" style={{ cursor: "pointer" }} onClick={() => setAreaComposer(areaComposer === "add" ? null : "add")} /></div>
        {areaComposer === "add" && <AreaComposer onSave={saveArea} onCancel={() => setAreaComposer(null)} />}
        <div className="card">
          {Object.entries(areas).map(([id, area]) => areaComposer === id ? <AreaComposer key={id} initial={{ id, ...area }} onSave={saveArea} onCancel={() => setAreaComposer(null)} /> : (
            <div className="settings-row" key={id}>
              <div className="settings-row-name"><span className="cal-swatch" style={{ background: area.color }} />{area.name}</div>
              <div style={{ display: "flex", gap: 12 }}><Pencil size={14} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => setAreaComposer(id)} /><Trash2 size={14} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => { if (window.confirm(`Delete the "${area.name}" area? Tasks and goals using it will become unassigned.`)) onDeleteArea(id); }} /></div>
            </div>
          ))}
          {Object.keys(areas).length === 0 && <div className="insight-line">No areas yet. Add one with the + button.</div>}
        </div>
        <div className="insight-line" style={{ padding: "8px 4px" }}>Rename or recolor an Area with the pencil. Deleting it keeps existing tasks and goals but makes them “No Area.”</div>

        <div className="section-label"><span>Protected Time Blocks</span><Plus size={14} color="#E8B45C" style={{ cursor: "pointer" }} onClick={() => setBlockComposer(blockComposer === "add" ? null : "add")} /></div>
        {blockComposer === "add" && <ProtectedBlockComposer onSave={saveBlock} onCancel={() => setBlockComposer(null)} />}
        <div className="card">{protectedBlocks.length ? protectedBlocks.map((b) => blockComposer === b.id ? <ProtectedBlockComposer key={b.id} initial={b} onSave={saveBlock} onCancel={() => setBlockComposer(null)} /> : <ProtectedBlockRow key={b.id} block={b} onEdit={() => setBlockComposer(b.id)} onDelete={() => deleteBlock(b.id)} />) : <div className="insight-line">No protected time blocks yet.</div>}</div>

        <div className="section-label">Connected Calendars</div>
        <div className="card"><div className="nav-row" onClick={onOpenCalendar}><div className="nav-row-left"><CalendarDays size={16} color="#8FA88A" />Manage calendars in Calendar</div><ChevronRight size={16} color="var(--text3)" /></div></div>

        <div className="section-label">Abide</div>
        <div className="card">
          <div className="settings-row">
            <span className="settings-row-name">Version</span>
            <span style={{ fontSize: 12.5, color: "var(--text2)" }}>v{APP_VERSION}</span>
          </div>

          <div className="settings-row">
            <span className="settings-row-name">Updated</span>
            <span style={{ fontSize: 12.5, color: "var(--text2)" }}>
              {new Date(APP_BUILD_DATE).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-row-name">
                {updateAvailable ? "Update available" : "App updates"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>
                {updateAvailable
                  ? "A newer version is ready to install."
                  : updateMessage || "Abide checks automatically when you return to the app."}
              </div>
            </div>

            <div
              className={`filter-chip ${updateAvailable ? "active" : ""}`}
              style={{
                opacity: updateChecking ? 0.65 : 1,
                pointerEvents: updateChecking ? "none" : "auto",
                flexShrink: 0,
              }}
              onClick={updateAvailable ? updateNow : checkForUpdatesNow}
            >
              <RefreshCw size={12} />
              {updateAvailable
                ? "Update now"
                : updateChecking
                  ? "Checking…"
                  : "Check for updates"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "7px 4px 0" }}>
          Future Abide releases can be installed here without deleting the Home Screen app.
        </div>

        <div className="section-label">Account</div>
        <div className="card"><div className="settings-row"><span className="settings-row-name">lamound2407@gmail.com</span></div><div className="settings-row"><span className="settings-row-name" style={{ color: "var(--text3)" }}>Sign out will be enabled when Firebase Auth is wired to this screen.</span></div></div>
      </div>
    </>
  );
}


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

function ReviewTab({ tasks, goals, protectedBlocks, areas, onOpen, onOpenAdd, onCreateTask, onUpdateTask, onDeleteTask, onCreateArea }) {
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


function InsightsTab({ theme, setTheme, protectedBlocks, setProtectedBlocks, areas, setAreas, onDeleteArea, tasks, goals, journalEntries, setJournalEntries, onOpenJournal, onOpenCalendar }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [screen, setScreen] = useState("dashboard");
  const [selectedHeatDate, setSelectedHeatDate] = useState(REFERENCE_DATE_KEY);

  if (screen === "notifications") return <NotificationCenter onBack={() => setScreen("dashboard")} tasks={tasks} />;
  if (screen === "settings") return <SettingsScreen onBack={() => setScreen("dashboard")} theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={onDeleteArea} onOpenCalendar={onOpenCalendar} />;

  const doneCount = tasks.filter((t) => t.done).length;
  const completionRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const openCount = tasks.filter((t) => !t.done).length;
  const streak = journalStreak(journalEntries);
  const overdueCount = tasks.filter((t) => !t.done && taskDateKey(t) < REFERENCE_DATE_KEY).length;
  const unassignedCount = tasks.filter((t) => !t.area).length;
  const stalledGoals = goals.filter((g) => !g.progress).length;

  const weekKeys = buildWeekKeys(REFERENCE_DATE_KEY);
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
        <div className="card insight-line" style={{ marginBottom: 14 }}>{tasks.length >= 10 ? "As you build real task history, Abide will use completion timestamps to surface patterns here." : "No pattern generated yet. This section will stay empty until there is enough real task history to support a useful observation."}</div>

        <div className="section-label">Your Tools</div>
        <div className="card"><LinkCard icon={Dumbbell} tint="#7C93C9" name="Iron Log" desc="Workout tracker" placeholder="Paste your Iron Log URL" initialUrl={IRON_LOG_URL} storageKey="abide-iron-log-url" /><LinkCard icon={Salad} tint="#8FA88A" name="Trophé" desc="Nutrition & meal-planning app" placeholder="Paste your Trophé URL" initialUrl={TROPHE_URL} storageKey="abide-trophe-url" /></div>

        <div className="section-label">More</div>
        <div className="card"><div className="nav-row" onClick={() => setScreen("notifications")}><div className="nav-row-left"><div className="nav-icon" style={{ background: "#E8B45C22" }}><Bell size={16} color="#E8B45C" /></div>Notification Center</div><ChevronRight size={16} color="var(--text3)" /></div><div className="nav-row" onClick={() => setScreen("settings")}><div className="nav-row-left"><div className="nav-icon" style={{ background: "#8FA88A22" }}><SettingsIcon size={16} color="#8FA88A" /></div>Settings</div><ChevronRight size={16} color="var(--text3)" /></div></div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   ROOT APP
----------------------------------------------------------------*/
function getViewport(w) {
  if (w < 760) return "phone";
  if (w < 1120) return "tablet";
  return "desktop";
}

export default function App() {
  const [tab, setTab] = useState("today");
  const [tasks, setTasks] = usePersistentState("abide-tasks", seedTasks);
  const [goals, setGoals] = usePersistentState("abide-goals", seedGoals);
  const [areas, setAreas] = usePersistentState("abide-areas", AREAS);
  const [journalEntries, setJournalEntries] = usePersistentState("abide-journal", seedJournal);
  const [expandedId, setExpandedId] = useState(null);
  const [theme, setTheme] = usePersistentState("abide-theme", "dark");
  const [protectedBlocks, setProtectedBlocks] = usePersistentState("abide-protected-blocks", []);
  const [quickAddSignal, setQuickAddSignal] = useState(0);
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
    const migrationKey = "abide-user-task-migration-2026-08-21-v1";
    try { if (localStorage.getItem(migrationKey)) return; } catch {}
    setAreas((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(USER_TASK_MIGRATION_AREAS).filter(([id]) => !prev[id])) }));
    setTasks((prev) => {
      const ids = new Set(prev.map((t) => String(t.id)));
      return [...USER_TASK_MIGRATION_TASKS.filter((t) => !ids.has(String(t.id))), ...prev];
    });
    try { localStorage.setItem(migrationKey, "1"); } catch {}
  }, []);


  useEffect(() => {
    const migrationKey = "abide-user-task-migration-2026-08-21-v2-work-margin";
    try { if (localStorage.getItem(migrationKey)) return; } catch {}
    setAreas((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(USER_TASK_MIGRATION_WORK_MARGIN_AREAS).filter(([id]) => !prev[id])) }));
    setTasks((prev) => {
      const ids = new Set(prev.map((t) => String(t.id)));
      return [...USER_TASK_MIGRATION_WORK_MARGIN_TASKS.filter((t) => !ids.has(String(t.id))), ...prev];
    });
    try { localStorage.setItem(migrationKey, "1"); } catch {}
  }, []);

  const toggleDone = (id) => setTasks((prev) => {
    const task = prev.find((t) => t.id === id);
    if (!task) return prev;
    if (!task.done && task.recurrence?.freq) {
      const nextDate = nextRecurrenceDate(taskDateKey(task), task.recurrence);
      const completed = prev.map((t) => t.id === id ? { ...t, done: true, completedAt: new Date().toISOString() } : t);
      if (!nextDate) return completed;
      const nextTask = { ...task, id: `rec_${Date.now()}`, done: false, completedAt: null, dueDate: nextDate, dueOffsetDays: offsetFromDateKey(nextDate), due: task.dueTime ? formatTimeLabel(task.dueTime) : formatDateLabel(nextDate), parentRecurringId: task.parentRecurringId || task.id };
      return [nextTask, ...completed];
    }
    return prev.map((t) => t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null } : t);
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
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      reminder: task.reminder || "None",
      status: task.status || "next",
      done: Boolean(task.done),
    };
    setTasks((prev) => [{ id, ...normalized }, ...prev]);
    return id;
  };
  const createArea = ({ name, color = "#8FA88A" }) => {
    const id = `area_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setAreas((prev) => ({ ...prev, [id]: { name: String(name || "").trim(), color } }));
    return id;
  };
  const deleteArea = (id) => {
    setAreas((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTasks((prev) => prev.map((t) => t.area === id ? { ...t, area: null } : t));
    setGoals((prev) => prev.map((g) => g.area === id ? { ...g, area: null } : g));
  };
  const openGlobalAdd = () => { setTab("calendar"); setQuickAddSignal((n) => n + 1); };

  const tabs = [
    { id: "today", label: "Today", icon: ListTodo },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "review", label: "Review", icon: RefreshCw },
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "more", label: "More", icon: SettingsIcon },
  ];

  const vars = {
    "--pageBg": tk.pageBg, "--appBg": tk.appBg, "--shadow": tk.shadow, "--card": tk.card, "--cardBorder": tk.cardBorder,
    "--text": tk.text, "--text2": tk.text2, "--text3": tk.text3, "--body": tk.body, "--body2": tk.body2,
    "--pillBg": tk.pillBg, "--pillBorder": tk.pillBorder, "--inputBg": tk.inputBg, "--inputBorder": tk.inputBorder,
    "--track": tk.track, "--divider": tk.divider, "--subtleBg": tk.subtleBg, "--tabbarBg": tk.tabbarBg,
    "--segActive": tk.segActive, "--protectedText": tk.protectedText, "--emptyHeat": tk.emptyHeat,
  };

  const activeTab = (
    <>
      {tab === "today" && <TodayTab tasks={tasks} goals={goals} areas={areas} expandedId={expandedId} setExpandedId={setExpandedId} toggleDone={toggleDone} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateTask={createTask} onCreateArea={createArea} />}
      {tab === "calendar" && <CalendarTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} areas={areas} toggleDone={toggleDone} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateTask={createTask} openAddSignal={quickAddSignal} onCreateArea={createArea} />}
      {tab === "review" && <ReviewTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} areas={areas} onOpen={setTab} onOpenAdd={openGlobalAdd} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateArea={createArea} />}
      {tab === "goals" && <GoalsTab goals={goals} setGoals={setGoals} viewport={viewport} areas={areas} onCreateArea={createArea} />}
      {tab === "journal" && <JournalTab entries={journalEntries} setEntries={setJournalEntries} />}
      {tab === "scratch" && <ScratchTab />}
      {tab === "reminders" && <RemindersTab tasks={tasks} goals={goals} areas={areas} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateArea={createArea} />}
      {tab === "insights" && <InsightsTab theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={deleteArea} tasks={tasks} goals={goals} journalEntries={journalEntries} setJournalEntries={setJournalEntries} onOpenJournal={() => setTab("journal")} onOpenCalendar={() => setTab("calendar")} />}
      {tab === "more" && <MoreTab onOpen={setTab} theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={deleteArea} onOpenCalendar={() => setTab("calendar")} />}
    </>
  );

  return (
    <div className={`viewport-${viewport}`} style={{ display: "flex", justifyContent: viewport === "phone" ? "center" : "stretch", padding: 0, background: viewport === "phone" ? tk.appBg : tk.pageBg, height: "100vh", minHeight: "100vh", width: "100%", overflow: "hidden", ...vars }}>
      <style>{styles}</style>
      <PwaUpdateBanner />
      {viewport === "phone" ? (
        <div className="app">
          <div className="statusbar"><span className="brand"><img className="brand-mark" src="/abide-logo.png" alt="" /><span className="brand-word">{APP_NAME.toUpperCase()}</span></span><div className="theme-toggle" style={{ cursor: "pointer" }} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon size={15} color="#E8B45C" /> : <Sun size={15} color="#D69A3A" />}</div></div>
          <div className="phone-content">{activeTab}</div>
          <button className="fab" onClick={openGlobalAdd} aria-label="Add task or event"><Plus size={24} strokeWidth={2.5} /></button>
          <div className="tabbar">{tabs.map((t) => { const Icon = t.icon; const active = navTabIsActive(tab, t.id); return <div key={t.id} className={`tab ${active ? "active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setTab(t.id)}><Icon size={20} strokeWidth={active ? 2.3 : 1.8} /><span>{t.label}</span></div>; })}</div>
        </div>
      ) : (
        <div className="shell"><Sidebar tabs={tabs} tab={tab} setTab={setTab} viewport={viewport} theme={theme} setTheme={setTheme} /><div className="shell-main">{activeTab}<button className="fab shell-fab" onClick={openGlobalAdd} aria-label="Add task or event"><Plus size={24} strokeWidth={2.5} /></button></div></div>
      )}
    </div>
  );
}
