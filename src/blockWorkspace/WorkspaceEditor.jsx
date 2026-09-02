import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./blockWorkspace.css";

import {
  Sparkles,
  Plus,
  Type,
  ListTodo,
  Image as ImageIcon,
  AtSign,
  Bell,
  Smile,
  Keyboard,
} from "lucide-react";

import BlockRenderer from "./BlockRenderer.jsx";

import CommandMenu, {
  DatePickerModal,
  TaskPickerModal,
} from "./CommandMenu.jsx";

import {
  BLOCK_TYPES,
  createBlock,
  createInlineReminder,
  createAbideTask,
  createPage,
  createCollection,
  getCollections,
  chooseFile,
  uploadWorkspaceFile,
  dateMentionHtml,
  getWorkspaceMentionCatalog,
  reminderMentionHtml,
  searchSlashCommands,
  todayKey,
} from "./workspaceCore.js";


function makeStarterBlock() {
  return createBlock({
    type:
      BLOCK_TYPES.TEXT,
    text: "",
  });
}


function normalizeBlocks(
  blocks
) {
  if (
    Array.isArray(blocks) &&
    blocks.length
  ) {
    return blocks;
  }

  return [
    makeStarterBlock(),
  ];
}


function replaceBlock(
  blocks,
  updated
) {
  return blocks.map(
    (block) => {
      if (
        block.id ===
        updated.id
      ) {
        return updated;
      }

      if (
        Array.isArray(
          block.children
        ) &&
        block.children.length
      ) {
        return {
          ...block,

          children:
            replaceBlock(
              block.children,
              updated
            ),
        };
      }

      return block;
    }
  );
}


function findBlockIndex(
  blocks,
  id
) {
  return blocks.findIndex(
    (block) =>
      block.id === id
  );
}


function cleanCommandText(
  text,
  trigger,
  query
) {
  const source =
    String(
      text || ""
    );

  const needle =
    `${trigger}${query || ""}`;

  const index =
    source.lastIndexOf(
      needle
    );

  if (
    index === -1
  ) {
    return source;
  }

  return (
    source.slice(
      0,
      index
    ) +
    source.slice(
      index +
        needle.length
    )
  );
}


function insertPlainMention(
  text,
  item
) {
  const label =
    item?.label ||
    "Mention";

  return `${text || ""}@${label} `;
}


function dateMentionText(
  item
) {
  return `@${item.label} `;
}


