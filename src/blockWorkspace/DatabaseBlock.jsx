import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  COLLECTIONS_KEY,
  getCollection,
  getCollections,
  updateCollection,
} from "./workspaceCore.js";

import {
  PROPERTY_TYPES,
  VIEW_TYPES,
  FILTER_OPERATORS,
  OPTION_COLORS,
  databaseId,
  makeProperty,
  makeView,
  makeRow,
  normalizeDatabase,
  titleProperty,
  propertyById,
  readPropertyValue,
  applyViewQuery,
  displayValue,
} from "./databaseCore.js";


/* =========================================================
   HELPERS
========================================================= */

function cx(...parts) {
  return parts
    .filter(Boolean)
    .join(" ");
}


function collectionTitle(
  collection,
  row
) {
  const property =
    titleProperty(
      collection
    );

  return (
    property
      ? row.values?.[
          property.id
        ]
      : ""
  ) || "Untitled";
}


function automaticProperty(
  type
) {
  return [
    "formula",
    "rollup",
    "unique_id",
    "created_time",
    "created_by",
    "last_edited_time",
    "last_edited_by",
  ].includes(type);
}


function selectPropertyOptions(
  property
) {
  return (
    property?.options ||
    []
  );
}


function valueIsActive(
  value,
  optionName
) {
  if (
    Array.isArray(value)
  ) {
    return value.includes(
      optionName
    );
  }

  return (
    value ===
    optionName
  );
}


/* =========================================================
   DATABASE ACTIONS
========================================================= */

