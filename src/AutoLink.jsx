import React from "react";

/* =========================================================
   ABIDE AUTO LINK V1
   Turns URLs in ordinary saved text into safe hyperlinks.
   ========================================================= */

const URL_PATTERN =
  /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;


function splitTrailingPunctuation(
  value
) {
  let url = String(value || "");
  let trailing = "";

  /*
   * Do not swallow punctuation that normally follows a URL
   * in a sentence.
   */
  while (
    url &&
    /[.,!?;:]$/.test(url)
  ) {
    trailing =
      url.slice(-1) +
      trailing;

    url =
      url.slice(
        0,
        -1
      );
  }

  /*
   * Handle closing parentheses/brackets only when there is
   * not a matching opener inside the URL.
   */
  const pairs = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];

  for (
    const [
      opener,
      closer,
    ] of pairs
  ) {
    while (
      url.endsWith(
        closer
      )
    ) {
      const opens =
        (
          url.match(
            new RegExp(
              `\\${opener}`,
              "g"
            )
          ) || []
        ).length;

      const closes =
        (
          url.match(
            new RegExp(
              `\\${closer}`,
              "g"
            )
          ) || []
        ).length;

      if (
        closes <= opens
      ) {
        break;
      }

      trailing =
        closer +
        trailing;

      url =
        url.slice(
          0,
          -1
        );
    }
  }

  return {
    url,
    trailing,
  };
}


export function normalizeAutoLinkUrl(
  value
) {
  const text =
    String(value || "");

  if (
    /^www\./i.test(
      text
    )
  ) {
    return `https://${text}`;
  }

  return text;
}


export default function AutoLink({
  text,
  className,
  style,
}) {
  const value =
    String(
      text ?? ""
    );

  const pieces = [];
  let cursor = 0;
  let match;
  let index = 0;

  URL_PATTERN.lastIndex = 0;

  while (
    (
      match =
        URL_PATTERN.exec(
          value
        )
    )
  ) {
    if (
      match.index >
      cursor
    ) {
      pieces.push(
        value.slice(
          cursor,
          match.index
        )
      );
    }

    const {
      url,
      trailing,
    } =
      splitTrailingPunctuation(
        match[0]
      );

    if (url) {
      pieces.push(
        <a
          key={`abide-link-${index}`}
          href={
            normalizeAutoLinkUrl(
              url
            )
          }
          target="_blank"
          rel="noopener noreferrer"
          onClick={(
            event
          ) => {
            /*
             * Task rows and cards often have their own click
             * handlers. Opening a link must not also open or
             * collapse the surrounding item.
             */
            event.stopPropagation();
          }}
          style={{
            color:
              "#7C93C9",
            textDecoration:
              "underline",
            textUnderlineOffset:
              2,
            overflowWrap:
              "anywhere",
          }}
        >
          {url}
        </a>
      );

      if (
        trailing
      ) {
        pieces.push(
          trailing
        );
      }
    } else {
      pieces.push(
        match[0]
      );
    }

    cursor =
      match.index +
      match[0].length;

    index += 1;
  }

  if (
    cursor <
    value.length
  ) {
    pieces.push(
      value.slice(
        cursor
      )
    );
  }

  return (
    <span
      className={
        className
      }
      style={{
        whiteSpace:
          "pre-wrap",
        overflowWrap:
          "anywhere",
        ...style,
      }}
    >
      {pieces.length
        ? pieces
        : value}
    </span>
  );
}


/*
 * HTML-side linker used by saved Workspace content.
 * The input passed here should already be escaped.
 */
export function autoLinkEscapedText(
  escapedText
) {
  const value =
    String(
      escapedText || ""
    );

  return value.replace(
    URL_PATTERN,
    (
      raw
    ) => {
      const {
        url,
        trailing,
      } =
        splitTrailingPunctuation(
          raw
        );

      if (!url) {
        return raw;
      }

      const href =
        normalizeAutoLinkUrl(
          url
        );

      return (
        `<a class="abide-auto-link" ` +
        `href="${href}" ` +
        `target="_blank" ` +
        `rel="noopener noreferrer">` +
        `${url}</a>${trailing}`
      );
    }
  );
}


/*
 * Linkify existing saved HTML without changing tags that
 * are already hyperlinks.
 */
export function autoLinkExistingHtml(
  html
) {
  const source =
    String(html || "");

  if (
    typeof document ===
    "undefined"
  ) {
    return source;
  }

  const holder =
    document.createElement(
      "div"
    );

  holder.innerHTML =
    source;

  const walker =
    document.createTreeWalker(
      holder,
      NodeFilter.SHOW_TEXT
    );

  const targets = [];

  while (
    walker.nextNode()
  ) {
    const node =
      walker.currentNode;

    const parent =
      node.parentElement;

    if (
      !parent ||
      parent.closest(
        "a,code,pre,script,style"
      )
    ) {
      continue;
    }

    if (
      URL_PATTERN.test(
        node.nodeValue ||
        ""
      )
    ) {
      targets.push(
        node
      );
    }

    URL_PATTERN.lastIndex =
      0;
  }

  targets.forEach(
    (
      node
    ) => {
      const value =
        node.nodeValue ||
        "";

      const fragment =
        document.createDocumentFragment();

      let cursor = 0;
      let match;
      let index = 0;

      URL_PATTERN.lastIndex =
        0;

      while (
        (
          match =
            URL_PATTERN.exec(
              value
            )
        )
      ) {
        if (
          match.index >
          cursor
        ) {
          fragment.appendChild(
            document.createTextNode(
              value.slice(
                cursor,
                match.index
              )
            )
          );
        }

        const {
          url,
          trailing,
        } =
          splitTrailingPunctuation(
            match[0]
          );

        if (url) {
          const anchor =
            document.createElement(
              "a"
            );

          anchor.href =
            normalizeAutoLinkUrl(
              url
            );

          anchor.target =
            "_blank";

          anchor.rel =
            "noopener noreferrer";

          anchor.className =
            "abide-auto-link";

          anchor.textContent =
            url;

          fragment.appendChild(
            anchor
          );

          if (
            trailing
          ) {
            fragment.appendChild(
              document.createTextNode(
                trailing
              )
            );
          }
        }

        cursor =
          match.index +
          match[0].length;

        index += 1;
      }

      if (
        cursor <
        value.length
      ) {
        fragment.appendChild(
          document.createTextNode(
            value.slice(
              cursor
            )
          )
        );
      }

      node.parentNode?.replaceChild(
        fragment,
        node
      );
    }
  );

  return holder.innerHTML;
}
