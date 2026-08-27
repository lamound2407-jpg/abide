import React from "react";

import {
  BLOCK_TYPES,
} from "./workspaceCore.js";


function BlockChildren({
  blocks = [],
  onChange,
  onOpenSlash,
  onOpenMention,
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
}) {
  const Tag = tag;

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
      className={`abide-block-richtext ${className}`}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyUp={handleKeyUp}
    >
      {block.text || ""}
    </Tag>
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