function DatabaseActions({
  block,
  onEnter,
  onRemove,
}) {
  return (
    <div className="abide-db-actions">
      <button
        type="button"
        onClick={() =>
          onEnter?.({
            block,
            caret:
              String(
                block?.text ||
                ""
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


/* =========================================================
   PROPERTY VALUE EDITOR
========================================================= */

function PropertyEditor({
  property,
  row,
  collection,
  collections,
  updateValue,
}) {
  const value =
    readPropertyValue(
      row,
      property,
      collection,
      collections
    );


  if (
    automaticProperty(
      property.type
    )
  ) {
    return (
      <div className="abide-db-computed-value">
        {displayValue(
          value
        ) || "—"}
      </div>
    );
  }


  if (
    property.type ===
    "checkbox"
  ) {
    return (
      <label className="abide-db-checkbox">
        <input
          type="checkbox"
          checked={
            Boolean(value)
          }
          onChange={(event) =>
            updateValue(
              property.id,
              event.target
                .checked
            )
          }
        />
        <span />
      </label>
    );
  }


  if (
    property.type ===
    "date"
  ) {
    return (
      <input
        className="abide-db-cell-input"
        type="date"
        value={
          value || ""
        }
        onChange={(event) =>
          updateValue(
            property.id,
            event.target
              .value
          )
        }
      />
    );
  }


  if (
    property.type ===
    "number"
  ) {
    return (
      <input
        className="abide-db-cell-input"
        type="number"
        value={
          value ?? ""
        }
        onChange={(event) =>
          updateValue(
            property.id,
            event.target
              .value ===
              ""
              ? null
              : Number(
                  event
                    .target
                    .value
                )
          )
        }
      />
    );
  }


  if (
    property.type ===
      "select" ||
    property.type ===
      "status"
  ) {
    return (
      <select
        className="abide-db-cell-select"
        value={
          value || ""
        }
        onChange={(event) =>
          updateValue(
            property.id,
            event.target
              .value
          )
        }
      >
        <option value="">
          —
        </option>

        {selectPropertyOptions(
          property
        ).map(
          (option) => (
            <option
              key={
                option.id
              }
              value={
                option.name
              }
            >
              {
                option.name
              }
            </option>
          )
        )}
      </select>
    );
  }


  if (
    property.type ===
    "multi_select"
  ) {
    return (
      <div className="abide-db-tag-picker">
        {selectPropertyOptions(
          property
        ).map(
          (option) => {
            const active =
              valueIsActive(
                value,
                option.name
              );

            return (
              <button
                key={
                  option.id
                }
                type="button"
                className={cx(
                  "abide-db-tag",
                  `tone-${option.color}`,
                  active &&
                    "active"
                )}
                onClick={() => {
                  const current =
                    Array.isArray(
                      value
                    )
                      ? value
                      : [];

                  updateValue(
                    property.id,
                    active
                      ? current.filter(
                          (
                            item
                          ) =>
                            item !==
                            option.name
                        )
                      : [
                          ...current,
                          option.name,
                        ]
                  );
                }}
              >
                {option.name}
              </button>
            );
          }
        )}
      </div>
    );
  }


  if (
    property.type ===
    "relation"
  ) {
    const target =
      collections.find(
        (candidate) =>
          candidate.id ===
          property
            .targetCollectionId
      );

    const relationValue =
      Array.isArray(value)
        ? value
        : [];

    if (!target) {
      return (
        <span className="abide-db-muted">
          Choose related database
        </span>
      );
    }

    return (
      <div className="abide-db-relation-picker">
        {(target.rows || [])
          .slice(0, 50)
          .map(
            (
              targetRow
            ) => {
              const active =
                relationValue.includes(
                  targetRow.id
                );

              return (
                <button
                  type="button"
                  key={
                    targetRow.id
                  }
                  className={cx(
                    "abide-db-relation-pill",
                    active &&
                      "active"
                  )}
                  onClick={() =>
                    updateValue(
                      property.id,
                      active
                        ? relationValue.filter(
                            (
                              id
                            ) =>
                              id !==
                              targetRow.id
                          )
                        : [
                            ...relationValue,
                            targetRow.id,
                          ]
                    )
                  }
                >
                  {collectionTitle(
                    target,
                    targetRow
                  )}
                </button>
              );
            }
          )}
      </div>
    );
  }


  if (
    property.type ===
    "url"
  ) {
    return (
      <input
        className="abide-db-cell-input"
        type="url"
        placeholder="https://"
        value={
          value || ""
        }
        onChange={(event) =>
          updateValue(
            property.id,
            event.target
              .value
          )
        }
      />
    );
  }


  if (
    property.type ===
    "email"
  ) {
    return (
      <input
        className="abide-db-cell-input"
        type="email"
        value={
          value || ""
        }
        onChange={(event) =>
          updateValue(
            property.id,
            event.target
              .value
          )
        }
      />
    );
  }


  if (
    property.type ===
    "phone"
  ) {
    return (
      <input
        className="abide-db-cell-input"
        type="tel"
        value={
          value || ""
        }
        onChange={(event) =>
          updateValue(
            property.id,
            event.target
              .value
          )
        }
      />
    );
  }


  return (
    <input
      className="abide-db-cell-input"
      type="text"
      value={
        value || ""
      }
      onChange={(event) =>
        updateValue(
          property.id,
          event.target
            .value
        )
      }
    />
  );
}


/* =========================================================
   FILTER BUILDER
========================================================= */

function FiltersPanel({
  collection,
  view,
  updateView,
}) {
  const filters =
    view.filters ||
    [];


  const addFilter = () => {
    const property =
      collection
        .properties?.[0];

    if (!property) {
      return;
    }

    updateView({
      ...view,

      filters: [
        ...filters,

        {
          id:
            databaseId(
              "filter"
            ),

          propertyId:
            property.id,

          operator:
            "equals",

          value:
            "",
        },
      ],
    });
  };


  return (
    <div className="abide-db-panel">
      <div className="abide-db-panel-head">
        <strong>
          Filters
        </strong>

        <select
          value={
            view.filterLogic ||
            "and"
          }
          onChange={(event) =>
            updateView({
              ...view,

              filterLogic:
                event.target
                  .value,
            })
          }
        >
          <option value="and">
            Match all
          </option>

          <option value="or">
            Match any
          </option>
        </select>
      </div>

      {filters.map(
        (filter) => (
          <div
            className="abide-db-rule"
            key={
              filter.id
            }
          >
            <select
              value={
                filter
                  .propertyId
              }
              onChange={(
                event
              ) =>
                updateView({
                  ...view,

                  filters:
                    filters.map(
                      (
                        candidate
                      ) =>
                        candidate.id ===
                        filter.id
                          ? {
                              ...candidate,

                              propertyId:
                                event
                                  .target
                                  .value,
                            }
                          : candidate
                    ),
                })
              }
            >
              {collection.properties.map(
                (
                  property
                ) => (
                  <option
                    key={
                      property.id
                    }
                    value={
                      property.id
                    }
                  >
                    {
                      property.name
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                filter.operator
              }
              onChange={(
                event
              ) =>
                updateView({
                  ...view,

                  filters:
                    filters.map(
                      (
                        candidate
                      ) =>
                        candidate.id ===
                        filter.id
                          ? {
                              ...candidate,

                              operator:
                                event
                                  .target
                                  .value,
                            }
                          : candidate
                    ),
                })
              }
            >
              {FILTER_OPERATORS.map(
                (
                  operator
                ) => (
                  <option
                    key={
                      operator.id
                    }
                    value={
                      operator.id
                    }
                  >
                    {
                      operator.label
                    }
                  </option>
                )
              )}
            </select>

            {![
              "is_empty",
              "is_not_empty",
            ].includes(
              filter.operator
            ) && (
              <input
                value={
                  filter.value ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  updateView({
                    ...view,

                    filters:
                      filters.map(
                        (
                          candidate
                        ) =>
                          candidate.id ===
                          filter.id
                            ? {
                                ...candidate,

                                value:
                                  event
                                    .target
                                    .value,
                              }
                            : candidate
                      ),
                  })
                }
              />
            )}

            <button
              type="button"
              className="abide-db-icon-button danger"
              onClick={() =>
                updateView({
                  ...view,

                  filters:
                    filters.filter(
                      (
                        candidate
                      ) =>
                        candidate.id !==
                        filter.id
                    ),
                })
              }
            >
              ×
            </button>
          </div>
        )
      )}

      <button
        type="button"
        className="abide-db-panel-add"
        onClick={
          addFilter
        }
      >
        + Add filter
      </button>
    </div>
  );
}


/* =========================================================
   SORT BUILDER
========================================================= */

function SortPanel({
  collection,
  view,
  updateView,
}) {
  const sorts =
    view.sorts ||
    [];


  const addSort = () => {
    const property =
      collection
        .properties?.[0];

    if (!property) {
      return;
    }

    updateView({
      ...view,

      sorts: [
        ...sorts,

        {
          id:
            databaseId(
              "sort"
            ),

          propertyId:
            property.id,

          direction:
            "asc",
        },
      ],
    });
  };


  return (
    <div className="abide-db-panel">
      <div className="abide-db-panel-head">
        <strong>
          Sort
        </strong>

        <span>
          Order matters
        </span>
      </div>

      {sorts.map(
        (sort) => (
          <div
            className="abide-db-rule"
            key={
              sort.id
            }
          >
            <select
              value={
                sort.propertyId
              }
              onChange={(
                event
              ) =>
                updateView({
                  ...view,

                  sorts:
                    sorts.map(
                      (
                        candidate
                      ) =>
                        candidate.id ===
                        sort.id
                          ? {
                              ...candidate,

                              propertyId:
                                event
                                  .target
                                  .value,
                            }
                          : candidate
                    ),
                })
              }
            >
              {collection.properties.map(
                (
                  property
                ) => (
                  <option
                    key={
                      property.id
                    }
                    value={
                      property.id
                    }
                  >
                    {
                      property.name
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                sort.direction
              }
              onChange={(
                event
              ) =>
                updateView({
                  ...view,

                  sorts:
                    sorts.map(
                      (
                        candidate
                      ) =>
                        candidate.id ===
                        sort.id
                          ? {
                              ...candidate,

                              direction:
                                event
                                  .target
                                  .value,
                            }
                          : candidate
                    ),
                })
              }
            >
              <option value="asc">
                Ascending
              </option>

              <option value="desc">
                Descending
              </option>
            </select>

            <button
              type="button"
              className="abide-db-icon-button danger"
              onClick={() =>
                updateView({
                  ...view,

                  sorts:
                    sorts.filter(
                      (
                        candidate
                      ) =>
                        candidate.id !==
                        sort.id
                    ),
                })
              }
            >
              ×
            </button>
          </div>
        )
      )}

      <button
        type="button"
        className="abide-db-panel-add"
        onClick={
          addSort
        }
      >
        + Add sort
      </button>
    </div>
  );
}


/* =========================================================
   PROPERTY VISIBILITY
========================================================= */

function VisibilityPanel({
  collection,
  view,
  updateView,
}) {
  const visible =
    view.visibleProperties ||
    [];


  return (
    <div className="abide-db-panel">
      <div className="abide-db-panel-head">
        <strong>
          Properties
        </strong>
      </div>

      {collection.properties.map(
        (property) => {
          const checked =
            visible.includes(
              property.id
            );

          return (
            <label
              className="abide-db-property-toggle"
              key={
                property.id
              }
            >
              <input
                type="checkbox"
                checked={
                  checked
                }
                onChange={() =>
                  updateView({
                    ...view,

                    visibleProperties:
                      checked
                        ? visible.filter(
                            (
                              id
                            ) =>
                              id !==
                              property.id
                          )
                        : [
                            ...visible,
                            property.id,
                          ],
                  })
                }
              />

              <span>
                {
                  property.name
                }
              </span>

              <small>
                {
                  property.type
                }
              </small>
            </label>
          );
        }
      )}
    </div>
  );
}


/* =========================================================
   PROPERTY SETTINGS
========================================================= */

function PropertySettings({
  property,
  collection,
  collections,
  updateProperty,
  deleteProperty,
}) {
  const [
    newOption,
    setNewOption,
  ] =
    useState("");


  return (
    <div className="abide-db-property-settings">
      <label>
        <span>
          Property name
        </span>

        <input
          value={
            property.name
          }
          onChange={(event) =>
            updateProperty({
              ...property,

              name:
                event.target
                  .value,
            })
          }
        />
      </label>

      <label>
        <span>
          Type
        </span>

        <select
          value={
            property.type
          }
          disabled={
            property.type ===
            "title"
          }
          onChange={(event) =>
            updateProperty(
              makeProperty(
                event.target
                  .value,
                property.name
              )
            )
          }
        >
          {PROPERTY_TYPES.map(
            (type) => (
              <option
                key={
                  type.id
                }
                value={
                  type.id
                }
              >
                {type.label}
              </option>
            )
          )}
        </select>
      </label>


      {[
        "select",
        "status",
        "multi_select",
      ].includes(
        property.type
      ) && (
        <div className="abide-db-options-editor">
          <span className="abide-db-settings-label">
            Options
          </span>

          {(property.options || []).map(
            (
              option
            ) => (
              <div
                className="abide-db-option-edit-row"
                key={
                  option.id
                }
              >
                <select
                  value={
                    option.color
                  }
                  onChange={(
                    event
                  ) =>
                    updateProperty({
                      ...property,

                      options:
                        property.options.map(
                          (
                            candidate
                          ) =>
                            candidate.id ===
                            option.id
                              ? {
                                  ...candidate,

                                  color:
                                    event
                                      .target
                                      .value,
                                }
                              : candidate
                        ),
                    })
                  }
                >
                  {OPTION_COLORS.map(
                    (
                      color
                    ) => (
                      <option
                        value={
                          color
                        }
                        key={
                          color
                        }
                      >
                        {
                          color
                        }
                      </option>
                    )
                  )}
                </select>

                <input
                  value={
                    option.name
                  }
                  onChange={(
                    event
                  ) =>
                    updateProperty({
                      ...property,

                      options:
                        property.options.map(
                          (
                            candidate
                          ) =>
                            candidate.id ===
                            option.id
                              ? {
                                  ...candidate,

                                  name:
                                    event
                                      .target
                                      .value,
                                }
                              : candidate
                        ),
                    })
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    updateProperty({
                      ...property,

                      options:
                        property.options.filter(
                          (
                            candidate
                          ) =>
                            candidate.id !==
                            option.id
                        ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            )
          )}

          <div className="abide-db-option-new-row">
            <input
              placeholder="New option"
              value={
                newOption
              }
              onChange={(
                event
              ) =>
                setNewOption(
                  event.target
                    .value
                )
              }
            />

            <button
              type="button"
              onClick={() => {
                const name =
                  newOption.trim();

                if (!name) {
                  return;
                }

                updateProperty({
                  ...property,

                  options: [
                    ...(property.options ||
                      []),

                    {
                      id:
                        databaseId(
                          "option"
                        ),

                      name,

                      color:
                        "gray",
                    },
                  ],
                });

                setNewOption(
                  ""
                );
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}


      {property.type ===
        "relation" && (
        <>
          <label>
            <span>
              Related database
            </span>

            <select
              value={
                property
                  .targetCollectionId ||
                ""
              }
              onChange={(
                event
              ) =>
                updateProperty({
                  ...property,

                  targetCollectionId:
                    event
                      .target
                      .value,
                })
              }
            >
              <option value="">
                Choose database
              </option>

              {collections
                .filter(
                  (
                    candidate
                  ) =>
                    candidate.id !==
                    collection.id
                )
                .map(
                  (
                    candidate
                  ) => (
                    <option
                      key={
                        candidate.id
                      }
                      value={
                        candidate.id
                      }
                    >
                      {
                        candidate.name
                      }
                    </option>
                  )
                )}
            </select>
          </label>

          <label className="abide-db-check-row">
            <input
              type="checkbox"
              checked={
                Boolean(
                  property.twoWay
                )
              }
              onChange={(
                event
              ) =>
                updateProperty({
                  ...property,

                  twoWay:
                    event
                      .target
                      .checked,
                })
              }
            />

            <span>
              Show relation on both databases
            </span>
          </label>
        </>
      )}


      {property.type ===
        "rollup" && (
        <>
          <label>
            <span>
              Relation
            </span>

            <select
              value={
                property
                  .relationPropertyId ||
                ""
              }
              onChange={(
                event
              ) =>
                updateProperty({
                  ...property,

                  relationPropertyId:
                    event
                      .target
                      .value,
                })
              }
            >
              <option value="">
                Choose relation
              </option>

              {collection.properties
                .filter(
                  (
                    candidate
                  ) =>
                    candidate.type ===
                    "relation"
                )
                .map(
                  (
                    candidate
                  ) => (
                    <option
                      value={
                        candidate.id
                      }
                      key={
                        candidate.id
                      }
                    >
                      {
                        candidate.name
                      }
                    </option>
                  )
                )}
            </select>
          </label>

          <label>
            <span>
              Calculate
            </span>

            <select
              value={
                property
                  .rollupFunction ||
                "count"
              }
              onChange={(
                event
              ) =>
                updateProperty({
                  ...property,

                  rollupFunction:
                    event
                      .target
                      .value,
                })
              }
            >
              <option value="count">
                Count
              </option>

              <option value="show">
                Show original
              </option>

              <option value="unique">
                Show unique
              </option>

              <option value="sum">
                Sum
              </option>

              <option value="average">
                Average
              </option>

              <option value="min">
                Minimum
              </option>

              <option value="max">
                Maximum
              </option>

              <option value="percent_checked">
                Percent checked
              </option>
            </select>
          </label>
        </>
      )}


      {property.type ===
        "formula" && (
        <label>
          <span>
            Formula
          </span>

          <textarea
            value={
              property.expression ||
              ""
            }
            placeholder={'prop("Hours") * prop("Rate")'}
            onChange={(event) =>
              updateProperty({
                ...property,

                expression:
                  event.target
                    .value,
              })
            }
          />

          <small>
            Abide Formula V1 supports prop("Property"), arithmetic, comparisons and simple functions.
          </small>
        </label>
      )}


      {property.type !==
        "title" && (
        <button
          type="button"
          className="abide-db-delete-property"
          onClick={
            deleteProperty
          }
        >
          Delete property
        </button>
      )}
    </div>
  );
}


/* =========================================================
   SCHEMA MANAGER
========================================================= */

function SchemaPanel({
  collection,
  collections,
  saveCollection,
}) {
  const [
    selectedId,
    setSelectedId,
  ] =
    useState(
      collection
        .properties?.[0]
        ?.id || ""
    );

  const [
    newType,
    setNewType,
  ] =
    useState("text");


  const selected =
    propertyById(
      collection,
      selectedId
    );


  const updateProperty =
    (
      nextProperty
    ) => {
      const preservedId =
        selected?.id ||
        nextProperty.id;

      saveCollection({
        ...collection,

        properties:
          collection.properties.map(
            (
              property
            ) =>
              property.id ===
              selectedId
                ? {
                    ...nextProperty,

                    id:
                      preservedId,
                  }
                : property
          ),
      });
    };


  const deleteProperty =
    () => {
      if (
        !selected ||
        selected.type ===
          "title"
      ) {
        return;
      }

      const nextProperties =
        collection.properties.filter(
          (
            property
          ) =>
            property.id !==
            selected.id
        );

      const nextViews =
        collection.views.map(
          (view) => ({
            ...view,

            visibleProperties:
              (
                view.visibleProperties ||
                []
              ).filter(
                (id) =>
                  id !==
                  selected.id
              ),

            filters:
              (
                view.filters ||
                []
              ).filter(
                (filter) =>
                  filter.propertyId !==
                  selected.id
              ),

            sorts:
              (
                view.sorts ||
                []
              ).filter(
                (sort) =>
                  sort.propertyId !==
                  selected.id
              ),
          })
        );

      saveCollection({
        ...collection,

        properties:
          nextProperties,

        views:
          nextViews,
      });

      setSelectedId(
        nextProperties[0]
          ?.id || ""
      );
    };


  const addProperty =
    () => {
      const type =
        PROPERTY_TYPES.find(
          (item) =>
            item.id ===
            newType
        );

      if (!type) {
        return;
      }

      const property =
        makeProperty(
          type.id,
          type.label
        );

      saveCollection({
        ...collection,

        properties: [
          ...collection.properties,
          property,
        ],

        views:
          collection.views.map(
            (view) => ({
              ...view,

              visibleProperties: [
                ...(view.visibleProperties ||
                  []),

                property.id,
              ],
            })
          ),
      });

      setSelectedId(
        property.id
      );
    };


  return (
    <div className="abide-db-schema">
      <div className="abide-db-schema-list">
        <strong>
          Properties
        </strong>

        {collection.properties.map(
          (
            property
          ) => (
            <button
              type="button"
              key={
                property.id
              }
              className={cx(
                "abide-db-schema-property",
                selectedId ===
                  property.id &&
                  "active"
              )}
              onClick={() =>
                setSelectedId(
                  property.id
                )
              }
            >
              <span>
                {
                  property.name
                }
              </span>

              <small>
                {
                  property.type
                }
              </small>
            </button>
          )
        )}

        <div className="abide-db-new-property">
          <select
            value={
              newType
            }
            onChange={(event) =>
              setNewType(
                event.target
                  .value
              )
            }
          >
            {PROPERTY_TYPES
              .filter(
                (
                  property
                ) =>
                  property.id !==
                  "title"
              )
              .map(
                (
                  property
                ) => (
                  <option
                    key={
                      property.id
                    }
                    value={
                      property.id
                    }
                  >
                    {
                      property.label
                    }
                  </option>
                )
              )}
          </select>

          <button
            type="button"
            onClick={
              addProperty
            }
          >
            + Add
          </button>
        </div>
      </div>

      {selected && (
        <PropertySettings
          property={
            selected
          }
          collection={
            collection
          }
          collections={
            collections
          }
          updateProperty={
            updateProperty
          }
          deleteProperty={
            deleteProperty
          }
        />
      )}
    </div>
  );
}


/* =========================================================
   ROW / PAGE PEEK
========================================================= */

function RowPage({
  row,
  collection,
  collections,
  updateRow,
  close,
  deleteRow,
}) {
  const title =
    titleProperty(
      collection
    );


  return (
    <div
      className="abide-db-page-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          close();
        }
      }}
    >
      <div className="abide-db-page">
        <div className="abide-db-page-head">
          <input
            className="abide-db-page-title"
            value={
              title
                ? row.values?.[
                    title.id
                  ] ||
                  ""
                : ""
            }
            placeholder="Untitled"
            onChange={(event) =>
              updateRow({
                ...row,

                values: {
                  ...row.values,

                  [title.id]:
                    event.target
                      .value,
                },
              })
            }
          />

          <button
            type="button"
            onClick={
              close
            }
          >
            ×
          </button>
        </div>

        <div className="abide-db-page-properties">
          {collection.properties
            .filter(
              (
                property
              ) =>
                property.type !==
                "title"
            )
            .map(
              (
                property
              ) => (
                <div
                  className="abide-db-page-property"
                  key={
                    property.id
                  }
                >
                  <div className="abide-db-page-property-name">
                    {
                      property.name
                    }
                  </div>

                  <div className="abide-db-page-property-value">
                    <PropertyEditor
                      property={
                        property
                      }
                      row={
                        row
                      }
                      collection={
                        collection
                      }
                      collections={
                        collections
                      }
                      updateValue={(
                        propertyId,
                        value
                      ) =>
                        updateRow({
                          ...row,

                          values: {
                            ...row.values,

                            [propertyId]:
                              value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )
            )}
        </div>

        <div className="abide-db-page-divider" />

        <textarea
          className="abide-db-page-body"
          value={
            row.pageBody ||
            ""
          }
          placeholder="Write something..."
          onChange={(event) =>
            updateRow({
              ...row,

              pageBody:
                event.target
                  .value,
            })
          }
        />

        <div className="abide-db-page-footer">
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (
                window.confirm(
                  "Delete this database page?"
                )
              ) {
                deleteRow(
                  row.id
                );

                close();
              }
            }}
          >
            Delete page
          </button>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   DESKTOP TABLE
========================================================= */

function TableView({
  collection,
  collections,
  rows,
  view,
  updateRow,
  openRow,
}) {
  const visibleIds =
    view.visibleProperties?.length
      ? view.visibleProperties
      : collection.properties.map(
          (
            property
          ) =>
            property.id
        );


  const properties =
    visibleIds
      .map(
        (id) =>
          propertyById(
            collection,
            id
          )
      )
      .filter(Boolean);


  return (
    <div className="abide-db-table-wrap">
      <table className="abide-db-v2-table">
        <thead>
          <tr>
            {properties.map(
              (
                property
              ) => (
                <th
                  key={
                    property.id
                  }
                >
                  <span>
                    {
                      property.name
                    }
                  </span>

                  <small>
                    {
                      property.type
                    }
                  </small>
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row) => (
              <tr
                key={
                  row.id
                }
              >
                {properties.map(
                  (
                    property
                  ) => (
                    <td
                      key={
                        property.id
                      }
                      className={
                        property.type ===
                        "title"
                          ? "abide-db-title-cell"
                          : ""
                      }
                    >
                      {property.type ===
                      "title" ? (
                        <div className="abide-db-title-edit">
                          <input
                            value={
                              row.values?.[
                                property.id
                              ] ||
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              updateRow({
                                ...row,

                                values: {
                                  ...row.values,

                                  [property.id]:
                                    event
                                      .target
                                      .value,
                                },
                              })
                            }
                          />

                          <button
                            type="button"
                            title="Open page"
                            onClick={() =>
                              openRow(
                                row.id
                              )
                            }
                          >
                            ↗
                          </button>
                        </div>
                      ) : (
                        <PropertyEditor
                          property={
                            property
                          }
                          row={
                            row
                          }
                          collection={
                            collection
                          }
                          collections={
                            collections
                          }
                          updateValue={(
                            propertyId,
                            value
                          ) =>
                            updateRow({
                              ...row,

                              values: {
                                ...row.values,

                                [propertyId]:
                                  value,
                              },
                            })
                          }
                        />
                      )}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}


/* =========================================================
   MOBILE DATABASE CARDS
========================================================= */

function MobileRows({
  collection,
  collections,
  rows,
  view,
  openRow,
}) {
  const title =
    titleProperty(
      collection
    );

  const visible =
    (
      view.visibleProperties ||
      []
    )
      .map(
        (id) =>
          propertyById(
            collection,
            id
          )
      )
      .filter(
        (
          property
        ) =>
          property &&
          property.id !==
            title?.id
      )
      .slice(
        0,
        4
      );


  return (
    <div className="abide-db-mobile-rows">
      {rows.map(
        (row) => (
          <button
            type="button"
            className="abide-db-mobile-row"
            key={
              row.id
            }
            onClick={() =>
              openRow(
                row.id
              )
            }
          >
            <strong>
              {collectionTitle(
                collection,
                row
              )}
            </strong>

            <div className="abide-db-mobile-row-properties">
              {visible.map(
                (
                  property
                ) => {
                  const value =
                    readPropertyValue(
                      row,
                      property,
                      collection,
                      collections
                    );

                  if (
                    value ===
                      null ||
                    value ===
                      undefined ||
                    value ===
                      "" ||
                    (
                      Array.isArray(
                        value
                      ) &&
                      !value.length
                    )
                  ) {
                    return null;
                  }

                  return (
                    <span
                      key={
                        property.id
                      }
                    >
                      <small>
                        {
                          property.name
                        }
                      </small>

                      {
                        displayValue(
                          value
                        )
                      }
                    </span>
                  );
                }
              )}
            </div>
          </button>
        )
      )}
    </div>
  );
}



/* =========================================================
   VIEW SETTINGS
========================================================= */

function ViewSettingsPanel({
  collection,
  view,
  updateView,
  deleteView,
}) {
  const dateProperties =
    collection.properties.filter(
      (property) =>
        property.type ===
        "date"
    );

  const groupProperties =
    collection.properties.filter(
      (property) =>
        [
          "status",
          "select",
          "multi_select",
        ].includes(
          property.type
        )
    );

  const numberProperties =
    collection.properties.filter(
      (property) =>
        property.type ===
        "number"
    );


  return (
    <div className="abide-db-panel abide-db-view-settings">
      <div className="abide-db-panel-head">
        <strong>
          View settings
        </strong>

        <span>
          Saved only to this view
        </span>
      </div>


      <div className="abide-db-view-setting-grid">
        <label>
          <span>
            View name
          </span>

          <input
            value={
              view.name ||
              ""
            }
            onChange={(event) =>
              updateView({
                ...view,

                name:
                  event.target
                    .value,
              })
            }
          />
        </label>


        <label>
          <span>
            Layout
          </span>

          <select
            value={
              view.type
            }
            onChange={(event) =>
              updateView({
                ...view,

                type:
                  event.target
                    .value,
              })
            }
          >
            {VIEW_TYPES.map(
              (candidate) => (
                <option
                  key={
                    candidate.id
                  }
                  value={
                    candidate.id
                  }
                >
                  {
                    candidate.label
                  }
                </option>
              )
            )}
          </select>
        </label>


        {view.type ===
          "board" && (
          <label>
            <span>
              Group by
            </span>

            <select
              value={
                view.groupBy ||
                ""
              }
              onChange={(event) =>
                updateView({
                  ...view,

                  groupBy:
                    event.target
                      .value,
                })
              }
            >
              <option value="">
                Choose property
              </option>

              {groupProperties.map(
                (property) => (
                  <option
                    key={
                      property.id
                    }
                    value={
                      property.id
                    }
                  >
                    {
                      property.name
                    }
                  </option>
                )
              )}
            </select>
          </label>
        )}


        {view.type ===
          "calendar" && (
          <label>
            <span>
              Calendar by
            </span>

            <select
              value={
                view.calendarBy ||
                ""
              }
              onChange={(event) =>
                updateView({
                  ...view,

                  calendarBy:
                    event.target
                      .value,
                })
              }
            >
              <option value="">
                Choose date
              </option>

              {dateProperties.map(
                (property) => (
                  <option
                    value={
                      property.id
                    }
                    key={
                      property.id
                    }
                  >
                    {
                      property.name
                    }
                  </option>
                )
              )}
            </select>
          </label>
        )}


        {view.type ===
          "timeline" && (
          <>
            <label>
              <span>
                Start date
              </span>

              <select
                value={
                  view.timelineStart ||
                  ""
                }
                onChange={(event) =>
                  updateView({
                    ...view,

                    timelineStart:
                      event.target
                        .value,
                  })
                }
              >
                <option value="">
                  Choose date
                </option>

                {dateProperties.map(
                  (property) => (
                    <option
                      key={
                        property.id
                      }
                      value={
                        property.id
                      }
                    >
                      {
                        property.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>


            <label>
              <span>
                End date
              </span>

              <select
                value={
                  view.timelineEnd ||
                  ""
                }
                onChange={(event) =>
                  updateView({
                    ...view,

                    timelineEnd:
                      event.target
                        .value,
                  })
                }
              >
                <option value="">
                  Same as start
                </option>

                {dateProperties.map(
                  (property) => (
                    <option
                      key={
                        property.id
                      }
                      value={
                        property.id
                      }
                    >
                      {
                        property.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          </>
        )}


        {view.type ===
          "chart" && (
          <>
            <label>
              <span>
                Group by
              </span>

              <select
                value={
                  view.chartGroupBy ||
                  ""
                }
                onChange={(event) =>
                  updateView({
                    ...view,

                    chartGroupBy:
                      event.target
                        .value,
                  })
                }
              >
                <option value="">
                  No grouping
                </option>

                {collection.properties.map(
                  (property) => (
                    <option
                      key={
                        property.id
                      }
                      value={
                        property.id
                      }
                    >
                      {
                        property.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>


            <label>
              <span>
                Calculate
              </span>

              <select
                value={
                  view.chartAggregate ||
                  "count"
                }
                onChange={(event) =>
                  updateView({
                    ...view,

                    chartAggregate:
                      event.target
                        .value,
                  })
                }
              >
                <option value="count">
                  Count
                </option>

                <option value="sum">
                  Sum
                </option>

                <option value="average">
                  Average
                </option>

                <option value="min">
                  Minimum
                </option>

                <option value="max">
                  Maximum
                </option>
              </select>
            </label>


            {view.chartAggregate !==
              "count" && (
              <label>
                <span>
                  Number property
                </span>

                <select
                  value={
                    view.chartValue ||
                    ""
                  }
                  onChange={(event) =>
                    updateView({
                      ...view,

                      chartValue:
                        event.target
                          .value,
                    })
                  }
                >
                  <option value="">
                    Choose number
                  </option>

                  {numberProperties.map(
                    (property) => (
                      <option
                        key={
                          property.id
                        }
                        value={
                          property.id
                        }
                      >
                        {
                          property.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
            )}
          </>
        )}
      </div>


      <label className="abide-db-check-row">
        <input
          type="checkbox"
          checked={
            Boolean(
              view.wrapCells
            )
          }
          onChange={(event) =>
            updateView({
              ...view,

              wrapCells:
                event.target
                  .checked,
            })
          }
        />

        <span>
          Wrap cell content
        </span>
      </label>


      <button
        type="button"
        className="abide-db-delete-property"
        onClick={
          deleteView
        }
      >
        Delete this view
      </button>
    </div>
  );
}


/* =========================================================
   LIST VIEW
========================================================= */

function ListViewV2({
  collection,
  collections,
  rows,
  view,
  openRow,
}) {
  const title =
    titleProperty(
      collection
    );

  const visible =
    (
      view.visibleProperties ||
      []
    )
      .map(
        (id) =>
          propertyById(
            collection,
            id
          )
      )
      .filter(
        (property) =>
          property &&
          property.id !==
            title?.id
      );


  return (
    <div className="abide-db-list-v2">
      {rows.map(
        (row) => (
          <button
            type="button"
            className="abide-db-list-v2-row"
            key={
              row.id
            }
            onClick={() =>
              openRow(
                row.id
              )
            }
          >
            <strong>
              {collectionTitle(
                collection,
                row
              )}
            </strong>

            <div className="abide-db-list-v2-props">
              {visible.map(
                (property) => {
                  const value =
                    readPropertyValue(
                      row,
                      property,
                      collection,
                      collections
                    );

                  if (
                    value ===
                      "" ||
                    value ===
                      null ||
                    value ===
                      undefined ||
                    (
                      Array.isArray(
                        value
                      ) &&
                      !value.length
                    )
                  ) {
                    return null;
                  }

                  return (
                    <span
                      key={
                        property.id
                      }
                    >
                      {
                        displayValue(
                          value
                        )
                      }
                    </span>
                  );
                }
              )}
            </div>

            <span className="abide-db-list-arrow">
              ›
            </span>
          </button>
        )
      )}
    </div>
  );
}


/* =========================================================
   GALLERY VIEW
========================================================= */

function GalleryViewV2({
  collection,
  collections,
  rows,
  view,
  openRow,
}) {
  const title =
    titleProperty(
      collection
    );

  const visible =
    (
      view.visibleProperties ||
      []
    )
      .map(
        (id) =>
          propertyById(
            collection,
            id
          )
      )
      .filter(
        (property) =>
          property &&
          property.id !==
            title?.id
      )
      .slice(
        0,
        5
      );


  return (
    <div className="abide-db-gallery-v2">
      {rows.map(
        (row) => (
          <button
            type="button"
            className="abide-db-gallery-card"
            key={
              row.id
            }
            onClick={() =>
              openRow(
                row.id
              )
            }
          >
            <div className="abide-db-gallery-cover">
              <span>
                {collectionTitle(
                  collection,
                  row
                )
                  .slice(
                    0,
                    1
                  )
                  .toUpperCase()}
              </span>
            </div>

            <div className="abide-db-gallery-body">
              <strong>
                {collectionTitle(
                  collection,
                  row
                )}
              </strong>

              {visible.map(
                (property) => {
                  const value =
                    readPropertyValue(
                      row,
                      property,
                      collection,
                      collections
                    );

                  if (
                    value ===
                      "" ||
                    value ===
                      null ||
                    value ===
                      undefined ||
                    (
                      Array.isArray(
                        value
                      ) &&
                      !value.length
                    )
                  ) {
                    return null;
                  }

                  return (
                    <div
                      className="abide-db-gallery-property"
                      key={
                        property.id
                      }
                    >
                      <span>
                        {
                          property.name
                        }
                      </span>

                      <b>
                        {
                          displayValue(
                            value
                          )
                        }
                      </b>
                    </div>
                  );
                }
              )}
            </div>
          </button>
        )
      )}
    </div>
  );
}


/* =========================================================
   BOARD VIEW
========================================================= */

function boardGroupsFor(
  property
) {
  if (!property) {
    return [
      "No group",
    ];
  }

  const options =
    property.options?.map(
      (option) =>
        option.name
    ) || [];

  return [
    ...options,
    "No group",
  ];
}


function rowInBoardGroup(
  row,
  property,
  group
) {
  if (!property) {
    return (
      group ===
      "No group"
    );
  }

  const value =
    row.values?.[
      property.id
    ];

  if (
    group ===
    "No group"
  ) {
    return (
      value === "" ||
      value === null ||
      value ===
        undefined ||
      (
        Array.isArray(value) &&
        !value.length
      )
    );
  }

  if (
    Array.isArray(value)
  ) {
    return value.includes(
      group
    );
  }

  return (
    value === group
  );
}


function BoardViewV2({
  collection,
  collections,
  rows,
  view,
  updateRow,
  openRow,
}) {
  const property =
    propertyById(
      collection,
      view.groupBy
    ) ||
    collection.properties.find(
      (candidate) =>
        [
          "status",
          "select",
          "multi_select",
        ].includes(
          candidate.type
        )
    );

  const groups =
    boardGroupsFor(
      property
    );


  const moveRow =
    (
      row,
      group
    ) => {
      if (!property) {
        return;
      }

      let value =
        group ===
        "No group"
          ? property.type ===
            "multi_select"
            ? []
            : ""
          : property.type ===
            "multi_select"
            ? [
                group,
              ]
            : group;

      updateRow({
        ...row,

        values: {
          ...row.values,

          [property.id]:
            value,
        },
      });
    };


  return (
    <div className="abide-db-board-v2">
      {groups.map(
        (group) => {
          const groupRows =
            rows.filter(
              (row) =>
                rowInBoardGroup(
                  row,
                  property,
                  group
                )
            );

          return (
            <section
              className="abide-db-board-column"
              key={
                group
              }
              onDragOver={(event) =>
                event.preventDefault()
              }
              onDrop={(event) => {
                event.preventDefault();

                const rowId =
                  event.dataTransfer.getData(
                    "text/abide-row"
                  );

                const row =
                  rows.find(
                    (candidate) =>
                      candidate.id ===
                      rowId
                  );

                if (row) {
                  moveRow(
                    row,
                    group
                  );
                }
              }}
            >
              <header>
                <strong>
                  {
                    group
                  }
                </strong>

                <span>
                  {
                    groupRows.length
                  }
                </span>
              </header>

              <div className="abide-db-board-column-body">
                {groupRows.map(
                  (row) => (
                    <article
                      className="abide-db-board-card"
                      key={
                        row.id
                      }
                      draggable
                      onDragStart={(
                        event
                      ) => {
                        event.dataTransfer.setData(
                          "text/abide-row",
                          row.id
                        );
                      }}
                    >
                      <button
                        type="button"
                        className="abide-db-board-open"
                        onClick={() =>
                          openRow(
                            row.id
                          )
                        }
                      >
                        <strong>
                          {collectionTitle(
                            collection,
                            row
                          )}
                        </strong>
                      </button>

                      {property && (
                        <select
                          className="abide-db-board-mobile-move"
                          value={
                            rowInBoardGroup(
                              row,
                              property,
                              "No group"
                            )
                              ? "No group"
                              : Array.isArray(
                                  row.values?.[
                                    property.id
                                  ]
                                )
                                ? row.values[
                                    property.id
                                  ][0] ||
                                  "No group"
                                : row.values?.[
                                    property.id
                                  ] ||
                                  "No group"
                          }
                          onChange={(event) =>
                            moveRow(
                              row,
                              event.target
                                .value
                            )
                          }
                        >
                          {groups.map(
                            (
                              target
                            ) => (
                              <option
                                value={
                                  target
                                }
                                key={
                                  target
                                }
                              >
                                {
                                  target
                                }
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </article>
                  )
                )}
              </div>
            </section>
          );
        }
      )}
    </div>
  );
}


/* =========================================================
   CALENDAR VIEW
========================================================= */

function dateKey(
  date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}-${day}`
  );
}


function CalendarViewV2({
  collection,
  rows,
  view,
  openRow,
  updateRow,
}) {
  const [
    cursor,
    setCursor,
  ] =
    useState(
      () =>
        new Date()
    );

  const property =
    propertyById(
      collection,
      view.calendarBy
    ) ||
    collection.properties.find(
      (candidate) =>
        candidate.type ===
        "date"
    );


  if (!property) {
    return (
      <div className="abide-db-empty">
        Add a Date property to use Calendar view.
      </div>
    );
  }


  const year =
    cursor.getFullYear();

  const month =
    cursor.getMonth();

  const first =
    new Date(
      year,
      month,
      1
    );

  const start =
    new Date(
      year,
      month,
      1 -
        first.getDay()
    );

  const days =
    Array.from(
      {
        length:
          42,
      },
      (
        _,
        index
      ) => {
        const day =
          new Date(
            start
          );

        day.setDate(
          start.getDate() +
            index
        );

        return day;
      }
    );


  return (
    <div className="abide-db-calendar-v2">
      <header className="abide-db-calendar-head">
        <button
          type="button"
          onClick={() =>
            setCursor(
              new Date(
                year,
                month - 1,
                1
              )
            )
          }
        >
          ‹
        </button>

        <strong>
          {cursor.toLocaleDateString(
            undefined,
            {
              month:
                "long",

              year:
                "numeric",
            }
          )}
        </strong>

        <button
          type="button"
          onClick={() =>
            setCursor(
              new Date(
                year,
                month + 1,
                1
              )
            )
          }
        >
          ›
        </button>
      </header>


      <div className="abide-db-calendar-weekdays">
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map(
          (day) => (
            <span
              key={
                day
              }
            >
              {day}
            </span>
          )
        )}
      </div>


      <div className="abide-db-calendar-grid">
        {days.map(
          (day) => {
            const key =
              dateKey(
                day
              );

            const dayRows =
              rows.filter(
                (row) =>
                  String(
                    row.values?.[
                      property.id
                    ] ||
                    ""
                  ).slice(
                    0,
                    10
                  ) ===
                  key
              );

            return (
              <div
                className={cx(
                  "abide-db-calendar-day",
                  day.getMonth() !==
                    month &&
                    "outside"
                )}
                key={
                  key
                }
              >
                <span className="abide-db-calendar-number">
                  {
                    day.getDate()
                  }
                </span>

                {dayRows.map(
                  (row) => (
                    <button
                      type="button"
                      key={
                        row.id
                      }
                      onClick={() =>
                        openRow(
                          row.id
                        )
                      }
                    >
                      {collectionTitle(
                        collection,
                        row
                      )}
                    </button>
                  )
                )}

                {dayRows.length >
                  3 && (
                  <small>
                    +
                    {
                      dayRows.length -
                      3
                    }{" "}
                    more
                  </small>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}


/* =========================================================
   TIMELINE VIEW
========================================================= */

function TimelineViewV2({
  collection,
  rows,
  view,
  openRow,
}) {
  const startProperty =
    propertyById(
      collection,
      view.timelineStart
    ) ||
    collection.properties.find(
      (candidate) =>
        candidate.type ===
        "date"
    );

  const endProperty =
    propertyById(
      collection,
      view.timelineEnd
    );


  if (!startProperty) {
    return (
      <div className="abide-db-empty">
        Add a Date property to use Timeline view.
      </div>
    );
  }


  const dated =
    rows
      .map(
        (row) => {
          const rawStart =
            row.values?.[
              startProperty.id
            ];

          if (!rawStart) {
            return null;
          }

          const start =
            new Date(
              rawStart
            );

          const rawEnd =
            endProperty
              ? row.values?.[
                  endProperty.id
                ]
              : rawStart;

          const end =
            new Date(
              rawEnd ||
              rawStart
            );

          return {
            row,
            start,
            end,
          };
        }
      )
      .filter(Boolean);


  if (!dated.length) {
    return (
      <div className="abide-db-empty">
        No dated pages in this timeline.
      </div>
    );
  }


  const minimum =
    new Date(
      Math.min(
        ...dated.map(
          (item) =>
            item.start.getTime()
        )
      )
    );

  minimum.setHours(
    0,
    0,
    0,
    0
  );


  const maximum =
    new Date(
      Math.max(
        ...dated.map(
          (item) =>
            item.end.getTime()
        )
      )
    );

  maximum.setHours(
    0,
    0,
    0,
    0
  );


  const dayMs =
    86400000;

  const span =
    Math.max(
      7,
      Math.ceil(
        (
          maximum -
          minimum
        ) /
          dayMs
      ) + 1
    );

  const columnWidth =
    46;


  return (
    <div className="abide-db-timeline-v2">
      <div
        className="abide-db-timeline-canvas"
        style={{
          width:
            Math.max(
              620,
              span *
                columnWidth +
                220
            ),
        }}
      >
        {dated.map(
          (item) => {
            const offset =
              Math.floor(
                (
                  item.start -
                  minimum
                ) /
                  dayMs
              );

            const duration =
              Math.max(
                1,
                Math.floor(
                  (
                    item.end -
                    item.start
                  ) /
                    dayMs
                ) + 1
              );

            return (
              <div
                className="abide-db-timeline-row"
                key={
                  item.row.id
                }
              >
                <button
                  type="button"
                  className="abide-db-timeline-label"
                  onClick={() =>
                    openRow(
                      item.row.id
                    )
                  }
                >
                  {collectionTitle(
                    collection,
                    item.row
                  )}
                </button>

                <button
                  type="button"
                  className="abide-db-timeline-bar"
                  style={{
                    left:
                      220 +
                      offset *
                        columnWidth,

                    width:
                      Math.max(
                        40,
                        duration *
                          columnWidth -
                          6
                      ),
                  }}
                  onClick={() =>
                    openRow(
                      item.row.id
                    )
                  }
                >
                  {item.start.toLocaleDateString(
                    undefined,
                    {
                      month:
                        "short",

                      day:
                        "numeric",
                    }
                  )}
                </button>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}


/* =========================================================
   CHART VIEW
========================================================= */

function ChartViewV2({
  collection,
  collections,
  rows,
  view,
}) {
  const groupProperty =
    propertyById(
      collection,
      view.chartGroupBy
    );

  const valueProperty =
    propertyById(
      collection,
      view.chartValue
    );


  const groups =
    new Map();


  rows.forEach(
    (row) => {
      let group =
        groupProperty
          ? readPropertyValue(
              row,
              groupProperty,
              collection,
              collections
            )
          : "All";

      if (
        Array.isArray(group)
      ) {
        group =
          group.length
            ? group
            : [
                "No value",
              ];
      } else {
        group = [
          group ||
            "No value",
        ];
      }


      group.forEach(
        (name) => {
          if (
            !groups.has(
              String(name)
            )
          ) {
            groups.set(
              String(name),
              []
            );
          }

          groups
            .get(
              String(name)
            )
            .push(
              row
            );
        }
      );
    }
  );


  const data =
    [...groups.entries()]
      .map(
        ([
          name,
          groupRows,
        ]) => {
          let value =
            groupRows.length;

          if (
            view.chartAggregate !==
              "count" &&
            valueProperty
          ) {
            const numbers =
              groupRows
                .map(
                  (row) =>
                    Number(
                      readPropertyValue(
                        row,
                        valueProperty,
                        collection,
                        collections
                      )
                    )
                )
                .filter(
                  Number.isFinite
                );

            switch (
              view.chartAggregate
            ) {
              case "sum":
                value =
                  numbers.reduce(
                    (
                      total,
                      number
                    ) =>
                      total +
                      number,
                    0
                  );
                break;

              case "average":
                value =
                  numbers.length
                    ? numbers.reduce(
                        (
                          total,
                          number
                        ) =>
                          total +
                          number,
                        0
                      ) /
                      numbers.length
                    : 0;
                break;

              case "min":
                value =
                  numbers.length
                    ? Math.min(
                        ...numbers
                      )
                    : 0;
                break;

              case "max":
                value =
                  numbers.length
                    ? Math.max(
                        ...numbers
                      )
                    : 0;
                break;

              default:
                break;
            }
          }

          return {
            name,
            value,
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.value -
          a.value
      );


  const maximum =
    Math.max(
      1,
      ...data.map(
        (item) =>
          Number(
            item.value ||
            0
          )
      )
    );


  return (
    <div className="abide-db-chart-v2">
      {data.map(
        (item) => (
          <div
            className="abide-db-chart-v2-row"
            key={
              item.name
            }
          >
            <span>
              {
                item.name
              }
            </span>

            <div className="abide-db-chart-v2-track">
              <div
                className="abide-db-chart-v2-bar"
                style={{
                  width:
                    `${
                      (
                        Number(
                          item.value ||
                          0
                        ) /
                        maximum
                      ) *
                      100
                    }%`,
                }}
              />
            </div>

            <strong>
              {
                Number.isInteger(
                  item.value
                )
                  ? item.value
                  : item.value.toFixed(
                      1
                    )
              }
            </strong>
          </div>
        )
      )}

      {!data.length && (
        <div className="abide-db-empty">
          No data to chart.
        </div>
      )}
    </div>
  );
}


/* =========================================================
   SPECIALIZED VIEW ROUTER
========================================================= */

function SpecializedViewV2({
  collection,
  collections,
  rows,
  view,
  updateRow,
  openRow,
}) {
  switch (
    view.type
  ) {
    case "board":
      return (
        <BoardViewV2
          collection={
            collection
          }
          collections={
            collections
          }
          rows={
            rows
          }
          view={
            view
          }
          updateRow={
            updateRow
          }
          openRow={
            openRow
          }
        />
      );

    case "gallery":
      return (
        <GalleryViewV2
          collection={
            collection
          }
          collections={
            collections
          }
          rows={
            rows
          }
          view={
            view
          }
          openRow={
            openRow
          }
        />
      );

    case "list":
      return (
        <ListViewV2
          collection={
            collection
          }
          collections={
            collections
          }
          rows={
            rows
          }
          view={
            view
          }
          openRow={
            openRow
          }
        />
      );

    case "calendar":
      return (
        <CalendarViewV2
          collection={
            collection
          }
          rows={
            rows
          }
          view={
            view
          }
          updateRow={
            updateRow
          }
          openRow={
            openRow
          }
        />
      );

    case "timeline":
      return (
        <TimelineViewV2
          collection={
            collection
          }
          rows={
            rows
          }
          view={
            view
          }
          openRow={
            openRow
          }
        />
      );

    case "chart":
      return (
        <ChartViewV2
          collection={
            collection
          }
          collections={
            collections
          }
          rows={
            rows
          }
          view={
            view
          }
        />
      );

    default:
      return null;
  }
}



/* =========================================================
   DATABASE BLOCK
========================================================= */

export default function DatabaseBlock({
  block,
  onChange,
  onEnter,
  onRemove,
}) {
  const [
    collection,
    setCollection,
  ] =
    useState(() => {
      const original =
        getCollection(
          block.collectionId
        );

      return original
        ? normalizeDatabase(
            original,
            block.view ||
              "table"
          )
        : null;
    });


  const [
    activeViewId,
    setActiveViewId,
  ] =
    useState("");


  const [
    panel,
    setPanel,
  ] =
    useState(null);


  const [
    openRowId,
    setOpenRowId,
  ] =
    useState(null);


  const [
    query,
    setQuery,
  ] =
    useState("");


  const collections =
    useMemo(
      () =>
        getCollections()
          .map(
            (
              candidate
            ) =>
              normalizeDatabase(
                candidate
              )
          )
          .filter(
            Boolean
          ),
      [
        collection,
      ]
    );


  useEffect(
    () => {
      const original =
        getCollection(
          block.collectionId
        );

      if (!original) {
        return;
      }

      const normalized =
        normalizeDatabase(
          original,
          block.view ||
            "table"
        );

      setCollection(
        normalized
      );

      if (
        JSON.stringify(
          original
        ) !==
        JSON.stringify(
          normalized
        )
      ) {
        updateCollection(
          original.id,
          () =>
            normalized
        );
      }
    },
    [
      block.collectionId,
      block.view,
    ]
  );


  useEffect(
    () => {
      const refresh =
        (event) => {
          if (
            event?.detail?.key &&
            event.detail.key !==
              COLLECTIONS_KEY
          ) {
            return;
          }

          const fresh =
            getCollection(
              block.collectionId
            );

          if (fresh) {
            setCollection(
              normalizeDatabase(
                fresh,
                block.view ||
                  "table"
              )
            );
          }
        };

      window.addEventListener(
        "abide-local-data-changed",
        refresh
      );

      return () =>
        window.removeEventListener(
          "abide-local-data-changed",
          refresh
        );
    },
    [
      block.collectionId,
      block.view,
    ]
  );


  useEffect(
    () => {
      if (
        !collection
      ) {
        return;
      }

      const preferred =
        collection.views.find(
          (view) =>
            view.id ===
            activeViewId
        ) ||
        collection.views.find(
          (view) =>
            view.type ===
            block.view
        ) ||
        collection.views[0];

      if (
        preferred &&
        preferred.id !==
        activeViewId
      ) {
        setActiveViewId(
          preferred.id
        );
      }
    },
    [
      collection,
      block.view,
      activeViewId,
    ]
  );


  if (!collection) {
    return (
      <div className="abide-db-block">
        <DatabaseActions
          block={
            block
          }
          onEnter={
            onEnter
          }
          onRemove={
            onRemove
          }
        />

        <div className="abide-db-empty">
          This database could not be found.
        </div>
      </div>
    );
  }


  const saveCollection =
    (next) => {
      const normalized =
        normalizeDatabase(
          next
        );

      updateCollection(
        collection.id,
        () =>
          normalized
      );

      setCollection(
        normalized
      );
    };


  const view =
    collection.views.find(
      (candidate) =>
        candidate.id ===
        activeViewId
    ) ||
    collection.views[0];


  const updateView =
    (nextView) => {
      saveCollection({
        ...collection,

        views:
          collection.views.map(
            (
              candidate
            ) =>
              candidate.id ===
              view.id
                ? nextView
                : candidate
          ),
      });
    };


  const syncTwoWayRelations =
    (
      previousRow,
      nextRow
    ) => {
      let nextProperties =
        [
          ...collection.properties,
        ];


      collection.properties
        .filter(
          (property) =>
            property.type ===
              "relation" &&
            property.twoWay &&
            property
              .targetCollectionId
        )
        .forEach(
          (
            property
          ) => {
            const targetRaw =
              getCollection(
                property
                  .targetCollectionId
              );

            if (!targetRaw) {
              return;
            }


            let target =
              normalizeDatabase(
                targetRaw
              );


            let reciprocal =
              property.backPropertyId
                ? propertyById(
                    target,
                    property
                      .backPropertyId
                  )
                : null;


            if (!reciprocal) {
              reciprocal =
                target.properties.find(
                  (
                    candidate
                  ) =>
                    candidate.type ===
                      "relation" &&
                    candidate
                      .targetCollectionId ===
                      collection.id &&
                    candidate
                      .backPropertyId ===
                      property.id
                );
            }


            if (!reciprocal) {
              reciprocal =
                makeProperty(
                  "relation",
                  collection.name
                );

              reciprocal.targetCollectionId =
                collection.id;

              reciprocal.twoWay =
                true;

              reciprocal.backPropertyId =
                property.id;

              target = {
                ...target,

                properties: [
                  ...target.properties,
                  reciprocal,
                ],

                views:
                  target.views.map(
                    (
                      targetView
                    ) => ({
                      ...targetView,

                      visibleProperties: [
                        ...(targetView.visibleProperties ||
                          []),

                        reciprocal.id,
                      ],
                    })
                  ),
              };
            }


            if (
              property.backPropertyId !==
              reciprocal.id
            ) {
              nextProperties =
                nextProperties.map(
                  (
                    candidate
                  ) =>
                    candidate.id ===
                    property.id
                      ? {
                          ...candidate,

                          backPropertyId:
                            reciprocal.id,
                        }
                      : candidate
                );
            }


            const before =
              Array.isArray(
                previousRow?.values?.[
                  property.id
                ]
              )
                ? previousRow.values[
                    property.id
                  ]
                : [];


            const after =
              Array.isArray(
                nextRow?.values?.[
                  property.id
                ]
              )
                ? nextRow.values[
                    property.id
                  ]
                : [];


            const affected =
              new Set([
                ...before,
                ...after,
              ]);


            target = {
              ...target,

              rows:
                target.rows.map(
                  (
                    targetRow
                  ) => {
                    if (
                      !affected.has(
                        targetRow.id
                      )
                    ) {
                      return targetRow;
                    }


                    const current =
                      Array.isArray(
                        targetRow
                          .values?.[
                          reciprocal.id
                        ]
                      )
                        ? targetRow.values[
                            reciprocal.id
                          ]
                        : [];


                    const shouldContain =
                      after.includes(
                        targetRow.id
                      );


                    const nextLinks =
                      shouldContain
                        ? current.includes(
                            nextRow.id
                          )
                          ? current
                          : [
                              ...current,
                              nextRow.id,
                            ]
                        : current.filter(
                            (id) =>
                              id !==
                              nextRow.id
                          );


                    return {
                      ...targetRow,

                      values: {
                        ...targetRow.values,

                        [reciprocal.id]:
                          nextLinks,
                      },

                      updatedAt:
                        new Date()
                          .toISOString(),
                    };
                  }
                ),
            };


            updateCollection(
              target.id,
              () =>
                target
            );
          }
        );


      return nextProperties;
    };


  const updateRow =
    (nextRow) => {
      const previousRow =
        collection.rows.find(
          (row) =>
            row.id ===
            nextRow.id
        );

      const syncedProperties =
        syncTwoWayRelations(
          previousRow,
          nextRow
        );

      saveCollection({
        ...collection,

        properties:
          syncedProperties,

        rows:
          collection.rows.map(
            (row) =>
              row.id ===
              nextRow.id
                ? {
                    ...nextRow,

                    updatedAt:
                      new Date()
                        .toISOString(),

                    lastEditedBy:
                      "You",
                  }
                : row
          ),
      });
    };


  const deleteRow =
    (rowId) => {
      saveCollection({
        ...collection,

        rows:
          collection.rows.filter(
            (row) =>
              row.id !==
              rowId
          ),
      });
    };


  const addRow =
    () => {
      const row =
        makeRow(
          collection
        );

      saveCollection({
        ...collection,

        rows: [
          ...collection.rows,
          row,
        ],
      });

      setOpenRowId(
        row.id
      );
    };


  let rows =
    applyViewQuery(
      collection.rows ||
        [],
      collection,
      view,
      collections
    );


  if (
    query.trim()
  ) {
    const needle =
      query
        .trim()
        .toLowerCase();

    rows =
      rows.filter(
        (row) =>
          collection.properties.some(
            (
              property
            ) => {
              const value =
                readPropertyValue(
                  row,
                  property,
                  collection,
                  collections
                );

              return displayValue(
                value
              )
                .toLowerCase()
                .includes(
                  needle
                );
            }
          )
      );
  }


  const openedRow =
    collection.rows.find(
      (row) =>
        row.id ===
        openRowId
    );


  const addView =
    (type) => {
      const next =
        makeView(
          type
        );

      next.visibleProperties =
        collection.properties.map(
          (
            property
          ) =>
            property.id
        );

      const dateProperty =
        collection.properties.find(
          (
            property
          ) =>
            property.type ===
            "date"
        );

      if (
        dateProperty
      ) {
        next.calendarBy =
          dateProperty.id;

        next.timelineStart =
          dateProperty.id;
      }

      const status =
        collection.properties.find(
          (
            property
          ) =>
            [
              "status",
              "select",
              "multi_select",
            ].includes(
              property.type
            )
        );

      if (status) {
        next.groupBy =
          status.id;

        next.chartGroupBy =
          status.id;
      }

      saveCollection({
        ...collection,

        views: [
          ...collection.views,
          next,
        ],
      });

      setActiveViewId(
        next.id
      );
    };


  return (
    <>
      <div
        className="abide-block abide-db-block abide-db-v2"
        data-block-id={
          block.id
        }
      >
        <DatabaseActions
          block={
            block
          }
          onEnter={
            onEnter
          }
          onRemove={
            onRemove
          }
        />


        <div className="abide-db-v2-head">
          <input
            className="abide-db-name"
            value={
              collection.name
            }
            onChange={(event) =>
              saveCollection({
                ...collection,

                name:
                  event.target
                    .value,
              })
            }
          />

          {block.linked && (
            <span className="abide-db-linked-label">
              Linked
            </span>
          )}
        </div>


        <div className="abide-db-viewbar">
          <div className="abide-db-viewtabs">
            {collection.views.map(
              (
                candidate
              ) => (
                <button
                  type="button"
                  key={
                    candidate.id
                  }
                  className={cx(
                    "abide-db-viewtab",
                    candidate.id ===
                      view.id &&
                      "active"
                  )}
                  onClick={() => {
                    setActiveViewId(
                      candidate.id
                    );

                    onChange?.({
                      ...block,

                      view:
                        candidate.type,

                      updatedAt:
                        Date.now(),
                    });
                  }}
                >
                  {
                    candidate.name
                  }
                </button>
              )
            )}

            <select
              className="abide-db-add-view"
              value=""
              onChange={(event) => {
                if (
                  event.target
                    .value
                ) {
                  addView(
                    event.target
                      .value
                  );
                }
              }}
            >
              <option value="">
                + View
              </option>

              {VIEW_TYPES.map(
                (
                  candidate
                ) => (
                  <option
                    key={
                      candidate.id
                    }
                    value={
                      candidate.id
                    }
                  >
                    {
                      candidate.label
                    }
                  </option>
                )
              )}
            </select>
          </div>


          <div className="abide-db-toolbar">
            <input
              className="abide-db-search"
              placeholder="Search"
              value={
                query
              }
              onChange={(event) =>
                setQuery(
                  event.target
                    .value
                )
              }
            />

            <button
              type="button"
              className={
                view.filters
                  ?.length
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPanel(
                  panel ===
                    "filter"
                    ? null
                    : "filter"
                )
              }
            >
              Filter
              {view.filters
                ?.length
                ? ` ${view.filters.length}`
                : ""}
            </button>

            <button
              type="button"
              className={
                view.sorts
                  ?.length
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPanel(
                  panel ===
                    "sort"
                    ? null
                    : "sort"
                )
              }
            >
              Sort
              {view.sorts
                ?.length
                ? ` ${view.sorts.length}`
                : ""}
            </button>

            <button
              type="button"
              onClick={() =>
                setPanel(
                  panel ===
                    "visibility"
                    ? null
                    : "visibility"
                )
              }
            >
              Properties
            </button>

            <button
              type="button"
              onClick={() =>
                setPanel(
                  panel ===
                    "view"
                    ? null
                    : "view"
                )
              }
            >
              View
            </button>

            <button
              type="button"
              onClick={() =>
                setPanel(
                  panel ===
                    "schema"
                    ? null
                    : "schema"
                )
              }
            >
              Schema
            </button>
          </div>
        </div>


        {panel ===
          "filter" && (
          <FiltersPanel
            collection={
              collection
            }
            view={
              view
            }
            updateView={
              updateView
            }
          />
        )}


        {panel ===
          "sort" && (
          <SortPanel
            collection={
              collection
            }
            view={
              view
            }
            updateView={
              updateView
            }
          />
        )}


        {panel ===
          "visibility" && (
          <VisibilityPanel
            collection={
              collection
            }
            view={
              view
            }
            updateView={
              updateView
            }
          />
        )}


        {panel ===
          "view" && (
          <ViewSettingsPanel
            collection={
              collection
            }
            view={
              view
            }
            updateView={
              updateView
            }
            deleteView={() => {
              if (
                collection.views.length <=
                1
              ) {
                window.alert(
                  "A database needs at least one view."
                );

                return;
              }

              const nextViews =
                collection.views.filter(
                  (candidate) =>
                    candidate.id !==
                    view.id
                );

              saveCollection({
                ...collection,

                views:
                  nextViews,
              });

              setActiveViewId(
                nextViews[0]
                  .id
              );

              setPanel(
                null
              );
            }}
          />
        )}


        {panel ===
          "schema" && (
          <SchemaPanel
            collection={
              collection
            }
            collections={
              collections
            }
            saveCollection={
              saveCollection
            }
          />
        )}


        {view.type !==
          "table" && (
          <SpecializedViewV2
            collection={
              collection
            }
            collections={
              collections
            }
            rows={
              rows
            }
            view={
              view
            }
            updateRow={
              updateRow
            }
            openRow={
              setOpenRowId
            }
          />
        )}


        {view.type ===
          "table" && (
          <>
            <div className="abide-db-desktop-view">
              <TableView
                collection={
                  collection
                }
                collections={
                  collections
                }
                rows={
                  rows
                }
                view={
                  view
                }
                updateRow={
                  updateRow
                }
                openRow={
                  setOpenRowId
                }
              />
            </div>

            <div className="abide-db-mobile-view">
              <MobileRows
                collection={
                  collection
                }
                collections={
                  collections
                }
                rows={
                  rows
                }
                view={
                  view
                }
                openRow={
                  setOpenRowId
                }
              />
            </div>
          </>
        )}


        {!rows.length && (
          <div className="abide-db-empty">
            No pages in this view.
          </div>
        )}


        <button
          type="button"
          className="abide-db-new-row abide-db-v2-new"
          onClick={
            addRow
          }
        >
          + New
        </button>
      </div>


      {openedRow && (
        <RowPage
          row={
            openedRow
          }
          collection={
            collection
          }
          collections={
            collections
          }
          updateRow={
            updateRow
          }
          deleteRow={
            deleteRow
          }
          close={() =>
            setOpenRowId(
              null
            )
          }
        />
      )}
    </>
  );
}
