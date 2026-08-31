import React, {
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import katex from "katex";
import "katex/dist/katex.min.css";

import {
  BLOCK_TYPES,
} from "./workspaceCore.js";

import DatabaseBlock from "./DatabaseBlock.jsx";


function ExtendedText({
  block,
  onChange,
  onOpenSlash,
  onOpenMention,
  onEnter,
  onBackspaceStart,
  className = "",
  placeholder = "",
}) {
  const ref =
    useRef(null);


  const resize =
    () => {
      const element =
        ref.current;

      if (!element) {
        return;
      }

      element.style.height =
        "0px";

      element.style.height =
        `${Math.max(
          28,
          element.scrollHeight
        )}px`;
    };


  useLayoutEffect(
    () => {
      resize();
    },
    [
      block.text,
    ]
  );


  const inspect =
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


      const slash =
        before.match(
          /(?:^|\s)\/([^\s/]*)$/
        );

      if (slash) {
        onOpenSlash?.({
          block: {
            ...block,
            text,
          },

          query:
            slash[1] || "",

          element,

          rect:
            element
              .getBoundingClientRect(),
        });

        return;
      }


      const mention =
        before.match(
          /(?:^|\s)@([^@\n]*)$/
        );

      if (mention) {
        onOpenMention?.({
          block: {
            ...block,
            text,
          },

          query:
            mention[1] || "",

          element,

          rect:
            element
              .getBoundingClientRect(),
        });
      }
    };


  const handleKeyDown =
    (event) => {
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


      /*
       * Enter exits this special block and creates
       * normal writing beneath it.
       */
      if (
        event.key === "Enter" &&
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


      /*
       * Backspace at the beginning uses the exact
       * same block-removal / conversion behavior as
       * the normal Abide editor.
       */
      if (
        event.key === "Backspace" &&
        start === 0 &&
        end === 0
      ) {
        event.preventDefault();

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
      ref={
        ref
      }
      className={`abide-block-input abide-extended-input ${className}`}
      value={
        block.text || ""
      }
      placeholder={
        placeholder
      }
      rows={
        1
      }
      spellCheck={
        className !==
        "abide-code-input"
      }
      onKeyDown={
        handleKeyDown
      }
      onChange={(event) => {
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

        inspect(
          event.target
        );
      }}
    />
  );
}


function MediaCaption({
  block,
  onChange,
  onOpenSlash,
  onOpenMention,
  onEnter,
  onBackspaceStart,
  onRemove,
}) {
  return (
    <ExtendedText
      block={
        block
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
      className="abide-media-caption"
      placeholder="Add a caption…"
    />
  );
}


function BlockActions({
  block,
  onEnter,
  onRemove,
}) {
  return (
    <div className="abide-special-block-actions">
      <button
        type="button"
        onClick={() =>
          onEnter?.({
            block,
            caret:
              String(
                block?.text || ""
              ).length,
          })
        }
      >
        Continue below
      </button>

      <button
        type="button"
        className="danger"
        onClick={() =>
          onRemove?.(
            block.id
          )
        }
      >
        Remove
      </button>
    </div>
  );
}


function UploadStatus({
  block,
}) {
  if (
    block.uploading
  ) {
    return (
      <div className="abide-upload-status">
        <span className="abide-upload-spinner" />
        Uploading {block.fileName || "file"}…
      </div>
    );
  }

  if (
    block.uploadError
  ) {
    return (
      <div className="abide-upload-error">
        <strong>
          Upload failed
        </strong>

        <span>
          {block.uploadError}
        </span>
      </div>
    );
  }

  return null;
}


export default function ExtendedBlockRenderer({
  block,
  onChange,
  onOpenSlash,
  onOpenMention,
  onEnter,
  onBackspaceStart,
  onRemove,
}) {
  if (!block) {
    return null;
  }


  switch (block.type) {
    case BLOCK_TYPES.DATABASE:
      return (
        <DatabaseBlock
          block={block}
          onChange={onChange}
          onEnter={onEnter}
          onRemove={onRemove}
        />
      );


    case BLOCK_TYPES.PAGE_LINK:
      return (
        <div
          className="abide-block abide-page-link-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          <span className="abide-extended-leading-icon">
            ↗
          </span>

          <ExtendedText
            block={
              block
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
            placeholder="Untitled page"
          />

          <span className="abide-page-link-label">
            Page
          </span>
        </div>
      );


    case BLOCK_TYPES.EQUATION: {
      let renderedEquation = "";

      try {
        renderedEquation =
          katex.renderToString(
            block.text || "",
            {
              throwOnError:
                false,

              displayMode:
                true,

              strict:
                false,
            }
          );
      } catch {
        renderedEquation = "";
      }


      return (
        <div
          className="abide-block abide-equation-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          <div className="abide-equation-editor">
            <div className="abide-equation-label">
              Equation
            </div>

            <ExtendedText
              block={
                block
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
              className="abide-equation-input"
              placeholder="Type an equation, e.g. x^2 + y^2 = z^2"
            />
          </div>

          {String(
            block.text || ""
          ).trim() && (
            <div
              className="abide-equation-preview"
              dangerouslySetInnerHTML={{
                __html:
                  renderedEquation,
              }}
            />
          )}

          <div className="abide-equation-help">
            Enter to continue writing · Shift + Enter for another line
          </div>
        </div>
      );
    }


    case BLOCK_TYPES.CODE:
      return (
        <div
          className="abide-block abide-code-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          <div className="abide-code-header">
            Code
          </div>

          <ExtendedText
            block={
              block
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
            className="abide-code-input"
            placeholder="Write or paste code…"
          />
        </div>
      );


    case BLOCK_TYPES.IMAGE:
      return (
        <div
          className="abide-block abide-media-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          {block.url ? (
            <img
              className="abide-workspace-image"
              src={
                block.url
              }
              alt={
                block.fileName ||
                block.text ||
                ""
              }
            />
          ) : (
            <div className="abide-media-empty">
              Image
            </div>
          )}

          <MediaCaption
            block={
              block
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
        </div>
      );


    case BLOCK_TYPES.VIDEO:
      return (
        <div
          className="abide-block abide-media-block"
          data-block-id={
            block.id
          }
        >
          {block.url ? (
            <video
              className="abide-workspace-video"
              src={
                block.url
              }
              controls
              playsInline
            />
          ) : (
            <div className="abide-media-empty">
              Video
            </div>
          )}

          <MediaCaption
            block={
              block
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
        </div>
      );


    case BLOCK_TYPES.AUDIO:
      return (
        <div
          className="abide-block abide-media-block abide-audio-block"
          data-block-id={
            block.id
          }
        >
          {block.fileName && (
            <div className="abide-file-title">
              {block.fileName}
            </div>
          )}

          {block.url ? (
            <audio
              className="abide-workspace-audio"
              src={
                block.url
              }
              controls
            />
          ) : (
            <div className="abide-media-empty">
              Audio
            </div>
          )}

          <MediaCaption
            block={
              block
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
        </div>
      );


    case BLOCK_TYPES.FILE:
      return (
        <div
          className="abide-block abide-file-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          <span className="abide-extended-leading-icon">
            ↧
          </span>

          <a
            href={
              block.url || "#"
            }
            target="_blank"
            rel="noreferrer"
            className="abide-file-link"
          >
            {block.fileName ||
              "Attached file"}
          </a>
        </div>
      );


    case BLOCK_TYPES.PDF: {
      const size =
        Number(
          block.fileSize || 0
        );

      const sizeLabel =
        size >= 1024 * 1024
          ? `${(
              size /
              (1024 * 1024)
            ).toFixed(1)} MB`
          : size >= 1024
            ? `${Math.round(
                size / 1024
              )} KB`
            : size
              ? `${size} B`
              : "";

      return (
        <div
          className="abide-block abide-pdf-block abide-safe-pdf-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          <div className="abide-pdf-card">
            <div className="abide-pdf-card-icon">
              PDF
            </div>

            <div className="abide-pdf-card-copy">
              <strong>
                {block.fileName ||
                  "PDF document"}
              </strong>

              <small>
                {[
                  "PDF",
                  sizeLabel,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </div>

            {block.url && (
              <a
                className="abide-pdf-open-button"
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open PDF
              </a>
            )}
          </div>

          {!block.uploading &&
            !block.uploadError &&
            !block.url && (
              <div className="abide-pdf-awaiting">
                No PDF is attached to this block.
              </div>
            )}
        </div>
      );
    }


    case BLOCK_TYPES.BOOKMARK:
      return (
        <div
          className="abide-block abide-bookmark-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          <a
            href={
              block.url || "#"
            }
            target="_blank"
            rel="noreferrer"
            className="abide-bookmark-link"
          >
            <span className="abide-bookmark-icon">
              ↗
            </span>

            <span className="abide-bookmark-copy">
              <strong>
                {block.text ||
                  block.url ||
                  "Web bookmark"}
              </strong>

              <small>
                {block.url}
              </small>
            </span>
          </a>
        </div>
      );


    case BLOCK_TYPES.EMBED:
      return (
        <div
          className="abide-block abide-embed-block"
          data-block-id={
            block.id
          }
        >
          <BlockActions
            block={block}
            onEnter={onEnter}
            onRemove={onRemove}
          />

          <UploadStatus
            block={block}
          />

          {block.url ? (
            <>
              <iframe
                className="abide-embed-frame"
                title={
                  block.text ||
                  "Embedded content"
                }
                src={
                  block.url
                }
                allowFullScreen
              />

              <a
                className="abide-media-open-link"
                href={
                  block.url
                }
                target="_blank"
                rel="noreferrer"
              >
                Open source
              </a>
            </>
          ) : (
            <div className="abide-media-empty">
              Embed
            </div>
          )}
        </div>
      );


    default:
      return null;
  }
}
