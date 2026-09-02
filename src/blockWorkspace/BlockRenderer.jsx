import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import ExtendedBlockRenderer from "./ExtendedBlockRenderer.jsx";

import {
  BLOCK_TYPES,
  formatDate,
  formatTime,
  getAbideTask,
  updateAbideTask,
} from "./workspaceCore.js";


function BlockChildren({
  blocks = [],
  onChange,
  onOpenSlash,
  onOpenMention,
  onEnter,
  onBackspaceStart,
  onRemove,
}) {
  if (!blocks.length) {
    return null;
  }

  return (
    <div className="abide-block-children">
      {blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          onChange={onChange}
          onOpenSlash={onOpenSlash}
          onOpenMention={onOpenMention}
          onEnter={onEnter}
          onBackspaceStart={onBackspaceStart}
        />
      ))}
    </div>
  );
}


function NativeText({
  block,
  className = "",
  placeholder =
    "Type / for commands or @ to mention…",
  onChange,
  onOpenSlash,
  onOpenMention,
  onPasteUrl,
  onEnter,
  onBackspaceStart,
}) {
  const ref =
    useRef(null);


  const resize =
    () => {
      const element =
        ref.current;

      if (!element) return;

      element.style.height =
        "0px";

      element.style.height =
        `${Math.max(
          26,
          element.scrollHeight
        )}px`;
    };


  useLayoutEffect(
    () => {
      resize();
    },
    [
      block.text,
      block.type,
    ]
  );


  const inspectTrigger =
    (element) => {
      const text =
        element.value || "";

      const caret =
        element.selectionStart ??
        text.length;

      const before =
        text.slice(
          0,
          caret
        );


      const slashMatch =
        before.match(
          /(?:^|\s)\/([^\s/]*)$/
        );

      if (slashMatch) {
        onOpenSlash?.({
          block: {
            ...block,
            text,
          },

          query:
            slashMatch[1] ||
            "",

          element,

          rect:
            element
              .getBoundingClientRect(),
        });

        return;
      }


      const mentionMatch =
        before.match(
          /(?:^|\s)@([^@\n]*)$/
        );

      if (mentionMatch) {
        onOpenMention?.({
          block: {
            ...block,
            text,
          },

          query:
            mentionMatch[1] ||
            "",

          element,

          rect:
            element
              .getBoundingClientRect(),
        });
      }
    };


  const handleChange =
    (event) => {
      const text =
        event.target.value;

      onChange?.({
        ...block,
        text,
        updatedAt:
          Date.now(),
      });

      requestAnimationFrame(
        resize
      );

      inspectTrigger(
        event.target
      );
    };

  const handlePaste =
    (event) => {
      const clipboardText =
        event.clipboardData
          ?.getData(
            "text/plain"
          )
          ?.trim() ||
        "";

      const isStandaloneUrl =
        /^https?:\/\/[^\s]+$/i.test(
          clipboardText
        );

      /*
       * Normal text pastes remain completely native.
       */
      if (
        !isStandaloneUrl ||
        !onPasteUrl
      ) {
        return;
      }

      event.preventDefault();

      const element =
        event.currentTarget;

      const text =
        element.value ||
        "";

      const start =
        element.selectionStart ??
        text.length;

      const end =
        element.selectionEnd ??
        start;

      onPasteUrl({
        block: {
          ...block,
          text,
        },

        url:
          clipboardText,

        start,

        end,

        element,

        rect:
          element.getBoundingClientRect(),
      });
    };




  const handleKeyDown =
    (event) => {
      if (
        event.defaultPrevented
      ) {
        return;
      }

      const element =
        event.currentTarget;

      const text =
        element.value || "";

      const start =
        element.selectionStart ??
        text.length;

      const end =
        element.selectionEnd ??
        start;


      if (
        event.key ===
          "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        onEnter?.({
          block: {
            ...block,
            text,
          },
          caret:
            start,
        });

        return;
      }


      if (
        event.key ===
          "Backspace" &&
        start === 0 &&
        end === 0
      ) {
        onBackspaceStart?.({
          block: {
            ...block,
            text,
          },
        });
      }
    };


  return (
    <textarea
      ref={ref}
      rows={1}
      value={
        block.text || ""
      }
      placeholder={
        placeholder
      }
      className={`abide-block-input ${className}`}
      onChange={
        handleChange
      }
      onPaste={
        handlePaste
      }

      onKeyDown={
        handleKeyDown
      }
      onKeyUp={(event) =>
        inspectTrigger(
          event.currentTarget
        )
      }
      spellCheck
    />
  );
}


