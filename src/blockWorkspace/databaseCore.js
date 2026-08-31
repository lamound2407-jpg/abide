/*
 * =========================================================
 * ABIDE DATABASE ENGINE V2
 * =========================================================
 *
 * Model:
 *
 * Database
 *   -> schema / properties
 *   -> rows (database pages)
 *   -> views
 *
 * A view never owns the underlying data.
 * Multiple views display/query the same rows.
 *
 * Relations store row IDs from another database.
 * Rollups derive values through relations.
 * Formulas derive values from properties on the same row.
 */

export const DATABASE_VERSION = 2;


export const PROPERTY_TYPES = Object.freeze([
  {
    id: "title",
    label: "Title",
    group: "Core",
  },
  {
    id: "text",
    label: "Text",
    group: "Core",
  },
  {
    id: "number",
    label: "Number",
    group: "Core",
  },
  {
    id: "select",
    label: "Select",
    group: "Core",
  },
  {
    id: "status",
    label: "Status",
    group: "Core",
  },
  {
    id: "multi_select",
    label: "Multi-select",
    group: "Core",
  },
  {
    id: "date",
    label: "Date",
    group: "Core",
  },
  {
    id: "checkbox",
    label: "Checkbox",
    group: "Core",
  },

  {
    id: "relation",
    label: "Relation",
    group: "Advanced",
  },
  {
    id: "rollup",
    label: "Rollup",
    group: "Advanced",
  },
  {
    id: "formula",
    label: "Formula",
    group: "Advanced",
  },

  {
    id: "url",
    label: "URL",
    group: "Contact",
  },
  {
    id: "email",
    label: "Email",
    group: "Contact",
  },
  {
    id: "phone",
    label: "Phone",
    group: "Contact",
  },
  {
    id: "person",
    label: "Person",
    group: "Contact",
  },
  {
    id: "files",
    label: "Files & media",
    group: "Contact",
  },
  {
    id: "place",
    label: "Place",
    group: "Contact",
  },

  {
    id: "unique_id",
    label: "ID",
    group: "Automatic",
  },
  {
    id: "created_time",
    label: "Created time",
    group: "Automatic",
  },
  {
    id: "created_by",
    label: "Created by",
    group: "Automatic",
  },
  {
    id: "last_edited_time",
    label: "Last edited time",
    group: "Automatic",
  },
  {
    id: "last_edited_by",
    label: "Last edited by",
    group: "Automatic",
  },

  {
    id: "button",
    label: "Button",
    group: "Action",
  },
]);


export const VIEW_TYPES = Object.freeze([
  {
    id: "table",
    label: "Table",
  },
  {
    id: "board",
    label: "Board",
  },
  {
    id: "gallery",
    label: "Gallery",
  },
  {
    id: "list",
    label: "List",
  },
  {
    id: "calendar",
    label: "Calendar",
  },
  {
    id: "timeline",
    label: "Timeline",
  },
  {
    id: "chart",
    label: "Chart",
  },
]);


export const FILTER_OPERATORS = Object.freeze([
  {
    id: "equals",
    label: "Is",
  },
  {
    id: "not_equals",
    label: "Is not",
  },
  {
    id: "contains",
    label: "Contains",
  },
  {
    id: "not_contains",
    label: "Does not contain",
  },
  {
    id: "greater_than",
    label: "Greater than",
  },
  {
    id: "less_than",
    label: "Less than",
  },
  {
    id: "on_or_after",
    label: "On or after",
  },
  {
    id: "on_or_before",
    label: "On or before",
  },
  {
    id: "is_empty",
    label: "Is empty",
  },
  {
    id: "is_not_empty",
    label: "Is not empty",
  },
]);


export const OPTION_COLORS = Object.freeze([
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
]);


