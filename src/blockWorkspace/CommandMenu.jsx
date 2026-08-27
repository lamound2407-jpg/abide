import React from "react";
import {
  createPortal,
} from "react-dom";

import {
  formatDate,
  formatTime,
} from "./workspaceCore.js";


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
      360,
      window.innerWidth - 16
    );

  const left =
    Math.max(
      8,
      Math.min(
        menu.rect?.left || 8,
        window.innerWidth -
          width -
          8
      )
    );

  const top =
    Math.max(
      56,
      Math.min(
        (menu.rect?.bottom || 56) +
          6,
        window.innerHeight -
          460
      )
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
            onPointerDown={(
              event
            ) => {
              event.preventDefault();
              onChoose(
                item
              );
            }}
          >
            <span className="abide-command-menu-icon">
              {item.type ===
                "date" ||
              item.type ===
                "datetime"
                ? "◷"
                : item.type ===
                    "task"
                  ? "✓"
                  : item.type ===
                      "event"
                    ? "◫"
                    : item.group ===
                        "Media"
                      ? "▧"
                      : item.group ===
                          "Collections"
                        ? "▦"
                        : item.group ===
                            "Inline"
                          ? "@"
                          : "T"}
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