function TodoBlock({
  block,
  onChange,
  onOpenSlash,
  onOpenMention,
  onPasteUrl,
  onEnter,
  onBackspaceStart,
}) {
  /* ABIDE TODO PASTE URL FIX V1 */
  const [
    linkedTask,
    setLinkedTask,
  ] =
    useState(
      block.taskId
        ? getAbideTask(
            block.taskId
          )
        : null
    );


  useEffect(
    () => {
      if (!block.taskId) {
        setLinkedTask(null);
        return;
      }

      const refresh =
        () => {
          setLinkedTask(
            getAbideTask(
              block.taskId
            )
          );
        };

      refresh();

      const handler =
        (event) => {
          if (
            event.detail?.key ===
            "abide-tasks"
          ) {
            refresh();
          }
        };

      window.addEventListener(
        "abide-local-data-changed",
        handler
      );

      return () =>
        window.removeEventListener(
          "abide-local-data-changed",
          handler
        );
    },
    [
      block.taskId,
    ]
  );


  const isRealTask =
    Boolean(
      block.taskId
    );

  const checked =
    isRealTask
      ? Boolean(
          linkedTask?.done
        )
      : Boolean(
          block.checked
        );


  const toggle =
    (event) => {
      const nextChecked =
        event.target.checked;

      if (
        isRealTask
      ) {
        const updated =
          updateAbideTask(
            block.taskId,
            {
              done:
                nextChecked,
            }
          );

        setLinkedTask(
          updated
        );
      }

      onChange?.({
        ...block,

        checked:
          nextChecked,

        updatedAt:
          Date.now(),
      });
    };


  const dueDate =
    linkedTask?.dueDate ||
    block.taskDueDate ||
    "";

  const dueTime =
    linkedTask?.dueTime ||
    block.taskDueTime ||
    "";


  return (
    <div
      className={`abide-block abide-block-todo ${
        isRealTask
          ? "abide-linked-task"
          : "abide-local-checkbox"
      }`}
      data-block-id={
        block.id
      }
    >
      <input
        type="checkbox"
        checked={
          checked
        }
        onChange={
          toggle
        }
      />

      <div className="abide-task-block-body">
        <NativeText
          block={{
            ...block,
            checked,
          }}
          onChange={
            onChange
          }
          onOpenSlash={
            onOpenSlash
          }
          onOpenMention={
            onOpenMention
          }
        onPasteUrl={onPasteUrl}
          onEnter={
            onEnter
          }
          onBackspaceStart={
            onBackspaceStart
          }
          className={
            checked
              ? "completed"
              : ""
          }
        />

        {isRealTask && (
          <div className="abide-linked-task-meta">
            <span className="abide-linked-task-chip">
              Task
            </span>

            {dueDate && (
              <span>
                {formatDate(
                  dueDate
                )}
              </span>
            )}

            {dueTime && (
              <span>
                {formatTime(
                  dueTime
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default function BlockRenderer({
  block,
  onChange,
  onOpenSlash,
  onOpenMention,
  onPasteUrl,
  onEnter,
  onBackspaceStart,
  onRemove,
}) {
  if (!block) {
    return null;
  }


  const common = {
    block,
    onChange,
    onOpenSlash,
    onOpenMention,
    onPasteUrl,
    onEnter,
    onBackspaceStart,
  };


  const extendedTypes = [
    BLOCK_TYPES.PAGE_LINK,
    BLOCK_TYPES.EQUATION,
    BLOCK_TYPES.CODE,
    BLOCK_TYPES.IMAGE,
    BLOCK_TYPES.VIDEO,
    BLOCK_TYPES.AUDIO,
    BLOCK_TYPES.FILE,
    BLOCK_TYPES.PDF,
    BLOCK_TYPES.BOOKMARK,
    BLOCK_TYPES.EMBED,
    BLOCK_TYPES.DATABASE,
  ];

  if (
    extendedTypes.includes(
      block.type
    )
  ) {
    return (
      <ExtendedBlockRenderer
        block={block}
        onChange={onChange}
        onOpenSlash={onOpenSlash}
        onOpenMention={onOpenMention}
        onEnter={onEnter}
        onBackspaceStart={onBackspaceStart}
        onRemove={onRemove}
      />
    );
  }


  switch (
    block.type
  ) {
    case BLOCK_TYPES.TEXT:
      return (
        <div
          className="abide-block"
          data-block-id={
            block.id
          }
        >
          <NativeText
            {...common}
          />
        </div>
      );


    case BLOCK_TYPES.TODO:
      return (
        <TodoBlock
          {...common}
        />
      );


    case BLOCK_TYPES.BULLETED_LIST:
      return (
        <div
          className="abide-block abide-block-list"
          data-block-id={
            block.id
          }
        >
          <span className="abide-list-marker">
            •
          </span>

          <NativeText
            {...common}
          />
        </div>
      );


    case BLOCK_TYPES.NUMBERED_LIST:
      return (
        <div
          className="abide-block abide-block-list"
          data-block-id={
            block.id
          }
        >
          <span className="abide-list-marker">
            1.
          </span>

          <NativeText
            {...common}
          />
        </div>
      );


    case BLOCK_TYPES.TOGGLE:
      return (
        <div
          className="abide-block abide-block-toggle"
          data-block-id={block.id}
        >
          <div className="abide-toggle-row">
            <button
              type="button"
              className="abide-toggle-button"
              aria-label={
                block.open === false
                  ? "Open toggle"
                  : "Close toggle"
              }
              onPointerDown={(event) =>
                event.preventDefault()
              }
              onClick={() =>
                onChange?.({
                  ...block,
                  open:
                    block.open === false,
                  updatedAt:
                    Date.now(),
                })
              }
            >
              <span
                className={`abide-toggle-chevron ${
                  block.open === false
                    ? ""
                    : "open"
                }`}
              >
                ›
              </span>
            </button>

            <div className="abide-toggle-title">
              <NativeText
                {...common}
              />
            </div>
          </div>

          {block.open !== false && (
            <div className="abide-toggle-content">
              <BlockChildren
                blocks={
                  block.children || []
                }
                onChange={
                  onChange
                }
                onOpenSlash={
                  onOpenSlash
                }
                onOpenMention={
                  onOpenMention
                }
              />
            </div>
          )}
        </div>
      );


    case BLOCK_TYPES.HEADING_1:
      return (
        <div
          className="abide-block"
          data-block-id={
            block.id
          }
        >
          <NativeText
            {...common}
            className="abide-block-h1"
          />
        </div>
      );


    case BLOCK_TYPES.HEADING_2:
      return (
        <div
          className="abide-block"
          data-block-id={
            block.id
          }
        >
          <NativeText
            {...common}
            className="abide-block-h2"
          />
        </div>
      );


    case BLOCK_TYPES.HEADING_3:
      return (
        <div
          className="abide-block"
          data-block-id={
            block.id
          }
        >
          <NativeText
            {...common}
            className="abide-block-h3"
          />
        </div>
      );


    case BLOCK_TYPES.QUOTE:
      return (
        <blockquote
          className="abide-block abide-block-quote"
          data-block-id={
            block.id
          }
        >
          <NativeText
            {...common}
          />
        </blockquote>
      );


    case BLOCK_TYPES.DIVIDER:
      return (
        <div
          className="abide-block abide-block-divider"
          data-block-id={
            block.id
          }
        >
          <hr />
        </div>
      );


    case BLOCK_TYPES.CALLOUT:
      return (
        <div
          className="abide-block abide-block-callout"
          data-block-id={
            block.id
          }
        >
          <span className="abide-callout-icon">
            {block.icon ||
              "💡"}
          </span>

          <NativeText
            {...common}
          />
        </div>
      );


    default:
      return (
        <div
          className="abide-block"
          data-block-id={
            block.id
          }
        >
          <NativeText
            {...common}
          />
        </div>
      );
  }
}