export function databaseId(prefix = "db") {
  return (
    `${prefix}-` +
    Date.now().toString(36) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}


function nowIso() {
  return new Date().toISOString();
}


export function makeOption(
  name,
  color = "gray"
) {
  return {
    id:
      databaseId(
        "option"
      ),

    name:
      String(
        name ||
        "Option"
      ),

    color,
  };
}


export function defaultStatusOptions() {
  return [
    makeOption(
      "Not started",
      "gray"
    ),

    makeOption(
      "In progress",
      "blue"
    ),

    makeOption(
      "Complete",
      "green"
    ),
  ];
}


export function makeProperty(
  type = "text",
  name = "Property"
) {
  const property = {
    id:
      databaseId(
        "property"
      ),

    name:
      String(name),

    type,

    description:
      "",

    createdAt:
      nowIso(),
  };


  if (
    type === "select" ||
    type === "multi_select"
  ) {
    property.options = [
      makeOption(
        "Option 1",
        "gray"
      ),
    ];
  }


  if (
    type === "status"
  ) {
    property.options =
      defaultStatusOptions();
  }


  if (
    type === "number"
  ) {
    property.numberFormat =
      "number";
  }


  if (
    type === "relation"
  ) {
    property.targetCollectionId =
      "";

    property.twoWay =
      false;

    property.backPropertyId =
      "";

    property.limit =
      "many";
  }


  if (
    type === "rollup"
  ) {
    property.relationPropertyId =
      "";

    property.targetPropertyId =
      "";

    property.rollupFunction =
      "count";
  }


  if (
    type === "formula"
  ) {
    property.expression =
      'prop("Name")';
  }


  if (
    type === "unique_id"
  ) {
    property.prefix =
      "";
  }


  if (
    type === "button"
  ) {
    property.buttonLabel =
      "Open";

    property.buttonAction =
      "open_url";

    property.targetPropertyId =
      "";
  }


  return property;
}


export function makeView(
  type = "table",
  name = null,
  scopeId = null
) {
  const label =
    VIEW_TYPES.find(
      (view) =>
        view.id === type
    )?.label ||
    "Table";

  return {
    id:
      databaseId(
        "view"
      ),

    name:
      name ||
      label,

    type,

    scopeId:
      scopeId ||
      null,

    filters:
      [],

    filterLogic:
      "and",

    sorts:
      [],

    groupBy:
      "",

    subGroupBy:
      "",

    visibleProperties:
      [],

    calendarBy:
      "",

    timelineStart:
      "",

    timelineEnd:
      "",

    chartGroupBy:
      "",

    chartValue:
      "",

    chartAggregate:
      "count",

    wrapCells:
      false,

    frozenColumns:
      1,

    openPagesIn:
      "peek",

    createdAt:
      nowIso(),
  };
}


export function makeRow(
  collection
) {
  const created =
    nowIso();

  const row = {
    id:
      databaseId(
        "row"
      ),

    values:
      {},

    pageBody:
      "",

    createdAt:
      created,

    updatedAt:
      created,

    createdBy:
      "You",

    lastEditedBy:
      "You",
  };


  const properties =
    collection?.properties ||
    [];


  properties.forEach(
    (property) => {
      switch (
        property.type
      ) {
        case "title":
          row.values[
            property.id
          ] =
            "Untitled";
          break;

        case "checkbox":
          row.values[
            property.id
          ] =
            false;
          break;

        case "multi_select":
        case "relation":
        case "files":
          row.values[
            property.id
          ] =
            [];
          break;

        case "number":
          row.values[
            property.id
          ] =
            null;
          break;

        default:
          break;
      }
    }
  );


  return row;
}


export function titleProperty(
  collection
) {
  return (
    collection?.properties?.find(
      (property) =>
        property.type ===
        "title"
    ) ||
    null
  );
}


export function propertyById(
  collection,
  propertyId
) {
  return (
    collection?.properties?.find(
      (property) =>
        property.id ===
        propertyId
    ) ||
    null
  );
}


export function propertyByName(
  collection,
  name
) {
  const target =
    String(name || "")
      .trim()
      .toLowerCase();

  return (
    collection?.properties?.find(
      (property) =>
        String(
          property.name ||
          ""
        )
          .trim()
          .toLowerCase() ===
        target
    ) ||
    null
  );
}


function migrateLegacyRows(
  collection,
  properties
) {
  const title =
    properties.find(
      (property) =>
        property.type ===
        "title"
    );

  const status =
    properties.find(
      (property) =>
        property.type ===
        "status"
    );

  const date =
    properties.find(
      (property) =>
        property.type ===
        "date"
    );


  return (
    collection.rows ||
    []
  ).map(
    (row, index) => {
      const values = {
        ...(row.values ||
          {}),
      };


      if (
        title &&
        values[
          title.id
        ] === undefined
      ) {
        values[
          title.id
        ] =
          row.name ||
          row.title ||
          "Untitled";
      }


      if (
        status &&
        values[
          status.id
        ] === undefined &&
        row.status
      ) {
        values[
          status.id
        ] =
          row.status;
      }


      if (
        date &&
        values[
          date.id
        ] === undefined &&
        row.date
      ) {
        values[
          date.id
        ] =
          row.date;
      }


      return {
        ...row,

        id:
          row.id ||
          databaseId(
            "row"
          ),

        values,

        pageBody:
          row.pageBody ||
          "",

        createdAt:
          row.createdAt ||
          nowIso(),

        updatedAt:
          row.updatedAt ||
          row.createdAt ||
          nowIso(),

        createdBy:
          row.createdBy ||
          "You",

        lastEditedBy:
          row.lastEditedBy ||
          "You",

        /*
         * Keep legacy mirrors temporarily.
         * They prevent old code/cloud copies from breaking.
         */
        name:
          title
            ? values[
                title.id
              ] ||
              row.name ||
              "Untitled"
            : row.name ||
              "Untitled",

        _legacyIndex:
          row._legacyIndex ??
          index,
      };
    }
  );
}


export function normalizeDatabase(
  rawCollection,
  preferredViewType =
    "table"
) {
  if (!rawCollection) {
    return null;
  }


  let properties =
    Array.isArray(
      rawCollection.properties
    )
      ? [
          ...rawCollection.properties,
        ]
      : [];


  if (
    !properties.some(
      (property) =>
        property.type ===
        "title"
    )
  ) {
    properties.unshift({
      ...makeProperty(
        "title",
        "Name"
      ),

      id:
        "title",
    });
  }


  if (
    !rawCollection
      .databaseVersion &&
    !properties.some(
      (property) =>
        property.type ===
        "status"
    )
  ) {
    properties.push({
      ...makeProperty(
        "status",
        "Status"
      ),

      id:
        "status",
    });
  }


  if (
    !rawCollection
      .databaseVersion &&
    !properties.some(
      (property) =>
        property.type ===
        "date"
    )
  ) {
    properties.push({
      ...makeProperty(
        "date",
        "Date"
      ),

      id:
        "date",
    });
  }


  let views =
    Array.isArray(
      rawCollection.views
    )
      ? [
          ...rawCollection.views,
        ]
      : [];


  if (!views.length) {
    views = [
      makeView(
        preferredViewType ||
        "table"
      ),
    ];
  }


  if (
    !views.some(
      (view) =>
        view.type ===
        preferredViewType
    )
  ) {
    views.push(
      makeView(
        preferredViewType
      )
    );
  }


  const title =
    properties.find(
      (property) =>
        property.type ===
        "title"
    );


  views =
    views.map(
      (view) => ({
        filters:
          [],

        filterLogic:
          "and",

        sorts:
          [],

        visibleProperties:
          properties.map(
            (property) =>
              property.id
          ),

        ...view,

        visibleProperties:
          Array.isArray(
            view.visibleProperties
          ) &&
          view
            .visibleProperties
            .length
            ? view
                .visibleProperties
            : properties.map(
                (
                  property
                ) =>
                  property.id
              ),
      })
    );


  const rows =
    migrateLegacyRows(
      rawCollection,
      properties
    );


  return {
    ...rawCollection,

    databaseVersion:
      DATABASE_VERSION,

    name:
      rawCollection.name ||
      "Untitled database",

    properties,

    rows,

    views,

    defaultViewId:
      rawCollection
        .defaultViewId ||
      views[0]?.id ||
      "",

    titlePropertyId:
      title?.id ||
      "",

    updatedAt:
      rawCollection.updatedAt ||
      Date.now(),
  };
}


function emptyValue(
  value
) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (
      Array.isArray(value) &&
      !value.length
    )
  );
}


