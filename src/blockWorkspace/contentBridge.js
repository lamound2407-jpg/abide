import {
  BLOCK_TYPES,
  createBlock,
} from "./workspaceCore.js";

import {
  autoLinkEscapedText,
} from "../AutoLink.jsx";


function escapeHtml(
  value
) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function htmlToText(
  html
) {
  if (
    typeof document ===
    "undefined"
  ) {
    return String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const holder =
    document.createElement(
      "div"
    );

  holder.innerHTML =
    String(html || "");

  return (
    holder.textContent ||
    holder.innerText ||
    ""
  )
    .replace(/\u00a0/g, " ")
    .trim();
}


function splitLegacyText(
  text
) {
  const normalized =
    String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

  const paragraphs =
    normalized
      .split(/\n{2,}/)
      .map(
        (part) =>
          part.trim()
      )
      .filter(Boolean);

  if (
    paragraphs.length
  ) {
    return paragraphs;
  }

  return normalized.trim()
    ? [normalized.trim()]
    : [];
}


export function legacyHtmlToWorkspaceBlocks(
  html
) {
  const text =
    htmlToText(html);

  const paragraphs =
    splitLegacyText(text);

  if (
    !paragraphs.length
  ) {
    return [
      createBlock({
        type:
          BLOCK_TYPES.TEXT,

        text: "",
      }),
    ];
  }

  return paragraphs.map(
    (paragraph) =>
      createBlock({
        type:
          BLOCK_TYPES.TEXT,

        text:
          paragraph,
      })
  );
}


export function normalizeWorkspaceBlocks(
  blocks,
  legacyHtml = ""
) {
  if (
    Array.isArray(blocks) &&
    blocks.length
  ) {
    return blocks;
  }

  return legacyHtmlToWorkspaceBlocks(
    legacyHtml
  );
}


function blockTextHtml(
  block
) {
  const text =
    autoLinkEscapedText(
      escapeHtml(
        block.text || ""
      )
    )
      .replace(
        /\n/g,
        "<br>"
      );

  switch (
    block.type
  ) {
    case BLOCK_TYPES.HEADING_1:
      return `<h1>${text}</h1>`;

    case BLOCK_TYPES.HEADING_2:
      return `<h2>${text}</h2>`;

    case BLOCK_TYPES.HEADING_3:
      return `<h3>${text}</h3>`;

    case BLOCK_TYPES.QUOTE:
      return `<blockquote>${text}</blockquote>`;

    case BLOCK_TYPES.TODO:
      return `<div class="abide-saved-todo">
        <span>${block.checked ? "☑" : "☐"}</span>
        <span>${text}</span>
      </div>`;

    case BLOCK_TYPES.BULLETED_LIST:
      return `<ul><li>${text}</li></ul>`;

    case BLOCK_TYPES.NUMBERED_LIST:
      return `<ol><li>${text}</li></ol>`;

    case BLOCK_TYPES.TOGGLE:
      return `<details ${block.open === false ? "" : "open"}>
        <summary>${text}</summary>
        ${
          Array.isArray(
            block.children
          )
            ? workspaceBlocksToHtml(
                block.children
              )
            : ""
        }
      </details>`;

    case BLOCK_TYPES.DIVIDER:
      return "<hr>";

    case BLOCK_TYPES.CALLOUT:
      return `<div class="abide-saved-callout">
        <span>${escapeHtml(
          block.icon || "💡"
        )}</span>
        <div>${text}</div>
      </div>`;

    case BLOCK_TYPES.PAGE_LINK:
      return `<div class="abide-saved-page-link"
        data-abide-page-id="${escapeHtml(
          block.pageId || ""
        )}">
        ${text || "Untitled page"}
      </div>`;

    case BLOCK_TYPES.EQUATION:
      return `<div class="abide-saved-equation">
        ${text}
      </div>`;

    case BLOCK_TYPES.CODE:
      return `<pre><code>${text}</code></pre>`;

    case BLOCK_TYPES.IMAGE:
      return block.url
        ? `<figure>
            <img src="${escapeHtml(
              block.url
            )}" alt="${escapeHtml(
              block.fileName ||
              block.text ||
              ""
            )}">
            ${
              text
                ? `<figcaption>${text}</figcaption>`
                : ""
            }
          </figure>`
        : `<div>${escapeHtml(
            block.fileName ||
            "Image"
          )}</div>`;

    case BLOCK_TYPES.VIDEO:
      return block.url
        ? `<div>
            <a href="${escapeHtml(
              block.url
            )}">Video: ${escapeHtml(
              block.fileName ||
              block.text ||
              "Open video"
            )}</a>
          </div>`
        : `<div>${escapeHtml(
            block.fileName ||
            "Video"
          )}</div>`;

    case BLOCK_TYPES.AUDIO:
      return block.url
        ? `<div>
            <a href="${escapeHtml(
              block.url
            )}">Audio: ${escapeHtml(
              block.fileName ||
              block.text ||
              "Open audio"
            )}</a>
          </div>`
        : `<div>${escapeHtml(
            block.fileName ||
            "Audio"
          )}</div>`;

    case BLOCK_TYPES.FILE:
      return block.url
        ? `<div>
            <a href="${escapeHtml(
              block.url
            )}">${escapeHtml(
              block.fileName ||
              "Attached file"
            )}</a>
          </div>`
        : `<div>${escapeHtml(
            block.fileName ||
            "Attached file"
          )}</div>`;

    case BLOCK_TYPES.PDF:
      return block.url
        ? `<div>
            <a href="${escapeHtml(
              block.url
            )}">PDF: ${escapeHtml(
              block.fileName ||
              "Open PDF"
            )}</a>
          </div>`
        : `<div>${escapeHtml(
            block.fileName ||
            "PDF"
          )}</div>`;

    case BLOCK_TYPES.BOOKMARK:
      return block.url
        ? `<div>
            <a href="${escapeHtml(
              block.url
            )}">${text ||
              escapeHtml(
                block.url
              )}</a>
          </div>`
        : `<div>${text}</div>`;

    case BLOCK_TYPES.EMBED:
      return block.url
        ? `<div>
            <a href="${escapeHtml(
              block.url
            )}">Embedded content</a>
          </div>`
        : `<div>${text}</div>`;

    case BLOCK_TYPES.TEXT:
    default:
      return `<div>${text || "<br>"}</div>`;
  }
}


export function workspaceBlocksToHtml(
  blocks
) {
  if (
    !Array.isArray(blocks)
  ) {
    return "";
  }

  return blocks
    .map(
      blockTextHtml
    )
    .join("");
}


function blockToPlainText(
  block
) {
  const text =
    String(
      block.text || ""
    );

  switch (
    block.type
  ) {
    case BLOCK_TYPES.TODO:
      return `${block.checked ? "☑" : "☐"} ${text}`;

    case BLOCK_TYPES.BULLETED_LIST:
      return `• ${text}`;

    case BLOCK_TYPES.NUMBERED_LIST:
      return `1. ${text}`;

    case BLOCK_TYPES.QUOTE:
      return `“${text}”`;

    case BLOCK_TYPES.DIVIDER:
      return "────────";

    case BLOCK_TYPES.CALLOUT:
      return `${block.icon || "💡"} ${text}`;

    case BLOCK_TYPES.PAGE_LINK:
      return `Page: ${text || "Untitled"}`;

    case BLOCK_TYPES.EQUATION:
      return `Equation: ${text}`;

    case BLOCK_TYPES.CODE:
      return text;

    case BLOCK_TYPES.IMAGE:
      return [
        block.fileName || "Image",
        text,
        block.url,
      ]
        .filter(Boolean)
        .join(" — ");

    case BLOCK_TYPES.VIDEO:
      return [
        block.fileName || "Video",
        text,
        block.url,
      ]
        .filter(Boolean)
        .join(" — ");

    case BLOCK_TYPES.AUDIO:
      return [
        block.fileName || "Audio",
        text,
        block.url,
      ]
        .filter(Boolean)
        .join(" — ");

    case BLOCK_TYPES.FILE:
      return [
        block.fileName || "File",
        block.url,
      ]
        .filter(Boolean)
        .join(" — ");

    case BLOCK_TYPES.PDF:
      return [
        block.fileName || "PDF",
        block.url,
      ]
        .filter(Boolean)
        .join(" — ");

    case BLOCK_TYPES.BOOKMARK:
      return [
        text,
        block.url,
      ]
        .filter(Boolean)
        .join(" — ");

    case BLOCK_TYPES.EMBED:
      return [
        "Embed",
        block.url,
      ]
        .filter(Boolean)
        .join(" — ");

    case BLOCK_TYPES.TOGGLE: {
      const children =
        Array.isArray(
          block.children
        )
          ? workspaceBlocksToPlainText(
              block.children
            )
          : "";

      return [
        text,
        children,
      ]
        .filter(Boolean)
        .join("\n");
    }

    default:
      return text;
  }
}


export function workspaceBlocksToPlainText(
  blocks
) {
  if (
    !Array.isArray(blocks)
  ) {
    return "";
  }

  return blocks
    .map(
      blockToPlainText
    )
    .filter(
      (value) =>
        String(value)
          .trim()
    )
    .join("\n\n")
    .trim();
}


export function workspaceBlockReferences(
  blocks
) {
  const references = [];
  const seen =
    new Set();

  const visit =
    (list) => {
      (
        Array.isArray(list)
          ? list
          : []
      ).forEach(
        (block) => {
          (
            block.mentionRefs ||
            []
          ).forEach(
            (ref) => {
              if (
                !ref?.type ||
                ref?.id == null
              ) {
                return;
              }

              const key =
                `${ref.type}:${ref.id}`;

              if (
                seen.has(key)
              ) {
                return;
              }

              seen.add(key);

              references.push({
                type:
                  ref.type,

                id:
                  ref.id,

                label:
                  ref.label ||
                  "",
              });
            }
          );


          (
            block.dateRefs ||
            []
          ).forEach(
            (ref) => {
              const id =
                ref.time
                  ? `${ref.dateKey}T${ref.time}`
                  : ref.dateKey;

              const type =
                ref.time
                  ? "datetime"
                  : "date";

              const key =
                `${type}:${id}`;

              if (
                seen.has(key)
              ) {
                return;
              }

              seen.add(key);

              references.push({
                type,
                id,
              });
            }
          );


          (
            block.reminderRefs ||
            []
          ).forEach(
            (ref) => {
              if (
                ref?.id == null
              ) {
                return;
              }

              const key =
                `reminder:${ref.id}`;

              if (
                seen.has(key)
              ) {
                return;
              }

              seen.add(key);

              references.push({
                type:
                  "reminder",

                id:
                  ref.id,

                label:
                  ref.title ||
                  "",
              });
            }
          );


          if (
            Array.isArray(
              block.children
            )
          ) {
            visit(
              block.children
            );
          }
        }
      );
    };


  visit(blocks);

  return references;
}
