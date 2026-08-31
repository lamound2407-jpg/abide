import React from "react";
import {
  createPortal,
} from "react-dom";

import {
  Type,
  SquareCheckBig,
  CircleCheckBig,
  List,
  ListOrdered,
  ChevronRight,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Lightbulb,
  CalendarDays,
  Bell,
  Clock3,
  Calendar,
  FileText,
  User,
  Table2,
  Target,
  NotebookPen,
  StickyNote,
} from "lucide-react";

import {
  formatDate,
  formatTime,
} from "./workspaceCore.js";


function CommandIcon({
  item,
}) {
  const props = {
    size: 18,
    strokeWidth: 1.9,
  };

  switch (item?.id) {
    case "text":
      return <Type {...props} />;

    case "checkbox":
      return <SquareCheckBig {...props} />;

    case "task":
      return <CircleCheckBig {...props} />;

    case "bulleted-list":
      return <List {...props} />;

    case "numbered-list":
      return <ListOrdered {...props} />;

    case "toggle":
      return <ChevronRight {...props} />;

    case "heading-1":
      return <Heading1 {...props} />;

    case "heading-2":
      return <Heading2 {...props} />;

    case "heading-3":
      return <Heading3 {...props} />;

    case "quote":
      return <Quote {...props} />;

    case "divider":
      return <Minus {...props} />;

    case "callout":
      return <Lightbulb {...props} />;

    case "date":
      return <CalendarDays {...props} />;

    case "reminder":
      return <Bell {...props} />;
    case "table":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          TBL
        </span>
      );

    case "board":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          ▥
        </span>
      );

    case "gallery":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          ▦
        </span>
      );

    case "list-database":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          ☷
        </span>
      );

    case "calendar-database":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          31
        </span>
      );

    case "timeline":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          ↔
        </span>
      );

    case "chart":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          ▟
        </span>
      );

    case "linked-database":
      return (
        <span className="abide-command-symbol abide-command-database-symbol">
          ⛓
        </span>
      );



    default:
      break;
  }

  switch (item?.type) {
    case "date":
    case "datetime":
      return <CalendarDays {...props} />;

    case "time":
      return <Clock3 {...props} />;

    case "task":
      return <CircleCheckBig {...props} />;

    case "event":
      return <Calendar {...props} />;

    case "reminder":
      return <Bell {...props} />;

    case "journal":
      return <NotebookPen {...props} />;

    case "scratch":
      return <StickyNote {...props} />;

    case "page":
      return <FileText {...props} />;

    case "person":
      return <User {...props} />;

    case "collection":
      return <Table2 {...props} />;

    case "goal":
      return <Target {...props} />;

    default:
      return <Type {...props} />;
  }
}


export default function CommandMenu({
  menu,
  activeIndex,
  onChoose,
  onClose,
}) {
  if (
    !menu ||
    !menu.results?.length
  ) {
    return null;
  }

  const width =
    Math.min(
      420,
      window.innerWidth - 24
    );

  const left =
    Math.max(
      12,
      Math.min(
        menu.rect?.left || 12,
        window.innerWidth -
          width -
          12
      )
    );

  const preferredTop =
    (menu.rect?.bottom || 56) +
    8;

  const estimatedHeight =
    Math.min(
      500,
      58 * menu.results.length +
        50
    );

  const spaceBelow =
    window.innerHeight -
    preferredTop -
    12;

  const top =
    spaceBelow >=
    Math.min(
      estimatedHeight,
      240
    )
      ? preferredTop
      : Math.max(
          12,
          (menu.rect?.top || 56) -
            Math.min(
              estimatedHeight,
              window.innerHeight -
                24
            ) -
            8
        );


  return createPortal(
    <div
      className="abide-command-menu"
      style={{
        width,
        left,
        top,
      }}
      onPointerDown={(
        event
      ) =>
        event.preventDefault()
      }
    >
      <div className="abide-command-menu-head">
        <div>
          <strong>
            {menu.trigger}
          </strong>
          {menu.query ||
            "Type to search"}
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
        >
          esc
        </button>
      </div>

      {menu.results.map(
        (
          item,
          index
        ) => (
          <button
            type="button"
            key={`${item.type || item.action || "cmd"}:${item.id || item.label}:${index}`}
            className={`abide-command-menu-row ${
              index ===
              activeIndex
                ? "active"
                : ""
            }`}
            onPointerDown={(event) => {
              /*
               * Mouse users keep editor focus.
               *
               * Touch must NOT be prevented here.
               * iOS needs the pointer gesture so it can
               * distinguish scrolling from tapping.
               */
              if (
                event.pointerType === "mouse"
              ) {
                event.preventDefault();
              }
            }}
            onClick={() => {
              onChoose(
                item
              );
            }}
          >
            <span className="abide-command-menu-icon">
              <CommandIcon
                item={item}
              />
            </span>

            <span className="abide-command-menu-copy">
              <strong>
                {item.label}
              </strong>

              <small>
                {item.meta ||
                  item.description ||
                  item.group ||
                  item.type}
              </small>
            </span>
          </button>
        )
      )}
    </div>,
    document.body
  );
}