function relationRows(
  row,
  relationProperty,
  collections
) {
  if (
    !relationProperty ||
    relationProperty.type !==
      "relation"
  ) {
    return [];
  }


  const target =
    collections.find(
      (collection) =>
        collection.id ===
        relationProperty
          .targetCollectionId
    );


  if (!target) {
    return [];
  }


  const ids =
    row.values?.[
      relationProperty.id
    ] || [];


  return ids
    .map(
      (rowId) =>
        target.rows?.find(
          (candidate) =>
            candidate.id ===
            rowId
        )
    )
    .filter(Boolean)
    .map(
      (targetRow) => ({
        collection:
          target,

        row:
          targetRow,
      })
    );
}


function rollupValue(
  row,
  property,
  collection,
  collections
) {
  const relation =
    propertyById(
      collection,
      property
        .relationPropertyId
    );


  if (!relation) {
    return null;
  }


  const linked =
    relationRows(
      row,
      relation,
      collections
    );


  if (
    property
      .rollupFunction ===
    "count"
  ) {
    return linked.length;
  }


  const targetCollection =
    collections.find(
      (candidate) =>
        candidate.id ===
        relation
          .targetCollectionId
    );


  const targetProperty =
    propertyById(
      targetCollection,
      property
        .targetPropertyId
    );


  if (
    !targetCollection ||
    !targetProperty
  ) {
    return null;
  }


  const values =
    linked.map(
      ({ row: targetRow }) =>
        readPropertyValue(
          targetRow,
          targetProperty,
          targetCollection,
          collections
        )
    );


  const nonEmpty =
    values.filter(
      (value) =>
        !emptyValue(
          value
        )
    );


  switch (
    property.rollupFunction
  ) {
    case "show":
      return nonEmpty;

    case "unique":
      return [
        ...new Set(
          nonEmpty.flat()
        ),
      ];

    case "sum":
      return nonEmpty.reduce(
        (total, value) =>
          total +
          Number(
            value || 0
          ),
        0
      );

    case "average":
      return nonEmpty.length
        ? nonEmpty.reduce(
            (
              total,
              value
            ) =>
              total +
              Number(
                value || 0
              ),
            0
          ) /
            nonEmpty.length
        : 0;

    case "min":
      return nonEmpty.length
        ? Math.min(
            ...nonEmpty.map(
              Number
            )
          )
        : null;

    case "max":
      return nonEmpty.length
        ? Math.max(
            ...nonEmpty.map(
              Number
            )
          )
        : null;

    case "percent_checked": {
      if (!values.length) {
        return 0;
      }

      const checked =
        values.filter(
          Boolean
        ).length;

      return (
        checked /
        values.length
      );
    }

    default:
      return nonEmpty;
  }
}


