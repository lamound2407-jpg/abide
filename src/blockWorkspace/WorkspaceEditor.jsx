import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./blockWorkspace.css";

import BlockRenderer from "./BlockRenderer.jsx";

import CommandMenu, {
  DatePickerModal,
} from "./CommandMenu.jsx";

import {
  BLOCK_TYPES,
  createBlock,
  createInlineReminder,
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
    "Type / for commands or @ to mention…",
}) {
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

  const rootRef =
    useRef(null);


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

      if (
        index <= 0
      ) {
        return;
      }

      const previous =
        blocks[
          index - 1
        ];

      if (
        !previous ||
        previous.type ===
          BLOCK_TYPES.DIVIDER
      ) {
        return;
      }

      const previousText =
        String(
          previous.text || ""
        );

      const currentText =
        String(
          block.text || ""
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


  const executeSlash =
    (command) => {
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

        todo:
          BLOCK_TYPES.TODO,

        "to-do":
          BLOCK_TYPES.TODO,

        bullet:
          BLOCK_TYPES.BULLETED_LIST,

        num:
          BLOCK_TYPES.NUMBERED_LIST,

        numbered:
          BLOCK_TYPES.NUMBERED_LIST,

        toggle:
          BLOCK_TYPES.TOGGLE,

        h1:
          BLOCK_TYPES.HEADING_1,

        h2:
          BLOCK_TYPES.HEADING_2,

        h3:
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
      if (
        menu?.trigger ===
        "@"
      ) {
        chooseMention(item);
      } else {
        executeSlash(item);
      }
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
      className={`abide-workspace-editor ${className}`}
      data-abide-block-editor="true"
    >
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
                updateOne
              }
              onOpenSlash={
                openSlash
              }
              onOpenMention={
                openMention
              }
              onEnter={
                handleEnter
              }
              onBackspaceStart={
                handleBackspaceStart
              }
            />
          </div>
        )
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