export function DatePickerModal({
  value,
  onChange,
  onSave,
  onClose,
}) {
  if (!value) {
    return null;
  }

  return createPortal(
    <div
      className="abide-command-modal-backdrop"
      onMouseDown={
        onClose
      }
    >
      <div
        className="abide-command-modal"
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <div className="abide-command-modal-head">
          <div>
            <strong>
              {value.reminder
                ? "Reminder"
                : "Date & time"}
            </strong>

            <small>
              {value.reminder
                ? "Create a real Abide reminder."
                : "Insert a real date or datetime."}
            </small>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </div>


        {value.reminder && (
          <>
            <label>
              Remind me about
            </label>

            <input
              value={
                value.title ||
                ""
              }
              onChange={(
                event
              ) =>
                onChange({
                  ...value,
                  title:
                    event.target
                      .value,
                })
              }
              placeholder="Reminder"
            />
          </>
        )}


        <label>Date</label>

        <input
          type="date"
          value={
            value.date ||
            ""
          }
          onChange={(
            event
          ) =>
            onChange({
              ...value,
              date:
                event.target
                  .value,
            })
          }
        />


        <label>
          Time
          {value.reminder
            ? ""
            : " · optional"}
        </label>

        <input
          type="time"
          value={
            value.time ||
            ""
          }
          onChange={(
            event
          ) =>
            onChange({
              ...value,
              time:
                event.target
                  .value,
            })
          }
        />


        <div className="abide-command-date-preview">
          {value.date
            ? formatDate(
                value.date
              )
            : "Choose a date"}

          {value.time
            ? ` · ${formatTime(
                value.time
              )}`
            : ""}
        </div>


        <button
          type="button"
          className="abide-command-save"
          onClick={
            onSave
          }
        >
          {value.reminder
            ? "Create reminder"
            : "Insert date"}
        </button>
      </div>
    </div>,
    document.body
  );
}


export function TaskPickerModal({
  value,
  onChange,
  onSave,
  onClose,
}) {
  if (!value) {
    return null;
  }

  return createPortal(
    <div
      className="abide-command-modal-backdrop"
      onMouseDown={
        onClose
      }
    >
      <div
        className="abide-command-modal abide-task-create-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="abide-command-modal-head">
          <div>
            <strong>
              Create task
            </strong>

            <small>
              This becomes a real task in Abide.
            </small>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </div>


        <label>
          Task
        </label>

        <input
          autoFocus
          value={
            value.title || ""
          }
          onChange={(event) =>
            onChange({
              ...value,
              title:
                event.target.value,
            })
          }
          placeholder="What needs to be done?"
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              value.title?.trim()
            ) {
              event.preventDefault();
              onSave();
            }
          }}
        />


        <label>
          Due date · optional
        </label>

        <input
          type="date"
          value={
            value.date || ""
          }
          onChange={(event) =>
            onChange({
              ...value,
              date:
                event.target.value,
            })
          }
        />


        <label>
          Due time · optional
        </label>

        <input
          type="time"
          value={
            value.time || ""
          }
          onChange={(event) =>
            onChange({
              ...value,
              time:
                event.target.value,
            })
          }
        />


        {(value.date || value.time) && (
          <div className="abide-command-date-preview">
            {value.date
              ? formatDate(
                  value.date
                )
              : "No due date"}

            {value.time
              ? ` · ${formatTime(
                  value.time
                )}`
              : ""}
          </div>
        )}


        <button
          type="button"
          className="abide-command-save"
          disabled={
            !value.title?.trim()
          }
          onClick={
            onSave
          }
        >
          Create task
        </button>
      </div>
    </div>,
    document.body
  );
}