function formulaValue(
  row,
  property,
  collection,
  collections
) {
  const expression =
    String(
      property.expression ||
      ""
    ).trim();


  if (!expression) {
    return "";
  }


  /*
   * Abide Formula V1.
   *
   * Supports:
   *   prop("Budget")
   *   prop("Done") ? "Yes" : "No"
   *   prop("Hours") * prop("Rate")
   *   round(...)
   *   min / max / abs
   *
   * This intentionally does NOT pretend to be the complete
   * Notion Formula language yet.
   */

  let compiled =
    expression.replace(
      /prop\(\s*["']([^"']+)["']\s*\)/g,
      (
        match,
        propertyName
      ) => {
        const target =
          propertyByName(
            collection,
            propertyName
          );

        if (!target) {
          return "null";
        }

        if (
          target.id ===
          property.id
        ) {
          return "null";
        }

        const value =
          readPropertyValue(
            row,
            target,
            collection,
            collections
          );

        return JSON.stringify(
          value
        );
      }
    );


  const forbidden =
    /\b(window|document|globalThis|constructor|prototype|__proto__|eval|Function|import|fetch|XMLHttpRequest)\b|[;{}]/;


  if (
    forbidden.test(
      compiled
    )
  ) {
    return "Formula error";
  }


  try {
    const fn =
      new Function(
        "round",
        "min",
        "max",
        "abs",
        "length",
        `"use strict";
         return (${compiled});`
      );


    return fn(
      Math.round,
      Math.min,
      Math.max,
      Math.abs,
      (value) =>
        value?.length ?? 0
    );
  } catch {
    return "Formula error";
  }
}


export function readPropertyValue(
  row,
  property,
  collection,
  collections = []
) {
  if (
    !row ||
    !property
  ) {
    return null;
  }


  switch (
    property.type
  ) {
    case "created_time":
      return (
        row.createdAt ||
        ""
      );

    case "created_by":
      return (
        row.createdBy ||
        "You"
      );

    case "last_edited_time":
      return (
        row.updatedAt ||
        ""
      );

    case "last_edited_by":
      return (
        row.lastEditedBy ||
        "You"
      );

    case "unique_id": {
      const index =
        Math.max(
          0,
          (
            collection.rows ||
            []
          ).findIndex(
            (candidate) =>
              candidate.id ===
              row.id
          )
        ) + 1;

      return (
        `${property.prefix || ""}${index}`
      );
    }

    case "rollup":
      return rollupValue(
        row,
        property,
        collection,
        collections
      );

    case "formula":
      return formulaValue(
        row,
        property,
        collection,
        collections
      );

    default:
      return (
        row.values?.[
          property.id
        ] ??
        null
      );
  }
}


