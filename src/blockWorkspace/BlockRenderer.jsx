import React, {
  useEffect,
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
  onBackspaceEmpty,
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
        />
      ))}
    </div>
  );
}


function RichText({
  block,
  tag = "div",
  className = "",
  onChange,
  onOpenSlash,
  onOpenMention,
  onEnter,
  onBackspaceEmpty,
}) {
  const Tag = tag;

  const editorRef =
    useRef(null);

  useEffect(
    () => {
      const element =
        editorRef.current;

      if (!element) return;

      const nextText =
        String(
          block.text || ""
        );

      // Only touch the DOM when the text is actually
      // different. Normal typing already changed the DOM,
      // so React must not rewrite it and destroy the caret.
      if (
        element.textContent !==
        nextText
      ) {
        element.textContent =
          nextText;

        // Programmatic block changes such as slash commands
        // should leave the caret at the end of the new text.
        if (
          document.activeElement ===
          element
        ) {
          const selection =
            window.getSelection();

          const range =
            document.createRange();

          range.selectNodeContents(
            element
          );

          range.collapse(false);

          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    },
    [
      block.id,
      block.text,
    ]
  );

  const handleInput = (event) => {
    const text =
      event.currentTarget
        .textContent || "";

    onChange?.({
      ...block,
      text,
      updatedAt:
        Date.now(),
    });
  };


  const handleKeyDown = (
    event
  ) => {
    const text =
      event.currentTarget
        .textContent || "";

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      let caret =
        text.length;

      try {
        const selection =
          window.getSelection();

        if (
          selection?.rangeCount
        ) {
          const range =
            selection
              .getRangeAt(0)
              .cloneRange();

          range.selectNodeContents(
            event.currentTarget
          );

          range.setEnd(
            selection.anchorNode,
            selection.anchorOffset
          );

          caret =
            range
              .toString()
              .length;
        }
      } catch {}

      onEnter?.(
        block,
        caret
      );

      return;
    }

    if (
      event.key === "Backspace" &&
      !text
    ) {
      event.preventDefault();

      onBackspaceEmpty?.(
        block
      );
    }
  };


  const handleKeyUp = (
    event
  ) => {
    const text =
      event.currentTarget
        .textContent || "";

    const selection =
      window.getSelection();

    const caret =
      selection?.anchorOffset ??
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
        block,
        query:
          slashMatch[1] ||
          "",
        element:
          event.currentTarget,
        rect:
          event.currentTarget
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
        block,
        query:
          mentionMatch[1] ||
          "",
        element:
          event.currentTarget,
        rect:
          event.currentTarget
            .getBoundingClientRect(),
      });
    }
  };


  return (
    <Tag
      ref={editorRef}
      className={`abide-block-richtext ${className}`}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    />
  );
}


export default function BlockRenderer({
  block,
  onChange,
  onOpenSlash,
  onOpenMention,
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
    onBackspaceEmpty,
  };


  switch (block.type) {
    case BLOCK_TYPES.TEXT:
      return (
        <div
          className="abide-block"
          data-block-id={block.id}
        >
          <RichText
            {...common}
          />
        </div>
      );


    case BLOCK_TYPES.TODO:
      return (
        <div
          className="abide-block abide-block-todo"
          data-block-id={block.id}
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

          <RichText
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
          data-block-id={block.id}
        >
          <span className="abide-list-marker">
            •
          </span>

          <RichText
            {...common}
          />
        </div>
      );


    case BLOCK_TYPES.NUMBERED_LIST:
      return (
        <div
          className="abide-block abide-block-list"
          data-block-id={block.id}
        >
          <span className="abide-list-marker">
            1.
          </span>

          <RichText
            {...common}
          />
        </div>
      );


    case BLOCK_TYPES.TOGGLE:
      return (
        <details
          className="abide-block abide-block-toggle"
          data-block-id={block.id}
          open={
            block.open !== false
          }
          onToggle={(event) =>
            onChange?.({
              ...block,
              open:
                event.currentTarget
                  .open,
              updatedAt:
                Date.now(),
            })
          }
        >
          <summary>
            <RichText
              {...common}
              tag="span"
            />
          </summary>

          <BlockChildren
            blocks={
              block.children ||
              []
            }
            onChange={onChange}
            onOpenSlash={onOpenSlash}
            onOpenMention={onOpenMention}
          />
        </details>
      );


    case BLOCK_TYPES.HEADING_1:
      return (
        <div
          className="abide-block"
          data-block-id={block.id}
        >
          <RichText
            {...common}
            tag="h1"
          />
        </div>
      );


    case BLOCK_TYPES.HEADING_2:
      return (
        <div
          className="abide-block"
          data-block-id={block.id}
        >
          <RichText
            {...common}
            tag="h2"
          />
        </div>
      );


    case BLOCK_TYPES.HEADING_3:
      return (
        <div
          className="abide-block"
          data-block-id={block.id}
        >
          <RichText
            {...common}
            tag="h3"
          />
        </div>
      );


    case BLOCK_TYPES.QUOTE:
      return (
        <blockquote
          className="abide-block abide-block-quote"
          data-block-id={block.id}
        >
          <RichText
            {...common}
          />
        </blockquote>
      );


    case BLOCK_TYPES.DIVIDER:
      return (
        <div
          className="abide-block abide-block-divider"
          data-block-id={block.id}
          contentEditable={false}
        >
          <hr />
        </div>
      );


    case BLOCK_TYPES.CALLOUT:
      return (
        <div
          className="abide-block abide-block-callout"
          data-block-id={block.id}
        >
          <span
            className="abide-callout-icon"
            contentEditable={false}
          >
            {block.icon || "💡"}
          </span>

          <RichText
            {...common}
          />
        </div>
      );


    default:
      return (
        <div
          className="abide-block"
          data-block-id={block.id}
        >
          <RichText
            {...common}
          />
        </div>
      );
  }
}
