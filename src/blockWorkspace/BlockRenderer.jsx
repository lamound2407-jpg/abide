import React, {
  useLayoutEffect,
  useRef,
} from "react";

import {
  BLOCK_TYPES,
} from "./workspaceCore.js";


function BlockChildren({
  blocks = [],
  onChange,
  onOpenSlash,
  onOpenMention,
  onEnter,
  onBackspaceStart,
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


export default function BlockRenderer({
  block,
  onChange,
  onOpenSlash,
  onOpenMention,
  onEnter,
  onBackspaceStart,
}) {
  if (!block) {
    return null;
  }


  const common = {
    block,
    onChange,
    onOpenSlash,
    onOpenMention,
    onEnter,
    onBackspaceStart,
  };


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
        <div
          className="abide-block abide-block-todo"
          data-block-id={
            block.id
          }
        >
          <input
            type="checkbox"
            checked={
              Boolean(
                block.checked
              )
            }
            onChange={(event) =>
              onChange?.({
                ...block,
                checked:
                  event.target
                    .checked,
                updatedAt:
                  Date.now(),
              })
            }
          />

          <NativeText
            {...common}
            className={
              block.checked
                ? "completed"
                : ""
            }
          />
        </div>
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
        <details
          className="abide-block abide-block-toggle"
          data-block-id={
            block.id
          }
          open={
            block.open !== false
          }
        >
          <summary>
            <NativeText
              {...common}
            />
          </summary>

          <BlockChildren
            blocks={
              block.children ||
              []
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
            onEnter={
              onEnter
            }
            onBackspaceStart={
              onBackspaceStart
            }
          />
        </details>
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