function comparable(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    typeof value ===
    "string"
  ) {
    return value
      .toLowerCase();
  }

  return value;
}


export function filterMatches(
  row,
  filter,
  collection,
  collections
) {
  const property =
    propertyById(
      collection,
      filter.propertyId
    );


  if (!property) {
    return true;
  }


  const raw =
    readPropertyValue(
      row,
      property,
      collection,
      collections
    );


  const value =
    comparable(raw);

  const wanted =
    comparable(
      filter.value
    );


  switch (
    filter.operator
  ) {
    case "is_empty":
      return emptyValue(
        raw
      );

    case "is_not_empty":
      return !emptyValue(
        raw
      );

    case "equals":
      if (
        Array.isArray(value)
      ) {
        return value.includes(
          filter.value
        );
      }

      return (
        value === wanted
      );

    case "not_equals":
      if (
        Array.isArray(value)
      ) {
        return !value.includes(
          filter.value
        );
      }

      return (
        value !== wanted
      );

    case "contains":
      if (
        Array.isArray(value)
      ) {
        return value.includes(
          filter.value
        );
      }

      return String(
        value ?? ""
      ).includes(
        String(
          wanted ?? ""
        )
      );

    case "not_contains":
      if (
        Array.isArray(value)
      ) {
        return !value.includes(
          filter.value
        );
      }

      return !String(
        value ?? ""
      ).includes(
        String(
          wanted ?? ""
        )
      );

    case "greater_than":
      return (
        Number(raw) >
        Number(
          filter.value
        )
      );

    case "less_than":
      return (
        Number(raw) <
        Number(
          filter.value
        )
      );

    case "on_or_after":
      return (
        String(raw || "") >=
        String(
          filter.value ||
          ""
        )
      );

    case "on_or_before":
      return (
        String(raw || "") <=
        String(
          filter.value ||
          ""
        )
      );

    default:
      return true;
  }
}


export function applyViewQuery(
  rows,
  collection,
  view,
  collections
) {
  let result =
    [...rows];


  const filters =
    view?.filters ||
    [];


  if (
    filters.length
  ) {
    result =
      result.filter(
        (row) => {
          const matches =
            filters.map(
              (filter) =>
                filterMatches(
                  row,
                  filter,
                  collection,
                  collections
                )
            );

          return (
            view.filterLogic ===
            "or"
              ? matches.some(
                  Boolean
                )
              : matches.every(
                  Boolean
                )
          );
        }
      );
  }


  const sorts =
    view?.sorts ||
    [];


  if (
    sorts.length
  ) {
    result.sort(
      (a, b) => {
        for (
          const sort of
          sorts
        ) {
          const property =
            propertyById(
              collection,
              sort.propertyId
            );

          if (!property) {
            continue;
          }


          const left =
            readPropertyValue(
              a,
              property,
              collection,
              collections
            );

          const right =
            readPropertyValue(
              b,
              property,
              collection,
              collections
            );


          let comparison =
            0;


          if (
            left === null ||
            left === undefined ||
            left === ""
          ) {
            comparison =
              right === null ||
              right === undefined ||
              right === ""
                ? 0
                : 1;
          } else if (
            right === null ||
            right === undefined ||
            right === ""
          ) {
            comparison =
              -1;
          } else if (
            typeof left ===
              "number" &&
            typeof right ===
              "number"
          ) {
            comparison =
              left - right;
          } else {
            comparison =
              String(left)
                .localeCompare(
                  String(
                    right
                  ),
                  undefined,
                  {
                    numeric:
                      true,

                    sensitivity:
                      "base",
                  }
                );
          }


          if (
            comparison !== 0
          ) {
            return (
              sort.direction ===
              "desc"
                ? -comparison
                : comparison
            );
          }
        }

        return 0;
      }
    );
  }


  return result;
}


export function displayValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }


  if (
    Array.isArray(value)
  ) {
    return value.join(
      ", "
    );
  }


  if (
    typeof value ===
    "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }


  return String(value);
}
