import React, { useState, useRef, useEffect } from "react";
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

const styles = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .app { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif; background: var(--appBg); color: var(--text); width: 100%; max-width: 430px; margin: 0 auto; height: 850px; max-height: 92vh; border-radius: 40px; overflow: hidden; position: relative; box-shadow: var(--shadow); display: flex; flex-direction: column; }
  .statusbar { height: 30px; flex-shrink:0; position:relative; display:flex; align-items:center; justify-content:space-between; padding: 0 18px; }
  .brand { font-size: 12px; font-weight: 700; color: var(--text3); letter-spacing: 0.5px; }
  .theme-toggle { width:28px; height:28px; border-radius:50%; background: var(--pillBg); display:flex; align-items:center; justify-content:center; }
  .scroll { flex: 1; overflow-y: auto; padding: 0 18px 110px 18px; }
  .scroll::-webkit-scrollbar { display: none; }

  .header { padding: 8px 18px 6px 18px; flex-shrink: 0; display:flex; align-items:flex-start; justify-content:space-between; }
  .eyebrow { font-size: 13px; color: var(--text2); font-weight: 500; letter-spacing: 0.2px; }
  .largetitle { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; color: var(--text); margin-top: 2px; }
  .header-actions { display:flex; gap:8px; margin-top:6px; }
  .header-btn { width:34px; height:34px; border-radius:10px; background: var(--pillBg); display:flex; align-items:center; justify-content:center; position:relative; }
  .header-btn .dot-badge { position:absolute; top:-2px; right:-2px; width:8px; height:8px; border-radius:50%; background:#E68080; border:1.5px solid var(--appBg); }
  .back-row { display:flex; align-items:center; gap:4px; color: var(--text2); font-size:14px; font-weight:600; cursor:pointer; padding: 2px 0 4px 0; }

  .capture-bar { display: flex; align-items: center; gap: 10px; background: var(--pillBg); border: 1px solid var(--pillBorder); border-radius: 14px; padding: 11px 14px; margin: 14px 0 14px 0; color: var(--text2); font-size: 15px; }

  .filter-row { display:flex; gap:7px; overflow-x:auto; padding: 2px 0 12px 0; align-items:center; }
  .filter-row::-webkit-scrollbar { display:none; }
  .filter-chip { flex-shrink:0; font-size: 12.5px; font-weight: 600; padding: 7px 12px; border-radius: 20px; border: 1px solid var(--pillBorder); color: var(--text2); background: var(--pillBg); display:flex; align-items:center; gap:5px; white-space:nowrap; cursor:pointer; }
  .filter-chip.active { background: #E8B45C; color: #14100A; border-color:#E8B45C; }
  .filter-chip .x { opacity:0.7; margin-left:2px; }

  .filter-builder, .composer-card { padding:14px; margin-bottom:12px; }
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

  .tabbar { position: absolute; bottom: 0; left: 0; right: 0; height: 88px; background: var(--tabbarBg); backdrop-filter: blur(20px); border-top: 1px solid var(--divider); display: flex; align-items: flex-start; padding-top: 10px; }
  .tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text3); }
  .tab.active { color: #E8B45C; }
  .tab span { font-size: 9.5px; font-weight: 600; }

  .fab { position: absolute; right: 20px; bottom: 100px; width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(155deg, #E8B45C, #D69A3A); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(232,180,92,0.35); border: none; color: #14100A; }

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
  .toggle { width:40px; height:23px; border-radius:12px; background: var(--track); position:relative; flex-shrink:0; }
  .toggle.on { background:#E8B45C; }
  .toggle .knob { width:19px; height:19px; border-radius:50%; background:#fff; position:absolute; top:2px; left:2px; transition:left .15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .toggle.on .knob { left:19px; }
  .link-others { font-size:12.5px; color:#E8B45C; font-weight:600; margin-top:10px; cursor:pointer; }

  .input-line { width:100%; background: var(--inputBg); border: 1px solid var(--inputBorder); border-radius: 10px; padding: 10px 12px; color: var(--text); font-size: 14px; font-family: inherit; margin-top: 8px; }

  .scratch-canvas-wrap { border-radius: 14px; overflow:hidden; border: 1px solid var(--cardBorder); background:#F2F1EC; touch-action: none; }
  .scratch-toolbar { display:flex; align-items:center; justify-content:space-between; padding: 4px 2px 12px 2px; }
  .tool-btn { width:36px; height:36px; border-radius:10px; background: var(--pillBg); display:flex; align-items:center; justify-content:center; color: var(--text2); }
  .tool-btn.active { background:#E8B45C; color:#14100A; }
  .swatch-mini { width:22px; height:22px; border-radius:50%; border:2px solid transparent; }
  .swatch-mini.selected { border-color: var(--text); }
  .scratch-thumb { width:100%; aspect-ratio: 4/3; object-fit:cover; background:#F2F1EC; }
  .scratch-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px; }
  .scratch-item { border-radius:12px; overflow:hidden; border:1px solid var(--cardBorder); position:relative; }
  .scratch-item .cap { font-size:11px; color: var(--text2); padding:6px 8px; display:flex; justify-content:space-between; align-items:center; }
  .scratch-item .cap-icons { display:flex; gap:8px; }

  .review-item { display:flex; align-items:center; justify-content:space-between; padding: 11px 14px; border-bottom:1px solid var(--divider); font-size:13.5px; color: var(--body); }
  .review-item:last-child{border-bottom:none;}
  .review-count { background:rgba(232,180,92,0.18); color:#E8B45C; font-weight:700; font-size:12px; padding:2px 9px; border-radius:8px; }

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
  .shell { display:flex; width:100%; height:100%; background: var(--appBg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif; overflow:hidden; }
  .sidebar { display:flex; flex-direction:column; background: var(--card); border-right:1px solid var(--cardBorder); flex-shrink:0; height:100%; overflow-y:auto; }
  .sidebar-compact { width:88px; align-items:center; padding:20px 0 14px 0; }
  .sidebar-wide { width:238px; padding:24px 14px 16px 14px; }
  .sidebar-brand { font-weight:800; color: var(--text); margin-bottom:26px; }
  .sidebar-compact .sidebar-brand { font-size:16px; color:#E8B45C; }
  .sidebar-wide .sidebar-brand { font-size:20px; letter-spacing:-0.3px; padding-left:10px; }
  .sidebar-nav { display:flex; flex-direction:column; gap:4px; flex:1; width:100%; }
  .sidebar-item { display:flex; align-items:center; gap:12px; color: var(--text3); padding:11px 14px; border-radius:10px; cursor:pointer; }
  .sidebar-item span { font-size:14px; font-weight:600; }
  .sidebar-item.active { background: var(--pillBg); color:#E8B45C; }
  .sidebar-compact .sidebar-item { flex-direction:column; gap:5px; padding:10px 6px; width:64px; }
  .sidebar-compact .sidebar-item span { font-size:9.5px; }
  .sidebar-footer { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; color: var(--text2); font-size:13px; font-weight:600; margin-top:10px; border-top: 1px solid var(--divider); padding-top:16px; }
  .sidebar-compact .sidebar-footer { flex-direction:column; padding:14px 4px 0 4px; }
  .shell-main { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
  .shell-fab { position:absolute; right:32px; bottom:32px; }

  .viewport-tablet .header, .viewport-desktop .header { padding-left:32px; padding-right:32px; padding-top:20px; }
  .viewport-tablet .scroll, .viewport-desktop .scroll { padding-left:32px; padding-right:32px; padding-bottom:50px; }
  .viewport-desktop .header, .viewport-desktop .scroll { max-width:960px; margin:0 auto; width:100%; box-sizing:border-box; }
  .viewport-tablet .largetitle { font-size:33px; }
  .viewport-desktop .largetitle { font-size:36px; }
  .viewport-tablet .stat-grid, .viewport-desktop .stat-grid { grid-template-columns: repeat(4, 1fr); }
  .viewport-tablet .scratch-grid, .viewport-desktop .scratch-grid { grid-template-columns: repeat(3, 1fr); }
  .viewport-desktop .goal-grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px; align-items:start; }
  .viewport-desktop .goal-grid .goal-card { margin-bottom:0; }
  .viewport-desktop .goal-grid .composer-card { grid-column: 1 / -1; }
`;

/* ---------------------------------------------------------------
   MOCK DATA
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

const seedTasks = [
  { id: 1, title: "Update Notion phase headers for Margin launch", area: "margin", due: "Yesterday", dueOffsetDays: -1, priority: "high", notes: "", repeat: null, reminder: "9:00 AM day of", done: false, goal: "g1" },
  { id: 2, title: "Send CMC follow-up email", area: "chialpha", due: "10:00 AM", dueOffsetDays: 0, priority: "high", notes: "Reply to Brian's thread first.", repeat: null, reminder: "15 min before", done: false, goal: null },
  { id: 3, title: "Write Psalm 23 devotional — Day 3 draft", area: "margin", due: "2:00 PM", dueOffsetDays: 0, priority: "med", notes: "", repeat: "Tue / Thu", reminder: "At time", done: false, goal: "g1" },
  { id: 4, title: "Iron Log — log today's lift", area: "personal", due: "6:00 PM", dueOffsetDays: 0, priority: "low", notes: "", repeat: "Daily", reminder: "None", done: false, goal: null },
  { id: 5, title: "Review Rachelle's creative brief drafts", area: "chialpha", due: "Today", dueOffsetDays: 0, priority: "med", notes: "", repeat: null, reminder: "None", done: true, goal: null },
  { id: 6, title: "Call venue re: seating chart printing", area: "wedding", due: "Tue, Aug 25", dueOffsetDays: 4, priority: "med", notes: "", repeat: null, reminder: "1 day before", done: false, goal: "g2" },
  { id: 7, title: "Fix garage door sensor", area: "home", due: "Sat, Aug 22", dueOffsetDays: 1, priority: "low", notes: "", repeat: null, reminder: "None", done: false, goal: null },
  { id: 8, title: "Read — Atomic Habits, ch. 6", area: "personal", due: "Sun, Aug 23", dueOffsetDays: 2, priority: "low", notes: "", repeat: "Weekly", reminder: "None", done: false, goal: "g3" },
  { id: 9, title: "The Margin — Day 5 devotional draft", area: "margin", due: "Thu, Aug 27", dueOffsetDays: 6, priority: "high", notes: "", repeat: "Tue / Thu", reminder: "15 min before", done: false, goal: "g1" },
  { id: 10, title: "Draft September newsletter outline", area: "chialpha", due: "Sat, Aug 30", dueOffsetDays: 9, priority: "med", notes: "", repeat: null, reminder: "None", done: false, goal: null },
  { id: 11, title: "Order wedding favors", area: "wedding", due: "Tue, Sep 1", dueOffsetDays: 11, priority: "med", notes: "", repeat: null, reminder: "1 day before", done: false, goal: "g2" },
  { id: 12, title: "Project Oἰκία — paint trim", area: "home", due: "Thu, Sep 3", dueOffsetDays: 13, priority: "low", notes: "", repeat: null, reminder: "None", done: false, goal: null },
];

const somedayTasks = [
  { id: 101, title: "Explore self-hosted AI agent architecture", area: "personal" },
  { id: 102, title: "Write Margin series on Sabbath & rest", area: "margin" },
  { id: 103, title: "Repaint Project Oἰκία guest room", area: "home" },
];

const seedGoals = [
  { id: "g1", area: "margin", name: "The Margin — Public Launch", target: "Sep 14", notes: "Everything routes through the Sep 14 date. Soft launch Aug 24 is the real-world test run.",
    milestones: [
      { id: "m1", label: "Brand & launch strategy", done: true },
      { id: "m2", label: "Platform launch copy", done: true },
      { id: "m3", label: "Soft launch — Aug 24", done: false },
      { id: "m4", label: "Day 1–7 devotionals (4/7)", done: false },
    ] },
  { id: "g2", area: "wedding", name: "Wedding Day Ready", target: "Oct 18", notes: "",
    milestones: [
      { id: "m5", label: "Seating chart built", done: true },
      { id: "m6", label: "Catering finalized", done: false },
      { id: "m7", label: "Honeymoon itinerary — Disney", done: true },
    ] },
  { id: "g3", area: "personal", name: "Read 12 Books in 2026", target: "Dec 31", notes: "",
    milestones: [
      { id: "m8", label: "5 of 12 finished", done: false },
      { id: "m9", label: "Atomic Habits — in progress", done: false },
    ] },
];

const seedJournal = [
  { id: 1, date: "Aug 19", ref: "Psalm 23:1", tag: "yellow", note: "Contentment isn't the absence of need — it's trusting who's providing. Wedding season is loud; this verse is an anchor, not an escape." },
  { id: 2, date: "Aug 17", ref: "John 15:5", tag: "green", note: "Abiding, not hustling. Thinking about how Chi Alpha work can become fruitless activity if it's disconnected from actually staying near Him first." },
  { id: 3, date: "Aug 14", ref: "Matthew 11:28-30", tag: "blue", note: "'Easy yoke' — want a rhythm where time with Him doesn't get pushed around by whatever's loudest that week." },
];

const weekBars = [
  { d: "M", done: 5 }, { d: "T", done: 8 }, { d: "W", done: 4 },
  { d: "T", done: 9 }, { d: "F", done: 6 }, { d: "S", done: 3 }, { d: "S", done: 2 },
];
const areaSplit = Object.entries(AREAS).map(([k, v]) => ({
  name: v.name, value: [9, 14, 6, 5, 3][Object.keys(AREAS).indexOf(k)], color: v.color,
}));

const CALENDARS = [
  { id: "c1", label: "Tyler Lamound", email: "lamound2407@gmail.com", color: "#8FA88A" },
  { id: "c2", label: "Wedding — Tyler & Elizabeth", email: "tylerandelizabethharris@gmail.com", color: "#D98595" },
  { id: "c3", label: "Chi Alpha Work", email: "tyler@chialpha.com", color: "#7C93C9" },
  { id: "c4", label: "Ministry", email: "tylerlamoundministry@gmail.com", color: "#A896B8" },
  { id: "c5", label: "The Margin", email: "themarginpublication@gmail.com", color: "#E8B45C" },
];
const OTHER_CALENDARS = [
  { id: "o1", label: "Beth Harris (shared)", color: "#E086A0" },
  { id: "o2", label: "US Holidays", color: "#9AA2B1" },
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const seedNotifications = [
  { id: 1, when: "Today · 10:00 AM", text: "Send CMC follow-up email" },
  { id: 2, when: "Today · 6:00 PM", text: "Protected time starting — Time with the Lord" },
  { id: 3, when: "Yesterday", text: "Journal streak — 12 days 🔥" },
  { id: 4, when: "Aug 19", text: "Milestone completed — Platform launch copy" },
  { id: 5, when: "Aug 18", text: "Overdue — Update Notion phase headers" },
];

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

function Sidebar({ tabs, tab, setTab, viewport, theme, setTheme }) {
  const compact = viewport === "tablet";
  return (
    <div className={`sidebar ${compact ? "sidebar-compact" : "sidebar-wide"}`}>
      <div className="sidebar-brand">{compact ? "A" : "Abide"}</div>
      <div className="sidebar-nav">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
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
            <span className="time-chip"><Clock size={11} />{task.due}</span>
            {task.priority === "high" && <Flag size={12} color="#E68080" fill="#E68080" />}
            {task.repeat && <span className="time-chip"><Repeat size={11} />{task.repeat}</span>}
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
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Due</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{task.due}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Priority</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{task.priority === "high" ? "High" : task.priority === "med" ? "Medium" : "Low"}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Repeat</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{task.repeat || "None"}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Reminder</span><span className="field-value"><Bell size={11} color="var(--text2)" />{task.reminder || "None"}</span></div>
          <div className="field-row" style={{ cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}><span className="field-label">Goal</span><span className="field-value"><Pencil size={11} color="var(--text2)" />{goal ? goal.name : "No goal — standalone"}</span></div>
          <div className="notes-box" style={{ minHeight: 38, cursor: onEdit ? "pointer" : "default" }} onClick={() => onEdit?.(task)}>{task.notes || "Add a note…"}</div>
        </div>
      )}
    </div>
  );
}

const REFERENCE_DATE_KEY = "2026-08-21";

function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dateKeyFromOffset(offset = 0) {
  const d = dateFromKey(REFERENCE_DATE_KEY);
  d.setDate(d.getDate() + Number(offset || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function taskDateKey(task) {
  return task.dueDate || dateKeyFromOffset(task.dueOffsetDays || 0);
}

function offsetFromDateKey(key) {
  const ms = dateFromKey(key) - dateFromKey(REFERENCE_DATE_KEY);
  return Math.round(ms / 86400000);
}

function formatDateLabel(key) {
  const d = dateFromKey(key);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

function TaskEditor({ task, goals, areas, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(task.title || "");
  const [dueDate, setDueDate] = useState(taskDateKey(task));
  const [dueTime, setDueTime] = useState(inferTaskTime(task));
  const [priority, setPriority] = useState(task.priority || "med");
  const [area, setArea] = useState(task.area && areas[task.area] ? task.area : "");
  const [goal, setGoal] = useState(task.goal || "");
  const [repeat, setRepeat] = useState(task.repeat || "");
  const [reminder, setReminder] = useState(task.reminder || "None");
  const [notes, setNotes] = useState(task.notes || "");

  const save = () => {
    if (!title.trim() || !dueDate) return;
    const dueOffsetDays = offsetFromDateKey(dueDate);
    const due = dueTime ? formatTimeLabel(dueTime) : formatDateLabel(dueDate);
    onSave({
      ...task,
      title: title.trim(),
      dueDate,
      dueTime: dueTime || null,
      due,
      dueOffsetDays,
      priority,
      area: area || null,
      goal: goal || null,
      repeat: repeat.trim() || null,
      reminder,
      notes,
    });
  };

  return (
    <div className="card composer-card" style={{ marginBottom: 14 }}>
      <div className="fb-label" style={{ marginTop: 0 }}>Edit Task</div>
      <input className="input-line" style={{ marginTop: 0 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><div className="fb-label">Date</div><input type="date" className="input-line" style={{ marginTop: 0 }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><div className="fb-label">Time</div><input type="time" className="input-line" style={{ marginTop: 0 }} value={dueTime} onChange={(e) => setDueTime(e.target.value)} /></div>
      </div>
      <div className="fb-label">Priority</div>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
        {[["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([k, label]) => <div key={k} className={`filter-chip ${priority === k ? "active" : ""}`} onClick={() => setPriority(k)}>{label}</div>)}
      </div>
      <div className="fb-label">Area</div>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
        <div className={`filter-chip ${area === "" ? "active" : ""}`} onClick={() => setArea("")}>No Area</div>
        {Object.entries(areas).map(([k, v]) => <div key={k} className={`filter-chip ${area === k ? "active" : ""}`} onClick={() => setArea(k)}>{v.name}</div>)}
      </div>
      <div className="fb-label">Goal (optional)</div>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
        <div className={`filter-chip ${goal === "" ? "active" : ""}`} onClick={() => setGoal("")}>No Goal</div>
        {goals.map((g) => <div key={g.id} className={`filter-chip ${goal === g.id ? "active" : ""}`} onClick={() => setGoal(g.id)}>{g.name}</div>)}
      </div>
      <div className="fb-label">Repeat</div>
      <input className="input-line" style={{ marginTop: 0 }} value={repeat} onChange={(e) => setRepeat(e.target.value)} placeholder="e.g. Daily, Tue / Thu, None" />
      <div className="fb-label">Reminder</div>
      <input className="input-line" style={{ marginTop: 0 }} value={reminder} onChange={(e) => setReminder(e.target.value)} placeholder="e.g. 15 min before" />
      <div className="fb-label">Notes</div>
      <textarea className="notes-box" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note…" />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={save}>Save Changes</div>
        <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</div>
      </div>
      <div className="filter-chip" style={{ marginTop: 8, justifyContent: "center", color: "#E68080", borderColor: "#E6808055" }} onClick={() => {
        if (window.confirm(`Delete "${task.title}"?`)) onDelete(task.id);
      }}><Trash2 size={12} />Delete Task</div>
    </div>
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
function TodayTab({ tasks, expandedId, setExpandedId, toggleDone, goals, areas, onUpdateTask, onDeleteTask }) {
  const [selectedAreas, setSelectedAreas] = useState(Object.keys(areas));
  const [selectedPriorities, setSelectedPriorities] = useState(["high", "med", "low"]);
  const [savedFilters, setSavedFilters] = useState([{ id: "sf1", name: "Margin only", areas: ["margin"], priorities: ["high", "med", "low"] }]);
  const [range, setRange] = useState("week");
  const [somedayOpen, setSomedayOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

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
  const upcomingReminders = tasks.filter((t) => t.reminder && t.reminder !== "None" && !t.done && t.dueOffsetDays <= 1);

  const saveTask = (updated) => {
    onUpdateTask(updated);
    setEditingTask(null);
  };
  const deleteTask = (id) => {
    onDeleteTask(id);
    if (editingTask?.id === id) setEditingTask(null);
  };

  const renderTask = (t) => <TaskRow key={t.id} task={t} goals={goals} areas={areas} expanded={expandedId === t.id} onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)} onToggleDone={toggleDone} onEdit={setEditingTask} />;

  return (
    <>
      <Header eyebrow="Friday, August 21" title="Today" actions={[{ icon: Bell, onClick: () => setAlertsOpen(!alertsOpen), badge: upcomingReminders.length > 0 }]} />
      <div className="scroll">
        <div className="capture-bar"><Plus size={16} />Capture anything — sort it out later</div>

        {editingTask && <TaskEditor task={editingTask} goals={goals} areas={areas} onSave={saveTask} onCancel={() => setEditingTask(null)} onDelete={deleteTask} />}

        {alertsOpen && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-label" style={{ margin: "10px 14px 4px 0" }}>Upcoming Reminders</div>
            {upcomingReminders.length ? upcomingReminders.map((t) => <div key={t.id} className="review-item"><span>{t.title}</span><span className="review-count">{t.reminder}</span></div>) : <div className="insight-line">No reminders set for the next day.</div>}
          </div>
        )}

        <FilterSystem areas={areas} selectedAreas={selectedAreas} setSelectedAreas={setSelectedAreas} selectedPriorities={selectedPriorities} setSelectedPriorities={setSelectedPriorities} savedFilters={savedFilters} setSavedFilters={setSavedFilters} />

        {overdue.length > 0 && (<><div className="section-label">Overdue</div><div className="card">{overdue.map(renderTask)}</div></>)}

        <div className="section-label">Today</div>
        <div className="card">{today.length ? today.map(renderTask) : <div className="insight-line">Nothing here for the filters selected.</div>}</div>

        <div className="section-label"><span>Coming Up</span></div>
        <div className="segmented" style={{ margin: "0 0 10px 0" }}>
          <div className={`seg-btn ${range === "week" ? "active" : ""}`} onClick={() => setRange("week")}>This Week</div>
          <div className={`seg-btn ${range === "twoweeks" ? "active" : ""}`} onClick={() => setRange("twoweeks")}>Next 2 Weeks</div>
        </div>
        <div className="card">{upcoming.length ? upcoming.map(renderTask) : <div className="insight-line">Nothing in this window for the filters selected.</div>}</div>

        <div className="section-label" onClick={() => setSomedayOpen(!somedayOpen)} style={{ cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Archive size={12} />Someday / Maybe ({somedayTasks.length})</span>
          {somedayOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        {somedayOpen && (
          <div className="card">
            {somedayTasks.map((t) => {
              const a = t.area && areas[t.area] ? areas[t.area] : { name: "No Area", color: "#9AA2B1" };
              return (
                <div className="task-row" key={t.id} style={{ cursor: "default" }}>
                  <div style={{ width: 22 }} />
                  <div><div className="task-title">{t.title}</div><div className="task-meta"><span className="chip" style={{ background: a.color + "26", color: a.color }}>{a.name}</span></div></div>
                </div>
              );
            })}
          </div>
        )}
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

function AddSheet({ goals, areas, initialDate, onClose, onCreateTask, onCreateEvent, googleConnected }) {
  const [kind, setKind] = useState("task");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || REFERENCE_DATE_KEY);
  const [time, setTime] = useState("");
  const [area, setArea] = useState(Object.keys(areas)[0] || "");
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState("med");
  const [bypass, setBypass] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !date || saving) return;
    setSaving(true);
    try {
      if (kind === "task") {
        onCreateTask({
          title: title.trim(),
          dueDate: date,
          dueTime: time || null,
          due: time ? formatTimeLabel(time) : formatDateLabel(date),
          dueOffsetDays: offsetFromDateKey(date),
          priority,
          area: area || null,
          goal: goal || null,
          notes: "",
          repeat: null,
          reminder: "None",
          done: false,
          bypassProtected: bypass,
        });
      } else {
        await onCreateEvent({ title: title.trim(), date, time, area: area || null, bypassProtected: bypass });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card composer-card">
      <div className="segmented" style={{ margin: "0 0 4px 0" }}>
        <div className={`seg-btn ${kind === "task" ? "active" : ""}`} onClick={() => setKind("task")}>Task</div>
        <div className={`seg-btn ${kind === "event" ? "active" : ""}`} onClick={() => setKind("event")}>Event</div>
      </div>
      <input className="input-line" placeholder={kind === "task" ? "Task title" : "Event title"} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <input type="date" className="input-line" style={{ flex: 1 }} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" className="input-line" style={{ flex: 1 }} value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div className="fb-label">Area</div>
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
        <div className={`filter-chip ${area === "" ? "active" : ""}`} onClick={() => setArea("")}>No Area</div>
        {Object.entries(areas).map(([k, v]) => <div key={k} className={`filter-chip ${area === k ? "active" : ""}`} style={{ borderColor: v.color + "55" }} onClick={() => setArea(k)}>{v.name}</div>)}
      </div>
      {kind === "task" && (
        <>
          <div className="fb-label">Priority</div>
          <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
            {[["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([k, label]) => <div key={k} className={`filter-chip ${priority === k ? "active" : ""}`} onClick={() => setPriority(k)}>{label}</div>)}
          </div>
          <div className="fb-label">Goal (optional)</div>
          <div className="filter-row" style={{ padding: "0 0 2px 0" }}>
            <div className={`filter-chip ${goal === "" ? "active" : ""}`} onClick={() => setGoal("")}>No Goal</div>
            {goals.map((g) => <div key={g.id} className={`filter-chip ${goal === g.id ? "active" : ""}`} onClick={() => setGoal(g.id)}>{g.name}</div>)}
          </div>
        </>
      )}
      {kind === "event" && (
        <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={11} />{googleConnected ? "Will be added to lamound2407@gmail.com in Google Calendar." : "Will stay in Abide until Google Calendar is connected."}
        </div>
      )}
      <div className="settings-row" style={{ padding: "12px 0 2px 0", borderBottom: "none" }}>
        <div className="settings-row-name"><ShieldCheck size={15} color="#8FA88A" />Bypass protected time blocks</div>
        <Toggle on={bypass} onClick={() => setBypass(!bypass)} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div className="filter-chip active" style={{ flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }} onClick={save}>{saving ? "Saving…" : `Save ${kind === "task" ? "Task" : "Event"}`}</div>
        <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</div>
      </div>
    </div>
  );
}

function CalendarsPanel({ calendars, setCalendars, connected, configured, onConnect, onRefresh, error }) {
  return (
    <div className="card cal-account" style={{ marginBottom: 14 }}>
      <div className="cal-account-title">lamound2407@gmail.com</div>
      {!configured ? (
        <div className="insight-line" style={{ padding: "8px 0 4px" }}>Google Calendar is ready in the code, but the Google OAuth client ID still needs to be added to Abide before it can connect.</div>
      ) : !connected ? (
        <div className="filter-chip active" style={{ display: "inline-flex", marginTop: 8 }} onClick={onConnect}>Connect Google Calendar</div>
      ) : (
        <>
          {calendars.map((c) => (
            <div key={c.id} className="cal-item">
              <div className="cal-item-name"><span className="cal-swatch" style={{ background: c.color }} />{c.label}</div>
              <Toggle on={c.on} onClick={() => setCalendars((p) => p.map((x) => x.id === c.id ? { ...x, on: !x.on } : x))} />
            </div>
          ))}
          <div className="link-others" onClick={onRefresh}>Refresh Google Calendar →</div>
        </>
      )}
      {error && <div style={{ fontSize: 11.5, color: "#E68080", marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function CalendarTab({ tasks, goals, protectedBlocks, areas, toggleDone, onUpdateTask, onDeleteTask, onCreateTask }) {
  const [mode, setMode] = useState("week");
  const [selDay, setSelDay] = useState(4);
  const [adding, setAdding] = useState(false);
  const [calsOpen, setCalsOpen] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [events, setEvents] = useState([]);
  const [googleError, setGoogleError] = useState("");
  const [googleToken, setGoogleToken] = useState(() => {
    try { return sessionStorage.getItem("abideGoogleCalendarToken") || ""; } catch { return ""; }
  });
  const tokenClientRef = useRef(null);
  const [overridden, setOverridden] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const googleConfigured = Boolean(googleClientId);
  const googleConnected = Boolean(googleToken);

  const days = [
    { dow: "M", full: "Mon", num: 17, key: "2026-08-17" },
    { dow: "T", full: "Tue", num: 18, key: "2026-08-18" },
    { dow: "W", full: "Wed", num: 19, key: "2026-08-19" },
    { dow: "T", full: "Thu", num: 20, key: "2026-08-20" },
    { dow: "F", full: "Fri", num: 21, key: "2026-08-21" },
    { dow: "S", full: "Sat", num: 22, key: "2026-08-22" },
    { dow: "S", full: "Sun", num: 23, key: "2026-08-23" },
  ];
  const selectedDay = days[selDay];
  const selectedDateKey = selectedDay.key;
  const todaysBlock = protectedBlocks.find((b) => b.day === selectedDay.full);
  const activeCount = calendars.filter((c) => c.on).length;
  const visibleCalendarIds = new Set(calendars.filter((c) => c.on).map((c) => c.id));
  const dayTasks = tasks.filter((t) => taskDateKey(t) === selectedDateKey);
  const dayEvents = events.filter((e) => e.date === selectedDateKey && (e.source !== "google" || visibleCalendarIds.has(e.calendarId)));

  const clearGoogleConnection = () => {
    setGoogleToken("");
    try { sessionStorage.removeItem("abideGoogleCalendarToken"); } catch {}
  };

  const fetchGoogleData = async (token = googleToken) => {
    if (!token) return;
    setGoogleError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const calRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers });
      if (calRes.status === 401) {
        clearGoogleConnection();
        throw new Error("Google Calendar authorization expired. Tap Connect Google Calendar again.");
      }
      if (!calRes.ok) throw new Error("Could not load your Google calendars.");
      const calJson = await calRes.json();
      const priorOn = new Map(calendars.map((c) => [c.id, c.on]));
      const nextCalendars = (calJson.items || []).map((c) => ({
        id: c.id,
        label: c.summaryOverride || c.summary || c.id,
        color: c.backgroundColor || "#8FA88A",
        on: priorOn.has(c.id) ? priorOn.get(c.id) : c.selected !== false,
        primary: Boolean(c.primary),
      }));
      setCalendars(nextCalendars);

      const timeMin = new Date("2026-08-01T00:00:00-05:00").toISOString();
      const timeMax = new Date("2026-09-01T00:00:00-05:00").toISOString();
      const eventGroups = await Promise.all(nextCalendars.map(async (cal) => {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        const json = await res.json();
        return (json.items || []).filter((e) => e.status !== "cancelled").map((e) => ({
          id: `google:${cal.id}:${e.id}`,
          googleEventId: e.id,
          calendarId: cal.id,
          calendarLabel: cal.label,
          color: cal.color,
          source: "google",
          title: e.summary || "(Untitled event)",
          date: googleEventDateKey(e),
          time: googleEventTimeLabel(e),
          start: e.start,
          end: e.end,
        }));
      }));
      setEvents((prev) => [...prev.filter((e) => e.source !== "google"), ...eventGroups.flat()]);
    } catch (err) {
      setGoogleError(err.message || "Google Calendar could not be loaded.");
    }
  };

  useEffect(() => {
    if (!googleConfigured) return;
    let active = true;
    loadGoogleIdentityScript().then(() => {
      if (!active || !window.google?.accounts?.oauth2) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: GOOGLE_CALENDAR_SCOPE,
        callback: (response) => {
          if (response.error) {
            setGoogleError(response.error_description || response.error);
            return;
          }
          setGoogleToken(response.access_token);
          try { sessionStorage.setItem("abideGoogleCalendarToken", response.access_token); } catch {}
          fetchGoogleData(response.access_token);
        },
      });
    }).catch(() => setGoogleError("Google sign-in could not load."));
    return () => { active = false; };
  }, [googleClientId]);

  useEffect(() => {
    if (googleToken) fetchGoogleData(googleToken);
    // Intentionally only refresh when a saved token becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleToken]);

  const connectGoogle = () => {
    setGoogleError("");
    if (!googleConfigured) {
      setGoogleError("Add VITE_GOOGLE_CLIENT_ID to Abide first.");
      return;
    }
    if (!tokenClientRef.current) {
      setGoogleError("Google sign-in is still loading. Try again in a moment.");
      return;
    }
    tokenClientRef.current.requestAccessToken({ prompt: googleToken ? "" : "consent" });
  };

  const createEvent = async ({ title, date, time, area, bypassProtected }) => {
    if (!googleToken) {
      setEvents((prev) => [...prev, { id: `native:${Date.now()}`, source: "native", title, date, time: time ? formatTimeLabel(time) : "All day", area, bypassProtected }]);
      return;
    }

    const body = { summary: title };
    if (time) {
      const [h, m] = time.split(":").map(Number);
      const start = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      body.start = { dateTime: start.toISOString(), timeZone: "America/Chicago" };
      body.end = { dateTime: end.toISOString(), timeZone: "America/Chicago" };
    } else {
      const end = dateFromKey(date); end.setDate(end.getDate() + 1);
      body.start = { date };
      body.end = { date: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}` };
    }

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      clearGoogleConnection();
      setGoogleError("Google Calendar authorization expired. Reconnect and try again.");
      throw new Error("Google authorization expired");
    }
    if (!res.ok) {
      setGoogleError("The event could not be added to lamound2407@gmail.com.");
      throw new Error("Google event creation failed");
    }
    await fetchGoogleData(googleToken);
  };

  const saveEditedTask = (updated) => { onUpdateTask(updated); setEditingTask(null); };
  const deleteEditedTask = (id) => { onDeleteTask(id); setEditingTask(null); };

  return (
    <>
      <Header eyebrow="August 2026" title="Calendar" actions={[{ icon: SlidersHorizontal, onClick: () => setCalsOpen(!calsOpen) }, { icon: adding ? X : Plus, onClick: () => setAdding(!adding) }]} />
      <div className="scroll">
        <div className="gcal-badge" onClick={() => setCalsOpen(!calsOpen)}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="gcal-dot" />{googleConnected ? `${activeCount} Google calendar${activeCount === 1 ? "" : "s"} visible` : "Google Calendar not connected"} · lamound2407@gmail.com</span>
          {calsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        {calsOpen && <CalendarsPanel calendars={calendars} setCalendars={setCalendars} connected={googleConnected} configured={googleConfigured} onConnect={connectGoogle} onRefresh={() => fetchGoogleData()} error={googleError} />}
        {adding && <AddSheet goals={goals} areas={areas} initialDate={selectedDateKey} onClose={() => setAdding(false)} onCreateTask={onCreateTask} onCreateEvent={createEvent} googleConnected={googleConnected} />}
        {editingTask && <TaskEditor task={editingTask} goals={goals} areas={areas} onSave={saveEditedTask} onCancel={() => setEditingTask(null)} onDelete={deleteEditedTask} />}

        <div className="segmented">
          <div className={`seg-btn ${mode === "week" ? "active" : ""}`} onClick={() => setMode("week")}>Week</div>
          <div className={`seg-btn ${mode === "month" ? "active" : ""}`} onClick={() => setMode("month")}>Month</div>
        </div>

        {mode === "week" ? (
          <>
            <div className="weekstrip">{days.map((d, i) => {
              const hasItems = tasks.some((t) => taskDateKey(t) === d.key) || events.some((e) => e.date === d.key);
              return <div key={d.key} className={`daypill ${selDay === i ? "selected" : ""}`} onClick={() => { setSelDay(i); setOverridden(false); setOverrideOpen(false); }}><span className="dow">{d.dow}</span><span className="num">{d.num}</span>{hasItems && <span className="dot" />}</div>;
            })}</div>
            <div className="section-label">{dateFromKey(selectedDateKey).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>

            {todaysBlock && (
              <div className="protected-block">
                <div className="row">
                  <ShieldCheck size={18} color="#8FA88A" />
                  <div><div className="t">{todaysBlock.start}–{todaysBlock.end} · Protected — {todaysBlock.label}</div><div className="s">Protected time stays visible while you plan the rest of the day.</div></div>
                </div>
                {!overridden ? (
                  <div className="override" onClick={() => setOverrideOpen(!overrideOpen)}>Need to schedule something here anyway? →</div>
                ) : (
                  <div className="s" style={{ marginTop: 8 }}>Scheduling override enabled for this view.</div>
                )}
                {overrideOpen && !overridden && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <div className="filter-chip active" onClick={() => { setOverridden(true); setOverrideOpen(false); }}>Schedule Anyway</div>
                    <div className="filter-chip" onClick={() => setOverrideOpen(false)}>Never mind</div>
                  </div>
                )}
              </div>
            )}

            <div className="section-label">Tasks</div>
            <div className="card">
              {dayTasks.length ? dayTasks.map((t) => <TaskRow key={t.id} task={t} goals={goals} areas={areas} expanded={false} onToggleExpand={() => setEditingTask(t)} onToggleDone={toggleDone} onEdit={setEditingTask} />) : <div className="insight-line">No tasks due this day.</div>}
            </div>

            <div className="section-label">Events</div>
            <div className="card">
              {dayEvents.length ? dayEvents.map((e) => {
                const areaInfo = e.area && areas[e.area] ? areas[e.area] : null;
                return (
                  <div className="task-row" key={e.id} style={{ cursor: "default" }}>
                    <div style={{ width: 22 }} />
                    <div style={{ flex: 1 }}>
                      <div className="task-title">{e.title}</div>
                      <div className="task-meta">
                        <span className="chip" style={{ background: (e.color || areaInfo?.color || "#8FA88A") + "26", color: e.color || areaInfo?.color || "#8FA88A" }}>{e.source === "google" ? (e.calendarLabel || "Google Calendar") : "Abide"}</span>
                        <span className="time-chip"><Clock size={11} />{e.time || "All day"}</span>
                      </div>
                    </div>
                  </div>
                );
              }) : <div className="insight-line">{googleConnected ? "No calendar events this day." : "No Abide events this day. Connect Google Calendar to pull in your real events."}</div>}
            </div>
          </>
        ) : (
          <>
            <div className="section-label">This Month at a Glance</div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
                {Array.from({ length: 31 }).map((_, i) => {
                  const key = `2026-08-${String(i + 1).padStart(2, "0")}`;
                  const hasItems = tasks.some((t) => taskDateKey(t) === key) || events.some((e) => e.date === key);
                  return (
                    <div key={i} style={{ textAlign: "center", padding: "7px 0", borderRadius: 8, background: key === selectedDateKey ? "rgba(232,180,92,0.18)" : "transparent" }}>
                      <div style={{ fontSize: 12, color: "var(--body)" }}>{i + 1}</div>
                      {hasItems && <div style={{ width: 4, height: 4, borderRadius: 2, background: "#E8B45C", margin: "3px auto 0" }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   GOALS TAB — add / edit goals, milestones, notes
----------------------------------------------------------------*/
function GoalComposer({ initial, onSave, onCancel, onDelete, areas = AREAS }) {
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
      <div className="filter-row" style={{ padding: "0 0 2px 0" }}>{Object.entries(areas).map(([k, v]) => <div key={k} className={`filter-chip ${area === k ? "active" : ""}`} onClick={() => setArea(k)}>{v.name}</div>)}</div>
      <div className="fb-label">Target Date</div>
      <input className="input-line" style={{ marginTop: 0 }} placeholder="e.g. Dec 31" value={target} onChange={(e) => setTarget(e.target.value)} />
      <div className="fb-label">Notes</div>
      <textarea className="notes-box" rows={2} placeholder="Why this goal matters, context, links…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="fb-label">Milestones</div>
      {milestones.map((m) => (
        <span key={m.id} className="milestone-chip">{m.label}<X size={12} style={{ cursor: "pointer", opacity: 0.6 }} onClick={() => removeMilestone(m.id)} /></span>
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

function GoalsTab({ goals, setGoals, viewport, areas = AREAS }) {
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
        {composer === "add" && <GoalComposer areas={areas} onSave={saveGoal} onCancel={() => setComposer(null)} />}
        <div className={viewport === "desktop" ? "goal-grid" : undefined}>
          {goals.map((g) => {
            const area = g.area && areas[g.area] ? areas[g.area] : { name: "No Area", color: "#9AA2B1" };
            if (composer === g.id) {
              return <GoalComposer key={g.id} areas={areas} initial={g} onSave={saveGoal} onCancel={() => setComposer(null)} onDelete={() => deleteGoal(g.id)} />;
            }
            return (
              <div key={g.id} className="card goal-card">
                <div className="goal-title-row">
                  <div><span className="chip" style={{ background: area.color + "26", color: area.color }}>{area.name}</span><div className="goal-name" style={{ marginTop: 6 }}>{g.name}</div></div>
                  <Pencil size={15} color="var(--text3)" onClick={() => setComposer(g.id)} />
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

/* ---------------------------------------------------------------
   JOURNAL TAB — add / edit / delete
----------------------------------------------------------------*/
function JournalTab() {
  const [entries, setEntries] = useState(seedJournal);
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("yellow");
  const [editingId, setEditingId] = useState(null);
  const [editRef, setEditRef] = useState(""); const [editNote, setEditNote] = useState(""); const [editTag, setEditTag] = useState("yellow");

  const save = () => {
    if (!note.trim()) return;
    setEntries((p) => [{ id: Date.now(), date: "Today", ref: ref || "—", tag, note }, ...p]);
    setRef(""); setNote(""); setTag("yellow");
  };
  const startEdit = (e) => { setEditingId(e.id); setEditRef(e.ref); setEditNote(e.note); setEditTag(e.tag); };
  const saveEdit = (id) => { setEntries((p) => p.map((e) => e.id === id ? { ...e, ref: editRef, note: editNote, tag: editTag } : e)); setEditingId(null); };
  const remove = (id) => setEntries((p) => p.filter((e) => e.id !== id));

  return (
    <>
      <Header eyebrow="12-day streak" title="Time with the Lord" />
      <div className="scroll">
        <div className="card journal-compose">
          <input placeholder="Scripture reference (e.g. Psalm 23:1)" style={{ width: "100%", background: "transparent", border: "none", color: "var(--text)", fontSize: 14.5, fontWeight: 600, outline: "none" }} value={ref} onChange={(e) => setRef(e.target.value)} />
          <textarea className="notes-box" rows={3} placeholder="What is He saying to you right now?" style={{ marginTop: 10 }} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="tag-row">{Object.entries(TAGS).map(([k, v]) => <div key={k} className={`tag-swatch ${tag === k ? "selected" : ""}`} style={{ background: v.hex }} title={v.label} onClick={() => setTag(k)} />)}</div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>{TAGS[tag].label} — your five-color highlight system, carried over</div>
          <div className="filter-chip active" style={{ display: "inline-flex", marginTop: 10 }} onClick={save}>Save Entry</div>
        </div>

        <div className="section-label">Entries</div>
        <div className="card">
          {entries.map((e) => (
            <div key={e.id} className="journal-entry">
              {editingId === e.id ? (
                <>
                  <input className="input-line" style={{ marginTop: 0 }} value={editRef} onChange={(ev) => setEditRef(ev.target.value)} />
                  <textarea className="notes-box" rows={3} value={editNote} onChange={(ev) => setEditNote(ev.target.value)} />
                  <div className="tag-row">{Object.entries(TAGS).map(([k, v]) => <div key={k} className={`tag-swatch ${editTag === k ? "selected" : ""}`} style={{ background: v.hex }} onClick={() => setEditTag(k)} />)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <div className="filter-chip active" onClick={() => saveEdit(e.id)}>Save</div>
                    <div className="filter-chip" onClick={() => setEditingId(null)}>Cancel</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="verse-badge" style={{ background: TAGS[e.tag].hex }}>{e.ref}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--text3)" }}>{e.date}</span>
                      <div className="entry-actions"><Pencil size={13} color="var(--text3)" onClick={() => startEdit(e)} /><Trash2 size={13} color="var(--text3)" onClick={() => remove(e.id)} /></div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--body2)", marginTop: 8, lineHeight: 1.45 }}>{e.note}</div>
                </>
              )}
            </div>
          ))}
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
  const [pages, setPages] = useState([{ id: 1, type: "type", content: "Sermon note — 'faithfulness in the unseen' — tie into Margin Day 4?", date: "Aug 18" }]);
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
    if (!typedDraft.trim()) return;
    if (editingId) {
      setPages((prev) => prev.map((pg) => pg.id === editingId ? { ...pg, type: "type", content: typedDraft } : pg));
      setEditingId(null);
    } else {
      setPages((prev) => [{ id: Date.now(), type: "type", content: typedDraft, date: "Today" }, ...prev]);
    }
    setTypedDraft("");
  };

  const editPage = (pg) => {
    setEditingId(pg.id);
    if (pg.type === "type") {
      setTool("type");
      setTypedDraft(pg.content);
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
            <textarea className="notes-box" rows={6} placeholder="Jot it down…" value={typedDraft} onChange={(e) => setTypedDraft(e.target.value)} />
            <div className="filter-chip active" style={{ display: "inline-flex", marginTop: 10 }} onClick={saveTyped}><Type size={12} />{editingId ? "Update Note" : "Save Note"}</div>
          </>
        )}
        <div className="section-label">Past Pages</div>
        <div className="scratch-grid">
          {pages.map((pg) => (
            <div key={pg.id} className="scratch-item card">
              {pg.type === "draw" ? <img src={pg.content} className="scratch-thumb" alt="scratch page" /> : <div style={{ padding: 10, fontSize: 12.5, color: "var(--body2)", minHeight: 70 }}>{pg.content}</div>}
              <div className="cap"><span>{pg.date}</span><span className="cap-icons"><Pencil size={12} onClick={() => editPage(pg)} /><Trash2 size={12} onClick={() => deletePage(pg.id)} /></span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function LinkCard({ icon: Icon, tint, name, desc, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  return (
    <div className="link-card">
      <div className="link-icon" style={{ background: tint + "22" }}><Icon size={19} color={tint} /></div>
      <div style={{ flex: 1 }}>
        <div className="link-name">{name}</div>
        <div className="link-desc">{desc}</div>
        {editing || !url ? <input className="link-url-input" placeholder={placeholder} value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => setEditing(false)} /> : <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#E8B45C", marginTop: 3, display: "inline-block" }} onClick={(e) => e.stopPropagation()}>{url}</a>}
      </div>
      {url && !editing && <ExternalLink size={15} color="var(--text3)" onClick={() => setEditing(true)} />}
    </div>
  );
}

/* ---------------------------------------------------------------
   NOTIFICATION CENTER + SETTINGS (reached from bottom of Insights)
----------------------------------------------------------------*/
function NotificationCenter({ onBack }) {
  const [prefs, setPrefs] = useState({ tasks: true, calendar: true, review: true, streak: true, milestones: true });
  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const rows = [
    { k: "tasks", label: "Task reminders" },
    { k: "calendar", label: "Calendar event alerts" },
    { k: "review", label: "Weekly review nudge" },
    { k: "streak", label: "Journal streak reminder" },
    { k: "milestones", label: "Goal milestone alerts" },
  ];
  return (
    <>
      <Header eyebrow="Insights" title="Notification Center" onBack={onBack} />
      <div className="scroll">
        <div className="section-label">What Alerts You</div>
        <div className="card">{rows.map((r) => <div key={r.k} className="settings-row"><span className="settings-row-name">{r.label}</span><Toggle on={prefs[r.k]} onClick={() => toggle(r.k)} /></div>)}</div>
        <div className="section-label">Recent</div>
        <div className="card">{seedNotifications.map((n) => <div key={n.id} className="review-item"><span>{n.text}</span><span style={{ fontSize: 11.5, color: "var(--text3)" }}>{n.when}</span></div>)}</div>
      </div>
    </>
  );
}

function ProtectedBlockRow({ block, onEdit, onDelete }) {
  return (
    <div className="settings-row">
      <div className="settings-row-name"><ShieldCheck size={15} color="#8FA88A" />{block.day} · {block.start}–{block.end} · {block.label}</div>
      <div style={{ display: "flex", gap: 12 }}><Pencil size={14} color="var(--text3)" onClick={onEdit} /><Trash2 size={14} color="var(--text3)" onClick={onDelete} /></div>
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

function AreaComposer({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8FA88A");

  const save = () => {
    if (!name.trim()) return;
    onSave({ id: `area_${Date.now()}`, name: name.trim(), color });
  };

  return (
    <div className="card composer-card">
      <div className="fb-label" style={{ marginTop: 0 }}>Area Name</div>
      <input className="input-line" style={{ marginTop: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home, Church, Writing" />
      <div className="fb-label">Color</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 36, border: "none", background: "transparent" }} />
        <span className="chip" style={{ background: color + "26", color }}>{name || "New Area"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div className="filter-chip active" style={{ flex: 1, justifyContent: "center" }} onClick={save}>Add Area</div>
        <div className="filter-chip" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</div>
      </div>
    </div>
  );
}

function SettingsScreen({ onBack, theme, setTheme, protectedBlocks, setProtectedBlocks, areas, setAreas, onDeleteArea }) {
  const [blockComposer, setBlockComposer] = useState(null); // null | "add" | blockId
  const [areaComposerOpen, setAreaComposerOpen] = useState(false);
  const saveBlock = (b) => { setProtectedBlocks((prev) => prev.some((x) => x.id === b.id) ? prev.map((x) => x.id === b.id ? b : x) : [...prev, b]); setBlockComposer(null); };
  const deleteBlock = (id) => setProtectedBlocks((prev) => prev.filter((b) => b.id !== id));
  const saveArea = ({ id, name, color }) => {
    setAreas((prev) => ({ ...prev, [id]: { name, color } }));
    setAreaComposerOpen(false);
  };

  return (
    <>
      <Header eyebrow="Insights" title="Settings" onBack={onBack} />
      <div className="scroll">
        <div className="section-label">Appearance</div>
        <div className="segmented"><div className={`seg-btn ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}>Light</div><div className={`seg-btn ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}>Dark</div></div>

        <div className="section-label"><span>Areas</span><Plus size={14} color="#E8B45C" onClick={() => setAreaComposerOpen(!areaComposerOpen)} /></div>
        {areaComposerOpen && <AreaComposer onSave={saveArea} onCancel={() => setAreaComposerOpen(false)} />}
        <div className="card">
          {Object.entries(areas).map(([id, area]) => (
            <div className="settings-row" key={id}>
              <div className="settings-row-name"><span className="cal-swatch" style={{ background: area.color }} />{area.name}</div>
              <Trash2 size={14} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => {
                if (window.confirm(`Delete the "${area.name}" area? Tasks and goals using it will become unassigned.`)) onDeleteArea(id);
              }} />
            </div>
          ))}
          {Object.keys(areas).length === 0 && <div className="insight-line">No areas yet. Add one with the + button.</div>}
        </div>
        <div className="insight-line" style={{ padding: "8px 4px" }}>Deleting an area removes it from task and calendar pickers. Existing items are kept and become “No Area.”</div>

        <div className="section-label"><span>Protected Time Blocks</span><Plus size={14} color="#E8B45C" onClick={() => setBlockComposer(blockComposer === "add" ? null : "add")} /></div>
        {blockComposer === "add" && <ProtectedBlockComposer onSave={saveBlock} onCancel={() => setBlockComposer(null)} />}
        <div className="card">
          {protectedBlocks.map((b) => blockComposer === b.id
            ? <ProtectedBlockComposer key={b.id} initial={b} onSave={saveBlock} onCancel={() => setBlockComposer(null)} />
            : <ProtectedBlockRow key={b.id} block={b} onEdit={() => setBlockComposer(b.id)} onDelete={() => deleteBlock(b.id)} />
          )}
        </div>

        <div className="section-label">Connected Calendars</div>
        <div className="card insight-line">5 calendars connected under lamound2407@gmail.com — manage which are visible from the Calendar tab.</div>

        <div className="section-label">Account</div>
        <div className="card"><div className="settings-row"><span className="settings-row-name">lamound2407@gmail.com</span></div><div className="settings-row" style={{ color: "#E68080", cursor: "pointer" }}><span className="settings-row-name" style={{ color: "#E68080" }}>Sign Out</span></div></div>
      </div>
    </>
  );
}

function InsightsTab({ theme, setTheme, protectedBlocks, setProtectedBlocks, areas, setAreas, onDeleteArea }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [screen, setScreen] = useState("dashboard"); // dashboard | notifications | settings

  if (screen === "notifications") return <NotificationCenter onBack={() => setScreen("dashboard")} />;
  if (screen === "settings") return <SettingsScreen onBack={() => setScreen("dashboard")} theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={onDeleteArea} />;

  return (
    <>
      <Header eyebrow="Last 7 days" title="Insights" />
      <div className="scroll">
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-num">84%</div><div className="stat-label">Task completion rate</div></div>
          <div className="stat-card"><div className="stat-num" style={{ display: "flex", alignItems: "center", gap: 5 }}>12<Flame size={16} color="#E8B45C" /></div><div className="stat-label">Journal streak (days)</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: "#7CBE86", display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={16} />+18%</div><div className="stat-label">Vs. last week</div></div>
          <div className="stat-card"><div className="stat-num">5<span style={{ fontSize: 14, color: "var(--text2)" }}>/12</span></div><div className="stat-label">Books read in 2026</div></div>
        </div>

        <div className="section-label" onClick={() => setReviewOpen(!reviewOpen)} style={{ cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={12} />Weekly Review (GTD)</span>{reviewOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        {reviewOpen && (
          <div className="card">
            <div className="review-item"><span>Overdue items to reschedule</span><span className="review-count">1</span></div>
            <div className="review-item"><span>Untagged captures to clarify</span><span className="review-count">3</span></div>
            <div className="review-item"><span>Someday / Maybe to revisit</span><span className="review-count">{somedayTasks.length}</span></div>
            <div className="review-item"><span>Goals with no movement this week</span><span className="review-count">0</span></div>
          </div>
        )}

        <div className="section-label">Tasks Completed — This Week</div>
        <div className="card" style={{ padding: "14px 6px" }}>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={weekBars}><XAxis dataKey="d" tick={{ fill: "#8E97A8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: theme === "dark" ? "#1C2333" : "#fff", border: "none", borderRadius: 8, fontSize: 12 }} /><Bar dataKey="done" fill="#E8B45C" radius={[5, 5, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>

        <div className="section-label">Where Your Time Goes</div>
        <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <ResponsiveContainer width={120} height={120}><PieChart><Pie data={areaSplit} dataKey="value" innerRadius={32} outerRadius={55} paddingAngle={3}>{areaSplit.map((a, i) => <Cell key={i} fill={a.color} stroke="none" />)}</Pie></PieChart></ResponsiveContainer>
          <div style={{ flex: 1 }}>{areaSplit.map((a, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--body)", marginBottom: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: a.color }} />{a.name}</div>)}</div>
        </div>

        <div className="section-label">Time with the Lord — 30 Days</div>
        <div className="card" style={{ padding: 14 }}><div className="heat-row">{Array.from({ length: 30 }).map((_, i) => <div key={i} className="heat-cell" style={{ background: Math.random() > 0.2 ? `rgba(232,180,92,${0.25 + Math.random() * 0.65})` : "var(--emptyHeat)" }} />)}</div></div>

        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={12} />Pattern Noticed</div>
        <div className="card insight-line" style={{ marginBottom: 14 }}>You complete roughly 2.3× more tasks before 11 AM than after 4 PM, and Margin writing tasks are most often skipped on days with 3+ Chi Alpha items due. Consider protecting your Tue/Thu evening blocks more tightly during launch weeks.</div>

        <div className="section-label">Your Tools</div>
        <div className="card">
          <LinkCard icon={Dumbbell} tint="#7C93C9" name="Iron Log" desc="Firebase-synced workout tracker, with Beth" placeholder="Paste your Iron Log URL" />
          <LinkCard icon={Salad} tint="#8FA88A" name="Trophé" desc="Nutrition & meal-planning app" placeholder="Paste your Trophé URL" />
        </div>

        <div className="section-label">More</div>
        <div className="card">
          <div className="nav-row" onClick={() => setScreen("notifications")}><div className="nav-row-left"><div className="nav-icon" style={{ background: "#E8B45C22" }}><Bell size={16} color="#E8B45C" /></div>Notification Center</div><ChevronRight size={16} color="var(--text3)" /></div>
          <div className="nav-row" onClick={() => setScreen("settings")}><div className="nav-row-left"><div className="nav-icon" style={{ background: "#8FA88A22" }}><SettingsIcon size={16} color="#8FA88A" /></div>Settings</div><ChevronRight size={16} color="var(--text3)" /></div>
        </div>
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
  const [tasks, setTasks] = useState(seedTasks);
  const [goals, setGoals] = useState(seedGoals);
  const [areas, setAreas] = useState(AREAS);
  const [expandedId, setExpandedId] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [protectedBlocks, setProtectedBlocks] = useState([
    { id: 1, day: "Tue", start: "6:00 PM", end: "7:00 PM", label: "Time with the Lord" },
    { id: 2, day: "Thu", start: "6:00 PM", end: "7:00 PM", label: "Time with the Lord" },
    { id: 3, day: "Fri", start: "6:00 PM", end: "7:00 PM", label: "Time with the Lord" },
  ]);
  const [viewport, setViewport] = useState(() => (typeof window !== "undefined" ? getViewport(window.innerWidth) : "phone"));
  const tk = THEME[theme];

  useEffect(() => {
    const onResize = () => setViewport(getViewport(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggleDone = (id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const updateTask = (updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const createTask = (task) => setTasks((prev) => [{ id: Date.now(), ...task }, ...prev]);
  const deleteArea = (id) => {
    setAreas((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTasks((prev) => prev.map((t) => t.area === id ? { ...t, area: null } : t));
    setGoals((prev) => prev.map((g) => g.area === id ? { ...g, area: null } : g));
  };

  const tabs = [
    { id: "today", label: "Today", icon: ListTodo },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "goals", label: "Goals", icon: Target },
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "scratch", label: "Scratch", icon: PenTool },
    { id: "insights", label: "Insights", icon: BarChart3 },
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
      {tab === "today" && <TodayTab tasks={tasks} goals={goals} areas={areas} expandedId={expandedId} setExpandedId={setExpandedId} toggleDone={toggleDone} onUpdateTask={updateTask} onDeleteTask={deleteTask} />}
      {tab === "calendar" && <CalendarTab tasks={tasks} goals={goals} protectedBlocks={protectedBlocks} areas={areas} toggleDone={toggleDone} onUpdateTask={updateTask} onDeleteTask={deleteTask} onCreateTask={createTask} />}
      {tab === "goals" && <GoalsTab goals={goals} setGoals={setGoals} viewport={viewport} areas={areas} />}
      {tab === "journal" && <JournalTab />}
      {tab === "scratch" && <ScratchTab />}
      {tab === "insights" && <InsightsTab theme={theme} setTheme={setTheme} protectedBlocks={protectedBlocks} setProtectedBlocks={setProtectedBlocks} areas={areas} setAreas={setAreas} onDeleteArea={deleteArea} />}
    </>
  );

  return (
    <div className={`viewport-${viewport}`} style={{
      display: "flex", justifyContent: viewport === "phone" ? "center" : "stretch",
      padding: viewport === "phone" ? "20px 0" : "0", background: tk.pageBg, height: "100vh", width: "100%", ...vars,
    }}>
      <style>{styles}</style>

      {viewport === "phone" ? (
        <div className="app">
          <div className="statusbar">
            <span className="brand">{APP_NAME.toUpperCase()}</span>
            <div className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon size={15} color="#E8B45C" /> : <Sun size={15} color="#D69A3A" />}</div>
          </div>
          {activeTab}
          <button className="fab"><Plus size={24} strokeWidth={2.5} /></button>
          <div className="tabbar">
            {tabs.map((t) => { const Icon = t.icon; const active = tab === t.id; return (
              <div key={t.id} className={`tab ${active ? "active" : ""}`} onClick={() => setTab(t.id)}><Icon size={20} strokeWidth={active ? 2.3 : 1.8} /><span>{t.label}</span></div>
            ); })}
          </div>
        </div>
      ) : (
        <div className="shell">
          <Sidebar tabs={tabs} tab={tab} setTab={setTab} viewport={viewport} theme={theme} setTheme={setTheme} />
          <div className="shell-main">
            {activeTab}
            <button className="fab shell-fab"><Plus size={24} strokeWidth={2.5} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