export default function WorkspaceEditor({
  initialBlocks,
  onChange,
  className = "",
  placeholder =
    "Start writing…",
}) {

  const [
    pasteLinkMenu,
    setPasteLinkMenu,
  ] =
    useState(null);
  const [
    blocks,
    setBlocks,
  ] =
    useState(
      normalizeBlocks(
        initialBlocks
      )
    );

  const [
    menu,
    setMenu,
  ] =
    useState(null);

  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(0);

  const [
    picker,
    setPicker,
  ] =
    useState(null);

  const [
    taskPicker,
    setTaskPicker,
  ] =
    useState(null);

  const rootRef =
    useRef(null);

  const mobileImageInputRef =
    useRef(null);

  const mobileImageTargetRef =
    useRef(null);

  const [
    mobileTool,
    setMobileTool,
  ] =
    useState(null);


  const [
    moreOpen,
    setMoreOpen,
  ] =
    useState(false);

  const [
    fullPage,
    setFullPage,
  ] =
    useState(false);

  const [
    fullWidth,
    setFullWidth,
  ] =
    useState(
      () =>
        localStorage.getItem(
          "abide-workspace-full-width"
        ) === "true"
    );

  const [
    smallText,
    setSmallText,
  ] =
    useState(
      () =>
        localStorage.getItem(
          "abide-workspace-small-text"
        ) === "true"
    );

  const [
    workspaceFont,
    setWorkspaceFont,
  ] =
    useState(
      () =>
        localStorage.getItem(
          "abide-workspace-font"
        ) ||
        "default"
    );

  const [
    locked,
    setLocked,
  ] =
    useState(false);

  /*
   * Prevent the slash/@ detector from immediately
   * reopening a command menu after a command was chosen.
   */
  const commandCooldownRef =
    useRef(0);


  useEffect(
    () => {
      localStorage.setItem(
        "abide-workspace-full-width",
        String(fullWidth)
      );
    },
    [
      fullWidth,
    ]
  );

  useEffect(
    () => {
      localStorage.setItem(
        "abide-workspace-small-text",
        String(smallText)
      );
    },
    [
      smallText,
    ]
  );

  useEffect(
    () => {
      localStorage.setItem(
        "abide-workspace-font",
        workspaceFont
      );
    },
    [
      workspaceFont,
    ]
  );

  useEffect(
    () => {
      if (!locked) {
        return;
      }

      if (
        document.activeElement instanceof
        HTMLElement
      ) {
        document.activeElement.blur();
      }
    },
    [
      locked,
    ]
  );

  useEffect(
    () => {
      const escapeFullPage =
        (event) => {
          if (
            event.key ===
              "Escape" &&
            fullPage &&
            !menu
          ) {
            setFullPage(false);
          }
        };

      document.addEventListener(
        "keydown",
        escapeFullPage
      );

      return () =>
        document.removeEventListener(
          "keydown",
          escapeFullPage
        );
    },
    [
      fullPage,
      menu,
    ]
  );


  /*
   * =======================================================
   * MOBILE JOURNAL / SCRATCH TOOLBAR
   * =======================================================
   */

  const getMobileEditorTarget =
    () => {
      let element =
        document.activeElement;

      if (
        !(
          element instanceof
          HTMLTextAreaElement
        ) ||
        !rootRef.current?.contains(
          element
        )
      ) {
        element = null;
      }


      let blockId = "";

      if (element) {
        blockId =
          element
            .closest(
              "[data-block-id]"
            )
            ?.getAttribute(
              "data-block-id"
            ) || "";
      }


      let block =
        blockId
          ? blocks.find(
              (item) =>
                item.id ===
                blockId
            )
          : null;


      if (!block) {
        block =
          blocks[
            blocks.length - 1
          ] || null;
      }


      if (
        block &&
        !element
      ) {
        const shell =
          rootRef.current
            ?.querySelector(
              `[data-block-id="${block.id}"]`
            );

        element =
          shell?.querySelector(
            "textarea"
          ) || null;
      }


      return {
        block,
        element,
      };
    };


  const keepMobileKeyboard =
    (event) => {
      /*
       * Prevent toolbar taps from stealing textarea focus
       * before we inspect its caret/block.
       */
      event.preventDefault();
    };


  const openMobileCommands =
    () => {
      const {
        block,
        element,
      } =
        getMobileEditorTarget();

      if (!block) {
        return;
      }

      const rect =
        element
          ?.getBoundingClientRect?.() ||
        rootRef.current
          ?.getBoundingClientRect?.();

      openSlash({
        block,
        query:
          "",
        element,
        rect,
      });

      setMobileTool(null);
    };


  const addMobileTextBlock =
    () => {
      const {
        block,
      } =
        getMobileEditorTarget();

      if (!block) {
        const nextBlock =
          createBlock({
            type:
              BLOCK_TYPES.TEXT,
            text:
              "",
          });

        publish([
          ...blocks,
          nextBlock,
        ]);

        focusBlock(
          nextBlock.id,
          0
        );

        return;
      }


      handleEnter({
        block,
        caret:
          String(
            block.text || ""
          ).length,
      });

      setMobileTool(null);
    };


  const setMobileBlockType =
    (type) => {
      const {
        block,
      } =
        getMobileEditorTarget();

      if (!block) {
        return;
      }

      updateOne({
        ...block,
        type,
        updatedAt:
          Date.now(),
      });

      setMobileTool(null);

      requestAnimationFrame(
        () =>
          focusBlock(
            block.id,
            String(
              block.text || ""
            ).length
          )
      );
    };


  const openMobileTask =
    () => {
      const {
        block,
      } =
        getMobileEditorTarget();

      if (!block) {
        return;
      }

      setTaskPicker({
        blockId:
          block.id,

        title:
          String(
            block.text || ""
          ).trim(),

        date:
          "",

        time:
          "",
      });

      setMobileTool(null);
    };


  const openMobileImagePicker =
    () => {
      const {
        block,
      } =
        getMobileEditorTarget();

      mobileImageTargetRef.current =
        block?.id || null;

      /*
       * Directly opening a real file input is much more
       * reliable on iOS/PWA than manufacturing an input
       * inside an async helper.
       */
      mobileImageInputRef.current
        ?.click();

      setMobileTool(null);
    };


  const handleMobileImagePicked =
    async (event) => {
      const input =
        event.currentTarget;

      const file =
        input.files?.[0];

      /*
       * Reset immediately so choosing the same photo again
       * still triggers onChange later.
       */
      input.value =
        "";

      if (!file) {
        return;
      }


      const targetId =
        mobileImageTargetRef.current;

      const targetBlock =
        targetId
          ? blocks.find(
              (item) =>
                item.id ===
                targetId
            )
          : null;


      const imageBlock =
        createBlock({
          type:
            BLOCK_TYPES.IMAGE,

          text:
            "",

          fileName:
            file.name,

          mimeType:
            file.type || "",

          fileSize:
            file.size || 0,

          uploading:
            true,

          uploadError:
            "",

          url:
            "",
        });


      /*
       * If the focused block is empty, replace it.
       * Otherwise insert the image directly beneath it.
       */
      let next =
        [...blocks];

      if (
        targetBlock &&
        !String(
          targetBlock.text || ""
        ).trim()
      ) {
        imageBlock.id =
          targetBlock.id;

        imageBlock.createdAt =
          targetBlock.createdAt ||
          imageBlock.createdAt;

        next =
          blocks.map(
            (item) =>
              item.id ===
              targetBlock.id
                ? imageBlock
                : item
          );
      } else if (
        targetBlock
      ) {
        const index =
          blocks.findIndex(
            (item) =>
              item.id ===
              targetBlock.id
          );

        next.splice(
          index + 1,
          0,
          imageBlock
        );
      } else {
        next.push(
          imageBlock
        );
      }


      publish(next);


      try {
        const url =
          await uploadWorkspaceFile(
            file
          );

        updateOne({
          ...imageBlock,

          url,

          uploading:
            false,

          uploadError:
            "",

          updatedAt:
            Date.now(),
        });
      } catch (error) {
        updateOne({
          ...imageBlock,

          uploading:
            false,

          uploadError:
            error?.message ||
            "The image could not be uploaded.",

          updatedAt:
            Date.now(),
        });

        console.error(
          "Abide mobile image upload failed:",
          error
        );
      } finally {
        mobileImageTargetRef.current =
          null;
      }
    };

  const openMobileMention =
    () => {
      const {
        block,
        element,
      } =
        getMobileEditorTarget();

      if (!block) {
        return;
      }

      const rect =
        element
          ?.getBoundingClientRect?.() ||
        rootRef.current
          ?.getBoundingClientRect?.();

      openMention({
        block,
        query:
          "",
        element,
        rect,
      });

      setMobileTool(null);
    };


  const openMobileReminder =
    () => {
      const {
        block,
      } =
        getMobileEditorTarget();

      if (!block) {
        return;
      }

      setPicker({
        blockId:
          block.id,

        reminder:
          true,

        title:
          String(
            block.text || ""
          ).trim() ||
          "Reminder",

        date:
          todayKey(),

        time:
          "09:00",
      });

      setMobileTool(null);
    };


  const insertMobileEmoji =
    (emoji) => {
      const {
        block,
        element,
      } =
        getMobileEditorTarget();

      if (!block) {
        return;
      }


      const text =
        String(
          block.text || ""
        );

      const caret =
        element
          ? (
              element.selectionStart ??
              text.length
            )
          : text.length;


      const nextText =
        text.slice(
          0,
          caret
        ) +
        emoji +
        text.slice(
          caret
        );


      updateOne({
        ...block,

        text:
          nextText,

        updatedAt:
          Date.now(),
      });


      setMobileTool(null);


      requestAnimationFrame(
        () =>
          focusBlock(
            block.id,
            caret +
              emoji.length
          )
      );
    };


  const dismissMobileKeyboard =
    () => {
      if (
        document.activeElement instanceof
        HTMLElement
      ) {
        document.activeElement.blur();
      }

      setMenu(null);
      setMobileTool(null);
    };


  const mobileFormatOptions = [
    {
      label:
        "Text",
      type:
        BLOCK_TYPES.TEXT,
    },

    {
      label:
        "Heading 1",
      type:
        BLOCK_TYPES.HEADING_1,
    },

    {
      label:
        "Heading 2",
      type:
        BLOCK_TYPES.HEADING_2,
    },

    {
      label:
        "Heading 3",
      type:
        BLOCK_TYPES.HEADING_3,
    },

    {
      label:
        "Quote",
      type:
        BLOCK_TYPES.QUOTE,
    },

    {
      label:
        "Callout",
      type:
        BLOCK_TYPES.CALLOUT,
    },

    {
      label:
        "Bulleted list",
      type:
        BLOCK_TYPES.BULLETED_LIST,
    },

    {
      label:
        "Numbered list",
      type:
        BLOCK_TYPES.NUMBERED_LIST,
    },

    {
      label:
        "Checkbox",
      type:
        BLOCK_TYPES.TODO,
    },
  ];


  const mobileEmojis = [
    "🙏",
    "❤️",
    "✨",
    "📖",
    "💡",
    "✅",
    "🔥",
    "🙌",
    "😊",
    "😭",
    "📝",
    "⭐",
  ];


  const copyWorkspaceContents =
    async () => {
      const text =
        blocks
          .map(
            (block) =>
              String(
                block.text ||
                block.fileName ||
                ""
              )
          )
          .filter(Boolean)
          .join("\n\n");

      try {
        await navigator.clipboard
          .writeText(text);
      } catch {
        window.prompt(
          "Copy workspace contents",
          text
        );
      }

      setMoreOpen(false);
    };


  const previousInitialRef =
    useRef(initialBlocks);

  useEffect(
    () => {
      const previous =
        previousInitialRef.current;

      previousInitialRef.current =
        initialBlocks;

      const previousHadContent =
        Array.isArray(previous) &&
        previous.some(
          (block) =>
            String(
              block?.text || ""
            ).trim() ||
            block?.type ===
              BLOCK_TYPES.DIVIDER
        );

      const nextHasContent =
        Array.isArray(initialBlocks) &&
        initialBlocks.some(
          (block) =>
            String(
              block?.text || ""
            ).trim() ||
            block?.type ===
              BLOCK_TYPES.DIVIDER
        );

      // Parent save/reset changed the document from
      // populated blocks back to an empty starter block.
      // Do not resync during ordinary typing.
      if (
        previousHadContent &&
        !nextHasContent
      ) {
        setBlocks(
          normalizeBlocks(
            initialBlocks
          )
        );

        setMenu(null);
        setPicker(null);
      }
    },
    [initialBlocks]
  );


  const publish =
    (next) => {
      setBlocks(next);

      onChange?.(
        next
      );
    };


  const updateOne =
    (updated) => {
      publish(
        replaceBlock(
          blocks,
          updated
        )
      );
    };


  const addAfter =
    (
      blockId,
      newBlock
    ) => {
      const index =
        findBlockIndex(
          blocks,
          blockId
        );

      if (
        index === -1
      ) {
        publish([
          ...blocks,
          newBlock,
        ]);

        return;
      }

      const next = [
        ...blocks,
      ];

      next.splice(
        index + 1,
        0,
        newBlock
      );

      publish(next);
    };


  const removeBlock =
    (blockId) => {
      const next =
        blocks.filter(
          (block) =>
            block.id !==
            blockId
        );

      publish(
        next.length
          ? next
          : [
              makeStarterBlock(),
            ]
      );
    };


  const moveBlock =
    (
      blockId,
      direction
    ) => {
      const index =
        findBlockIndex(
          blocks,
          blockId
        );

      if (
        index === -1
      ) {
        return;
      }

      const target =
        index +
        direction;

      if (
        target < 0 ||
        target >=
          blocks.length
      ) {
        return;
      }

      const next = [
        ...blocks,
      ];

      const [
        block,
      ] =
        next.splice(
          index,
          1
        );

      next.splice(
        target,
        0,
        block
      );

      publish(next);
    };


  const focusBlock =
    (
      blockId,
      position = null
    ) => {
      requestAnimationFrame(
        () => {
          const input =
            rootRef.current
              ?.querySelector(
                `[data-block-id="${blockId}"] .abide-block-input`
              );

          if (!input) {
            return;
          }

          input.focus();

          const point =
            position == null
              ? input.value.length
              : Math.min(
                  position,
                  input.value.length
                );

          input.setSelectionRange(
            point,
            point
          );
        }
      );
    };


  const handleEnter =
    ({
      block,
      caret,
    }) => {
      const index =
        findBlockIndex(
          blocks,
          block.id
        );

      if (index === -1) {
        return;
      }

      const text =
        String(
          block.text || ""
        );

      const safeCaret =
        Math.max(
          0,
          Math.min(
            caret,
            text.length
          )
        );

      const before =
        text.slice(
          0,
          safeCaret
        );

      const after =
        text.slice(
          safeCaret
        );

      const continuationTypes =
        new Set([
          BLOCK_TYPES.TODO,
          BLOCK_TYPES.BULLETED_LIST,
          BLOCK_TYPES.NUMBERED_LIST,
        ]);

      const nextType =
        continuationTypes.has(
          block.type
        )
          ? block.type
          : BLOCK_TYPES.TEXT;

      const nextBlock =
        createBlock({
          type:
            nextType,
          text:
            after,
        });

      const next =
        [...blocks];

      next[index] = {
        ...block,
        text:
          before,
        updatedAt:
          Date.now(),
      };

      next.splice(
        index + 1,
        0,
        nextBlock
      );

      publish(next);

      focusBlock(
        nextBlock.id,
        0
      );
    };


  const handleBackspaceStart =
    ({
      block,
    }) => {
      const index =
        findBlockIndex(
          blocks,
          block.id
        );

      if (index === -1) {
        return;
      }

      const currentText =
        String(
          block.text || ""
        );

      /*
       * Notion-style behavior:
       * Backspace at the beginning of a styled block
       * first turns it back into plain text.
       */
      if (
        block.type !==
        BLOCK_TYPES.TEXT
      ) {
        const plainBlock = {
          ...block,
          type:
            BLOCK_TYPES.TEXT,
          checked:
            false,
          open:
            undefined,
          icon:
            undefined,
          children:
            undefined,
          updatedAt:
            Date.now(),
        };

        const next =
          [...blocks];

        next[index] =
          plainBlock;

        publish(next);

        focusBlock(
          block.id,
          0
        );

        return;
      }


      /*
       * Keep one empty text block alive if it is
       * the first/only block.
       */
      if (index === 0) {
        return;
      }


      const previous =
        blocks[
          index - 1
        ];

      if (!previous) {
        return;
      }


      /*
       * Empty text block:
       * remove it and return focus to the block above.
       */
      if (!currentText) {
        const next =
          [...blocks];

        next.splice(
          index,
          1
        );

        publish(next);

        focusBlock(
          previous.id,
          String(
            previous.text ||
            ""
          ).length
        );

        return;
      }


      /*
       * Text exists:
       * merge it into the previous editable block.
       */
      if (
        previous.type ===
        BLOCK_TYPES.DIVIDER
      ) {
        return;
      }

      const previousText =
        String(
          previous.text || ""
        );

      const mergedPrevious = {
        ...previous,
        text:
          previousText +
          currentText,
        updatedAt:
          Date.now(),
      };

      const next =
        [...blocks];

      next[
        index - 1
      ] =
        mergedPrevious;

      next.splice(
        index,
        1
      );

      publish(next);

      focusBlock(
        previous.id,
        previousText.length
      );
    };


  const openSlash =
    ({
      block,
      query,
      element,
      rect,
    }) => {
      if (
        Date.now() <
        commandCooldownRef.current
      ) {
        return;
      }

      const results =
        searchSlashCommands(
          query || ""
        );

      setActiveIndex(0);

      setMenu({
        trigger: "/",
        query:
          query || "",
        block,
        element,
        rect,
        results,
      });
    };


  const openMention =
    ({
      block,
      query,
      element,
      rect,
    }) => {
      if (
        Date.now() <
        commandCooldownRef.current
      ) {
        return;
      }

      const results =
        getWorkspaceMentionCatalog(
          query || ""
        );

      setActiveIndex(0);

      setMenu({
        trigger: "@",
        query:
          query || "",
        block,
        element,
        rect,
        results,
      });
    };


  const chooseMention =
    (item) => {
      if (
        !menu?.block
      ) {
        return;
      }

      const cleaned =
        cleanCommandText(
          menu.block.text,
          "@",
          menu.query
        );

      let nextText;

      if (
        item.type ===
          "date" ||
        item.type ===
          "datetime"
      ) {
        nextText =
          `${cleaned}${dateMentionText(
            item
          )}`;
      } else {
        nextText =
          insertPlainMention(
            cleaned,
            item
          );
      }

      updateOne({
        ...menu.block,

        text:
          nextText,

        mentionRefs:
          item.type === "date" ||
          item.type === "datetime"
            ? (
                menu.block.mentionRefs ||
                []
              )
            : [
                ...(
                  menu.block.mentionRefs ||
                  []
                ).filter(
                  (ref) =>
                    !(
                      ref.type ===
                        item.type &&
                      String(ref.id) ===
                        String(item.id)
                    )
                ),

                {
                  type:
                    item.type,

                  id:
                    item.id,

                  label:
                    item.label ||
                    "",
                },
              ],

        updatedAt:
          Date.now(),
      });

      setMenu(null);
    };



  /* =======================================================
     URL PASTE / PASTE AS
     ======================================================= */

  const linkDisplayName =
    (url) => {
      try {
        return new URL(
          url
        )
          .hostname
          .replace(
            /^www\./i,
            ""
          );
      } catch {
        return url || "Link";
      }
    };


  const openPasteLinkMenu =
    ({
      block,
      url,
      start,
      end,
      element,
      rect,
    }) => {
      setMenu(null);

      setPasteLinkMenu({
        block,
        url,
        start,
        end,
        element,
        rect,
      });
    };


  const closePasteLinkMenu =
    () => {
      setPasteLinkMenu(
        null
      );
    };


  const choosePasteLink =
    (mode) => {
      if (
        !pasteLinkMenu?.block ||
        !pasteLinkMenu?.url
      ) {
        return;
      }

      const {
        block,
        url,
        start,
        end,
      } =
        pasteLinkMenu;

      const originalText =
        String(
          block.text || ""
        );

      const before =
        originalText.slice(
          0,
          start
        );

      const after =
        originalText.slice(
          end
        );


      /* URL */

      if (
        mode === "url" ||
        mode === "link"
      ) {
        /* ABIDE WORKSPACE SIMPLE LINK V2 */

        /*
         * A TEXT block uses a textarea, and textarea
         * contents cannot be clickable.
         *
         * Store URL mode as a lightweight BOOKMARK block
         * with displayMode="link". ExtendedBlockRenderer
         * will render it as a normal <a>, not a bookmark card.
         */

        const normalizedUrl =
          /^https?:\/\//i.test(
            url
          )
            ? url
            : `https://${url}`;

        const simpleLinkBlock = {
          ...block,

          type:
            BLOCK_TYPES.BOOKMARK,

          text:
            url,

          url:
            normalizedUrl,

          displayMode:
            "link",

          updatedAt:
            Date.now(),
        };

        updateOne(
          simpleLinkBlock
        );

        setPasteLinkMenu(
          null
        );

        return;
      }


      /* Mention */

      if (mode === "mention") {
        const label =
          linkDisplayName(
            url
          );

        const mentionText =
          `@${label}`;

        const nextText =
          before +
          mentionText +
          after;

        updateOne({
          ...block,

          text:
            nextText,

          content:
            nextText,

          externalLinks: [
            ...(
              block.externalLinks ||
              []
            ),

            {
              id:
                `external-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`,

              type:
                "external",

              label,

              url,

              start,

              end:
                start +
                mentionText.length,
            },
          ],

          updatedAt:
            Date.now(),
        });

        closePasteLinkMenu();

        requestAnimationFrame(
          () =>
            focusBlock(
              block.id,
              start +
                mentionText.length
            )
        );

        return;
      }


      /* Bookmark / Embed */

      if (
        mode === "bookmark" ||
        mode === "embed"
      ) {
        const type =
          mode === "bookmark"
            ? BLOCK_TYPES.BOOKMARK
            : BLOCK_TYPES.EMBED;

        const remainingText =
          (
            before +
            after
          ).trim();


        /*
         * Empty block:
         * convert current block.
         */
        if (!remainingText) {
          updateOne({
            ...block,

            type,

            text:
              "",

            content:
              "",

            url,

            title:
              mode === "bookmark"
                ? linkDisplayName(
                    url
                  )
                : undefined,

            updatedAt:
              Date.now(),
          });

          closePasteLinkMenu();

          return;
        }


        /*
         * Existing text:
         * keep it and insert special block below.
         */
        const preservedText =
          before +
          after;

        const updatedCurrent = {
          ...block,

          text:
            preservedText,

          content:
            preservedText,

          updatedAt:
            Date.now(),
        };

        const nextBlock =
          createBlock({
            type,

            text:
              "",

            content:
              "",

            url,

            title:
              mode === "bookmark"
                ? linkDisplayName(
                    url
                  )
                : undefined,
          });

        const index =
          blocks.findIndex(
            (candidate) =>
              candidate.id ===
              block.id
          );

        const nextBlocks =
          blocks.map(
            (candidate) =>
              candidate.id ===
              block.id
                ? updatedCurrent
                : candidate
          );

        if (index >= 0) {
          nextBlocks.splice(
            index + 1,
            0,
            nextBlock
          );
        } else {
          nextBlocks.push(
            nextBlock
          );
        }

        publish(
          nextBlocks
        );

        closePasteLinkMenu();

        return;
      }
    };


  const executeSlash =
    async (command) => {
      if (
        !menu?.block
      ) {
        return;
      }

      const cleanedText =
        cleanCommandText(
          menu.block.text,
          "/",
          menu.query
        );

      const id =
        String(
          command.id ||
          ""
        ).toLowerCase();


      /*
       * DATABASES
       *
       * Every view uses the same underlying
       * Abide Collection model.
       */
      const databaseViews = {
        table:
          "table",

        board:
          "board",

        gallery:
          "gallery",

        "list-database":
          "list",

        "calendar-database":
          "calendar",

        timeline:
          "timeline",

        chart:
          "chart",
      };


      /*
       * CREATE DATABASE
       *
       * Every slash option creates the same underlying
       * Abide collection. Only the initial VIEW changes.
       */
      if (
        Object.prototype.hasOwnProperty.call(
          databaseViews,
          id
        )
      ) {
        const collection =
          createCollection(
            cleanedText.trim() ||
            "Untitled database"
          );

        if (
          !collection ||
          !collection.id
        ) {
          console.error(
            "Abide database creation failed:",
            {
              command:
                id,
              collection,
            }
          );

          window.alert(
            "Abide could not create this database."
          );

          setMenu(null);

          return;
        }


        const databaseBlock = {
          ...menu.block,

          type:
            BLOCK_TYPES.DATABASE,

          text:
            "",

          content:
            "",

          collectionId:
            collection.id,

          view:
            databaseViews[id],

          linked:
            false,

          updatedAt:
            Date.now(),
        };


        updateOne(
          databaseBlock
        );

        setMenu(null);

        return;
      }


      /*
       * LINKED DATABASE
       */
      if (
        id ===
        "linked-database"
      ) {
        const collections =
          getCollections();

        setMenu(null);


        if (
          !Array.isArray(
            collections
          ) ||
          !collections.length
        ) {
          window.alert(
            "Create a database first. Then /linked database can display that same database somewhere else."
          );

          return;
        }


        const options =
          collections
            .map(
              (
                collection,
                index
              ) =>
                `${index + 1}. ${
                  collection.name ||
                  "Untitled database"
                }`
            )
            .join("\n");


        const selection =
          window.prompt(
            `Choose a database:\n\n${options}`,
            "1"
          );


        if (
          selection === null
        ) {
          return;
        }


        const index =
          Number(
            selection
          ) - 1;

        const collection =
          collections[index];


        if (!collection) {
          window.alert(
            "That database selection was not found."
          );

          return;
        }


        updateOne({
          ...menu.block,

          type:
            BLOCK_TYPES.DATABASE,

          text:
            "",

          content:
            "",

          collectionId:
            collection.id,

          view:
            "table",

          linked:
            true,

          updatedAt:
            Date.now(),
        });

        return;
      }


      /*
       * PAGE
       */
      if (
        id === "page"
      ) {
        const page =
          createPage(
            cleanedText.trim() ||
            "Untitled"
          );

        updateOne({
          ...menu.block,

          type:
            BLOCK_TYPES.PAGE_LINK,

          text:
            page.title,

          pageId:
            page.id,

          updatedAt:
            Date.now(),
        });

        const focusId =
          menu.block.id;

        setMenu(null);

        focusBlock(
          focusId,
          page.title.length
        );

        return;
      }


      /*
       * LINK / MENTION PAGE
       */
      if (
        id === "link-to-page" ||
        id === "mention-page"
      ) {
        const results =
          getWorkspaceMentionCatalog(
            ""
          ).filter(
            (item) =>
              item.type ===
              "page"
          );

        setMenu({
          trigger:
            "@",

          query:
            "",

          block: {
            ...menu.block,
            text:
              cleanedText,
          },

          element:
            menu.element,

          rect:
            menu.rect,

          results,
        });

        setActiveIndex(0);

        return;
      }


      /*
       * MENTION PERSON
       */
      if (
        id === "mention-person"
      ) {
        const results =
          getWorkspaceMentionCatalog(
            ""
          ).filter(
            (item) =>
              item.type ===
              "person"
          );

        setMenu({
          trigger:
            "@",

          query:
            "",

          block: {
            ...menu.block,
            text:
              cleanedText,
          },

          element:
            menu.element,

          rect:
            menu.rect,

          results,
        });

        setActiveIndex(0);

        return;
      }


      /*
       * EMOJI
       */
      if (
        id === "emoji"
      ) {
        setMenu(null);

        const emoji =
          window.prompt(
            "Insert emoji",
            "🙏"
          );

        if (emoji) {
          const nextText =
            `${cleanedText}${emoji} `;

          updateOne({
            ...menu.block,
            text:
              nextText,
            updatedAt:
              Date.now(),
          });

          focusBlock(
            menu.block.id,
            nextText.length
          );
        }

        return;
      }


      /*
       * EQUATION
       */
      if (
        id === "equation"
      ) {
        updateOne({
          ...menu.block,

          type:
            BLOCK_TYPES.EQUATION,

          text:
            cleanedText,

          updatedAt:
            Date.now(),
        });

        setMenu(null);

        focusBlock(
          menu.block.id,
          cleanedText.length
        );

        return;
      }


      /*
       * CODE
       */
      if (
        id === "code"
      ) {
        updateOne({
          ...menu.block,

          type:
            BLOCK_TYPES.CODE,

          text:
            cleanedText,

          language:
            "plain",

          updatedAt:
            Date.now(),
        });

        setMenu(null);

        focusBlock(
          menu.block.id,
          cleanedText.length
        );

        return;
      }


      /*
       * IMAGE / VIDEO / AUDIO / FILE / PDF
       */
      const uploads = {
        image: {
          type:
            BLOCK_TYPES.IMAGE,
          accept:
            "image/*",
        },

        video: {
          type:
            BLOCK_TYPES.VIDEO,
          accept:
            "video/*",
        },

        audio: {
          type:
            BLOCK_TYPES.AUDIO,
          accept:
            "audio/*",
        },

        file: {
          type:
            BLOCK_TYPES.FILE,
          accept:
            "*/*",
        },

        pdf: {
          type:
            BLOCK_TYPES.PDF,
          accept:
            "application/pdf",
        },
      };


      if (
        uploads[id]
      ) {
        const config =
          uploads[id];

        const sourceBlock = {
          ...menu.block,
        };

        setMenu(null);

        try {
          /*
           * First choose the file. A cancelled picker
           * should leave the original block unchanged.
           */
          const file =
            await chooseFile(
              config.accept
            );

          /*
           * Immediately show that Abide accepted the
           * file and has begun uploading it.
           */
          updateOne({
            ...sourceBlock,

            type:
              config.type,

            text:
              cleanedText,

            fileName:
              file.name,

            mimeType:
              file.type || "",

            fileSize:
              file.size || 0,

            uploading:
              true,

            uploadError:
              "",

            url:
              "",

            updatedAt:
              Date.now(),
          });

          try {
            const url =
              await uploadWorkspaceFile(
                file
              );

            updateOne({
              ...sourceBlock,

              type:
                config.type,

              text:
                cleanedText,

              url,

              fileName:
                file.name,

              mimeType:
                file.type || "",

              fileSize:
                file.size || 0,

              uploading:
                false,

              uploadError:
                "",

              updatedAt:
                Date.now(),
            });
          } catch (uploadError) {
            const message =
              uploadError?.message ||
              uploadError?.code ||
              "The file could not be uploaded.";

            updateOne({
              ...sourceBlock,

              type:
                config.type,

              text:
                cleanedText,

              fileName:
                file.name,

              mimeType:
                file.type || "",

              fileSize:
                file.size || 0,

              uploading:
                false,

              uploadError:
                message,

              url:
                "",

              updatedAt:
                Date.now(),
            });

            console.error(
              "Abide workspace upload failed:",
              uploadError
            );
          }
        } catch (pickerError) {
          if (
            pickerError?.message !==
            "No file selected."
          ) {
            console.error(
              "Abide file picker failed:",
              pickerError
            );
          }
        }

        return;
      }


      /*
       * WEB BOOKMARK
       */
      if (
        id === "bookmark"
      ) {
        setMenu(null);

        const url =
          window.prompt(
            "Bookmark URL",
            "https://"
          );

        if (!url) {
          focusBlock(
            menu.block.id
          );

          return;
        }

        updateOne({
          ...menu.block,

          type:
            BLOCK_TYPES.BOOKMARK,

          text:
            cleanedText.trim() ||
            url,

          url:
            url.trim(),

          updatedAt:
            Date.now(),
        });

        return;
      }


      /*
       * EMBED
       */
      if (
        id === "embed"
      ) {
        setMenu(null);

        const url =
          window.prompt(
            "Embed URL",
            "https://"
          );

        if (!url) {
          focusBlock(
            menu.block.id
          );

          return;
        }

        updateOne({
          ...menu.block,

          type:
            BLOCK_TYPES.EMBED,

          text:
            cleanedText,

          url:
            url.trim(),

          updatedAt:
            Date.now(),
        });

        return;
      }


      if (
        id === "task"
      ) {
        updateOne({
          ...menu.block,
          text:
            cleanedText,
        });

        setTaskPicker({
          blockId:
            menu.block.id,

          title:
            cleanedText.trim(),

          date:
            "",

          time:
            "",
        });

        setMenu(null);

        return;
      }


      if (
        id === "date"
      ) {
        updateOne({
          ...menu.block,
          text:
            cleanedText,
        });

        setPicker({
          blockId:
            menu.block.id,
          reminder:
            false,
          date:
            todayKey(),
          time:
            "",
          title:
            "",
        });

        setMenu(null);

        return;
      }


      if (
        id ===
          "reminder" ||
        id ===
          "remind"
      ) {
        updateOne({
          ...menu.block,
          text:
            cleanedText,
        });

        setPicker({
          blockId:
            menu.block.id,
          reminder:
            true,
          title:
            "Reminder",
          date:
            todayKey(),
          time:
            "09:00",
        });

        setMenu(null);

        return;
      }


      if (
        id ===
          "mention"
      ) {
        updateOne({
          ...menu.block,
          text:
            `${cleanedText}@`,
        });

        setMenu(null);

        return;
      }


      const typeMap = {
        text:
          BLOCK_TYPES.TEXT,

        plain:
          BLOCK_TYPES.TEXT,

        checkbox:
          BLOCK_TYPES.TODO,

        todo:
          BLOCK_TYPES.TODO,

        "to-do":
          BLOCK_TYPES.TODO,

        bullet:
          BLOCK_TYPES.BULLETED_LIST,

        "bulleted-list":
          BLOCK_TYPES.BULLETED_LIST,

        num:
          BLOCK_TYPES.NUMBERED_LIST,

        numbered:
          BLOCK_TYPES.NUMBERED_LIST,

        "numbered-list":
          BLOCK_TYPES.NUMBERED_LIST,

        toggle:
          BLOCK_TYPES.TOGGLE,

        h1:
          BLOCK_TYPES.HEADING_1,

        "heading-1":
          BLOCK_TYPES.HEADING_1,

        h2:
          BLOCK_TYPES.HEADING_2,

        "heading-2":
          BLOCK_TYPES.HEADING_2,

        h3:
          BLOCK_TYPES.HEADING_3,

        "heading-3":
          BLOCK_TYPES.HEADING_3,

        quote:
          BLOCK_TYPES.QUOTE,

        div:
          BLOCK_TYPES.DIVIDER,

        divider:
          BLOCK_TYPES.DIVIDER,

        callout:
          BLOCK_TYPES.CALLOUT,
      };


      const targetType =
        typeMap[id];


      if (
        targetType
      ) {
        const nextBlock =
          createBlock({
            ...menu.block,

            id:
              menu.block.id,

            type:
              targetType,

            text:
              cleanedText,
          });

        updateOne(
          nextBlock
        );

        setMenu(null);

        return;
      }


      // Commands the core engine knows how to create,
      // but which should create a new block after the
      // current one rather than convert the current text.
      try {
        const result =
          command.blockType
            ? createBlock({
                type:
                  command.blockType,
              })
            : null;

        if (result) {
          updateOne({
            ...menu.block,
            text:
              cleanedText,
          });

          addAfter(
            menu.block.id,
            result
          );
        }
      } catch {}


      setMenu(null);
    };


  const chooseMenuItem =
    (item) => {
      if (!menu) {
        return;
      }

      /*
       * Ignore trigger detection briefly while React
       * applies the selected command.
       */
      commandCooldownRef.current =
        Date.now() + 350;


      /*
       * Remove the trigger from the live textarea
       * immediately. This prevents the still-focused
       * textarea from advertising "/" or "@" again
       * during the command-selection render.
       */
      if (
        menu.element &&
        typeof menu.element.value ===
          "string"
      ) {
        const cleaned =
          cleanCommandText(
            menu.element.value,
            menu.trigger,
            menu.query
          );

        menu.element.value =
          cleaned;
      }


      if (
        menu.trigger ===
        "@"
      ) {
        chooseMention(item);
      } else {
        executeSlash(item);
      }
    };


  const saveTaskPicker =
    () => {
      if (
        !taskPicker ||
        !taskPicker.title?.trim()
      ) {
        return;
      }

      const block =
        blocks.find(
          (item) =>
            item.id ===
            taskPicker.blockId
        );

      if (!block) {
        setTaskPicker(null);
        return;
      }

      const task =
        createAbideTask({
          title:
            taskPicker.title.trim(),

          dueDate:
            taskPicker.date || "",

          dueTime:
            taskPicker.time || "",
        });

      updateOne({
        ...block,

        type:
          BLOCK_TYPES.TODO,

        text:
          task.title,

        checked:
          false,

        taskId:
          task.id,

        linkedTask:
          true,

        taskDueDate:
          task.dueDate || "",

        taskDueTime:
          task.dueTime || "",

        updatedAt:
          Date.now(),
      });

      const focusId =
        block.id;

      setTaskPicker(null);

      focusBlock(
        focusId,
        task.title.length
      );
    };


  const savePicker =
    () => {
      if (!picker) {
        return;
      }

      const block =
        blocks.find(
          (item) =>
            item.id ===
            picker.blockId
        );

      if (!block) {
        setPicker(null);
        return;
      }


      if (
        picker.reminder
      ) {
        const reminder =
          createInlineReminder({
            title:
              picker.title ||
              "Reminder",

            dateKey:
              picker.date,

            time:
              picker.time ||
              "09:00",
          });

        updateOne({
          ...block,

          text:
            `${block.text || ""}@${reminder.title} `,

          reminderRefs: [
            ...(
              block.reminderRefs ||
              []
            ),

            {
              id:
                reminder.id,

              title:
                reminder.title,

              dateKey:
                reminder.dateKey,

              time:
                reminder.time,
            },
          ],

          updatedAt:
            Date.now(),
        });
      } else {
        const label =
          picker.time
            ? `${picker.date} ${picker.time}`
            : picker.date;

        updateOne({
          ...block,

          text:
            `${block.text || ""}@${label} `,

          dateRefs: [
            ...(
              block.dateRefs ||
              []
            ),

            {
              dateKey:
                picker.date,

              time:
                picker.time ||
                "",
            },
          ],

          updatedAt:
            Date.now(),
        });
      }


      setPicker(null);
    };


  useEffect(
    () => {
      const handler =
        (event) => {
          if (
            !menu?.results
              ?.length
          ) {
            return;
          }

          if (
            event.key ===
            "ArrowDown"
          ) {
            event.preventDefault();

            setActiveIndex(
              (current) =>
                Math.min(
                  current + 1,
                  menu.results
                    .length - 1
                )
            );
          }

          if (
            event.key ===
            "ArrowUp"
          ) {
            event.preventDefault();

            setActiveIndex(
              (current) =>
                Math.max(
                  current - 1,
                  0
                )
            );
          }

          if (
            event.key ===
            "Enter"
          ) {
            event.preventDefault();

            chooseMenuItem(
              menu.results[
                activeIndex
              ]
            );
          }

          if (
            event.key ===
            "Escape"
          ) {
            event.preventDefault();

            setMenu(null);
          }
        };

      document.addEventListener(
        "keydown",
        handler,
        true
      );

      return () =>
        document.removeEventListener(
          "keydown",
          handler,
          true
        );
    },
    [
      menu,
      activeIndex,
      blocks,
    ]
  );


  return (
    <div
      ref={rootRef}
      className={[
        "abide-workspace-editor",
        className,
        fullPage
          ? "abide-workspace-full-page"
          : "",
        fullWidth
          ? "abide-workspace-full-width"
          : "",
        smallText
          ? "abide-workspace-small-text"
          : "",
        `abide-workspace-font-${workspaceFont}`,
        locked
          ? "abide-workspace-locked"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-abide-block-editor="true"
    >
      <div className="abide-workspace-chrome">
        <div className="abide-workspace-chrome-left">
          {locked && (
            <span className="abide-workspace-lock-badge">
              Locked
            </span>
          )}
        </div>

        <div className="abide-workspace-chrome-actions">
          <button
            type="button"
            className="abide-workspace-icon-button"
            title={
              fullPage
                ? "Exit full page"
                : "Open full page"
            }
            onClick={() =>
              setFullPage(
                (value) =>
                  !value
              )
            }
          >
            {fullPage
              ? "↙"
              : "↗"}
          </button>

          <button
            type="button"
            className="abide-workspace-icon-button"
            aria-label="More workspace options"
            onClick={() =>
              setMoreOpen(
                (value) =>
                  !value
              )
            }
          >
            •••
          </button>
        </div>

        {moreOpen && (
          <>
            <button
              type="button"
              className="abide-workspace-more-backdrop"
              aria-label="Close menu"
              onClick={() =>
                setMoreOpen(
                  false
                )
              }
            />

            <div
              className="abide-workspace-more-menu"
              /* ABIDE WORKSPACE SETTINGS SCROLL V1 */
              onWheel={(event) => {
                /*
                 * The menu may scroll normally, but its
                 * wheel event must never reach Journal /
                 * Notes underneath it.
                 */
                event.stopPropagation();
              }}
              onTouchMove={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="abide-workspace-more-search">
                Workspace
              </div>

              <div className="abide-workspace-font-options">
                {[
                  [
                    "default",
                    "Ag",
                    "Default",
                  ],
                  [
                    "serif",
                    "Ag",
                    "Serif",
                  ],
                  [
                    "mono",
                    "Ag",
                    "Mono",
                  ],
                ].map(
                  ([
                    id,
                    sample,
                    label,
                  ]) => (
                    <button
                      type="button"
                      key={id}
                      className={
                        workspaceFont ===
                        id
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setWorkspaceFont(
                          id
                        )
                      }
                    >
                      <strong>
                        {sample}
                      </strong>

                      <span>
                        {label}
                      </span>
                    </button>
                  )
                )}
              </div>

              <div className="abide-workspace-more-divider" />

              <button
                type="button"
                className="abide-workspace-more-row"
                onClick={
                  copyWorkspaceContents
                }
              >
                <span>
                  ⧉
                </span>

                <strong>
                  Copy contents
                </strong>
              </button>

              <button
                type="button"
                className="abide-workspace-more-row"
                onClick={() =>
                  setFullPage(
                    (value) =>
                      !value
                  )
                }
              >
                <span>
                  ↗
                </span>

                <strong>
                  {fullPage
                    ? "Exit full page"
                    : "Open full page"}
                </strong>
              </button>

              <div className="abide-workspace-more-divider" />

              <label className="abide-workspace-toggle-row">
                <span>
                  Small text
                </span>

                <input
                  type="checkbox"
                  checked={
                    smallText
                  }
                  onChange={(
                    event
                  ) =>
                    setSmallText(
                      event.target
                        .checked
                    )
                  }
                />
              </label>

              <label className="abide-workspace-toggle-row">
                <span>
                  Full width
                </span>

                <input
                  type="checkbox"
                  checked={
                    fullWidth
                  }
                  onChange={(
                    event
                  ) =>
                    setFullWidth(
                      event.target
                        .checked
                    )
                  }
                />
              </label>

              <div className="abide-workspace-more-divider" />

              <label className="abide-workspace-toggle-row">
                <span>
                  Lock workspace
                </span>

                <input
                  type="checkbox"
                  checked={
                    locked
                  }
                  onChange={(
                    event
                  ) =>
                    setLocked(
                      event.target
                        .checked
                    )
                  }
                />
              </label>
            </div>
          </>
        )}
      </div>

      <div className="abide-workspace-content">
      {!blocks.length && (
        <div className="abide-workspace-placeholder">
          {placeholder}
        </div>
      )}


      {blocks.map(
        (block) => (
          <div
            className="abide-workspace-block-shell"
            key={
              block.id
            }
          >
            <BlockRenderer
              block={
                block
              }
              onChange={
                locked
                  ? undefined
                  : updateOne
              }
              onOpenSlash={
                locked
                  ? undefined
                  : openSlash
              }
              onOpenMention={
                locked
                  ? undefined
                  : openMention
              }
              onPasteUrl={openPasteLinkMenu}
              onEnter={
                locked
                  ? undefined
                  : handleEnter
              }
              onBackspaceStart={
                locked
                  ? undefined
                  : handleBackspaceStart
              }
              onRemove={
                removeBlock
              }
            />
          </div>
        )
      )}


      </div>

      {/* ABIDE SHARED IMAGE PICKER V1 */}
      <input
        ref={mobileImageInputRef}
        type="file"
        accept="image/*"
        capture={undefined}
        onChange={
          handleMobileImagePicked
        }
        className="abide-shared-image-picker"
        aria-hidden="true"
        tabIndex={-1}
      />


      {/* ABIDE DESKTOP EDITOR TOOLBAR V2 */}
      <div
        className="abide-desktop-doc-toolbar"
      >
        <div className="abide-doc-toolbar-section">
          <button
            type="button"
            className="abide-doc-toolbar-button text-button"
            title="Normal text"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.TEXT
              );
            }}
          >
            Text
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Heading 1"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.HEADING_1
              );
            }}
          >
            H1
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Heading 2"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.HEADING_2
              );
            }}
          >
            H2
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Heading 3"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.HEADING_3
              );
            }}
          >
            H3
          </button>
        </div>

        <div className="abide-doc-toolbar-divider" />

        <div className="abide-doc-toolbar-section">
          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Bulleted list"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.BULLETED_LIST
              );
            }}
          >
            • List
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Numbered list"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.NUMBERED_LIST
              );
            }}
          >
            1. List
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Checkbox"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.TODO
              );
            }}
          >
            ☑
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Quote"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.QUOTE
              );
            }}
          >
            Quote
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Callout"
            onPointerDown={(event) => {
              event.preventDefault();
              setMobileBlockType(
                BLOCK_TYPES.CALLOUT
              );
            }}
          >
            Callout
          </button>
        </div>

        <div className="abide-doc-toolbar-divider" />

        <div className="abide-doc-toolbar-section">
          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Create task"
            onPointerDown={(event) => {
              event.preventDefault();
              openMobileTask();
            }}
          >
            <ListTodo size={15} />
            Task
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Mention"
            onPointerDown={(event) => {
              event.preventDefault();
              openMobileMention();
            }}
          >
            <AtSign size={15} />
            Mention
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Reminder"
            onPointerDown={(event) => {
              event.preventDefault();
              openMobileReminder();
            }}
          >
            <Bell size={15} />
            Reminder
          </button>
        </div>

        <div className="abide-doc-toolbar-divider" />

        <div className="abide-doc-toolbar-section">
          <button
            type="button"
            className="abide-doc-toolbar-button"
            title="Insert image"
            onPointerDown={(event) => {
              event.preventDefault();
              openMobileImagePicker();
            }}
          >
            <ImageIcon size={15} />
            Image
          </button>

          <button
            type="button"
            className="abide-doc-toolbar-button primary"
            title="More insert options"
            onPointerDown={(event) => {
              event.preventDefault();
              openMobileCommands();
            }}
          >
            <Plus size={15} />
            Insert
          </button>
        </div>
      </div>


      <div
        className="abide-mobile-editor-toolbar-wrap"
        onPointerDown={
          keepMobileKeyboard
        }
      >
        {mobileTool ===
          "format" && (
          <div className="abide-mobile-editor-popover abide-mobile-format-popover">
            {mobileFormatOptions.map(
              (option) => (
                <button
                  type="button"
                  key={
                    option.label
                  }
                  onPointerDown={(
                    event
                  ) => {
                    event.preventDefault();

                    setMobileBlockType(
                      option.type
                    );
                  }}
                >
                  {option.label}
                </button>
              )
            )}
          </div>
        )}


        {mobileTool ===
          "emoji" && (
          <div className="abide-mobile-editor-popover abide-mobile-emoji-popover">
            {mobileEmojis.map(
              (emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onPointerDown={(
                    event
                  ) => {
                    event.preventDefault();

                    insertMobileEmoji(
                      emoji
                    );
                  }}
                >
                  {emoji}
                </button>
              )
            )}
          </div>
        )}


        

        <div className="abide-mobile-editor-toolbar">
          


          <button
            type="button"
            aria-label="Insert block"
            title="Insert block"
            onPointerDown={(event) => {
              event.preventDefault();

              openMobileCommands();
            }}
          >
            <Plus
              size={23}
              strokeWidth={2}
            />
          </button>


          <button
            type="button"
            aria-label="Text formatting"
            title="Text formatting"
            className={
              mobileTool ===
              "format"
                ? "active"
                : ""
            }
            onPointerDown={(
              event
            ) => {
              event.preventDefault();

              setMobileTool(
                (current) =>
                  current ===
                  "format"
                    ? null
                    : "format"
              );
            }}
          >
            <Type size={22} />
          </button>


          <button
            type="button"
            aria-label="Create task"
            title="Create task"
            onPointerDown={(
              event
            ) => {
              event.preventDefault();
              openMobileTask();
            }}
          >
            <ListTodo size={21} />
          </button>


          <label
            className="abide-mobile-image-control"
            aria-label="Add image"
            title="Add image"
            onPointerDown={(event) => {
              /*
               * Stop the toolbar wrapper from cancelling
               * native label/file-input activation.
               */
              event.stopPropagation();

              const {
                block,
              } =
                getMobileEditorTarget();

              mobileImageTargetRef.current =
                block?.id || null;
            }}
          >
            <input
              type="file"
              accept="image/*"
              capture={undefined}
              onChange={
                handleMobileImagePicked
              }
            />

            <ImageIcon
              size={22}
              strokeWidth={1.9}
            />
          </label>


          <button
            type="button"
            aria-label="Mention"
            title="Mention"
            onPointerDown={(
              event
            ) => {
              event.preventDefault();
              openMobileMention();
            }}
          >
            <AtSign size={21} />
          </button>


          <button
            type="button"
            aria-label="Add reminder"
            title="Add reminder"
            onPointerDown={(
              event
            ) => {
              event.preventDefault();
              openMobileReminder();
            }}
          >
            <Bell size={20} />
          </button>


          <button
            type="button"
            aria-label="Emoji"
            title="Emoji"
            className={
              mobileTool ===
              "emoji"
                ? "active"
                : ""
            }
            onPointerDown={(
              event
            ) => {
              event.preventDefault();

              setMobileTool(
                (current) =>
                  current ===
                  "emoji"
                    ? null
                    : "emoji"
              );
            }}
          >
            <Smile size={22} />
          </button>


          <button
            type="button"
            aria-label="Dismiss keyboard"
            title="Dismiss keyboard"
            onPointerDown={(
              event
            ) => {
              event.preventDefault();

              dismissMobileKeyboard();
            }}
          >
            <Keyboard size={21} />
          </button>
        </div>
      </div>


      {pasteLinkMenu && (
        <>
          <button
            type="button"
            className="abide-paste-as-backdrop"
            aria-label="Close Paste as"
            onClick={
              closePasteLinkMenu
            }
          />

          <div
            className="abide-paste-as-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Paste as"
          >
            <div className="abide-paste-as-title">
              Paste as
            </div>

            <button
              type="button"
              onClick={() =>
                choosePasteLink(
                  "mention"
                )
              }
            >
              <span className="abide-paste-as-icon">
                @
              </span>
              <span>
                Mention
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                choosePasteLink(
                  "url"
                )
              }
            >
              <span className="abide-paste-as-icon">
                ↗
              </span>
              <span>
                URL
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                choosePasteLink(
                  "bookmark"
                )
              }
            >
              <span className="abide-paste-as-icon">
                ▤
              </span>
              <span>
                Bookmark
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                choosePasteLink(
                  "embed"
                )
              }
            >
              <span className="abide-paste-as-icon">
                ◫
              </span>
              <span>
                Embed
              </span>
            </button>

            <div className="abide-paste-as-preview">
              {pasteLinkMenu.url}
            </div>
          </div>
        </>
      )}


      <CommandMenu
        menu={
          menu
        }
        activeIndex={
          activeIndex
        }
        onChoose={
          chooseMenuItem
        }
        onClose={() =>
          setMenu(null)
        }
      />


      <TaskPickerModal
        value={
          taskPicker
        }
        onChange={
          setTaskPicker
        }
        onSave={
          saveTaskPicker
        }
        onClose={() =>
          setTaskPicker(null)
        }
      />


      <DatePickerModal
        value={
          picker
        }
        onChange={
          setPicker
        }
        onSave={
          savePicker
        }
        onClose={() =>
          setPicker(null)
        }
      />
    </div>
  );
}
