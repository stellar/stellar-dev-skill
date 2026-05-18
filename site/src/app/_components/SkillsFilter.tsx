"use client";

import { KeyboardEvent, ReactNode, useId, useRef, useState } from "react";

type Props = {
  filters: readonly string[];
  /** Optional starting tab. Defaults to the first item in `filters`. */
  defaultFilter?: string;
  /** Class applied to the tabpanel. Lets each independent use of this
   * component target its own CSS-driven show/hide rules. */
  panelClassName?: string;
  /** aria-label for the tablist. */
  ariaLabel?: string;
  /** Pre-rendered card markup (server). Each child should carry a
   * `data-category` attribute matching one of `filters` so CSS can hide
   * non-matching cards based on the panel's `data-active-filter`. */
  children: ReactNode;
};

/**
 * Client island that owns the active-filter state and the ARIA tablist
 * keyboard handling. The cards themselves render server-side and are
 * passed in as `children`; this component just toggles a `data-active-
 * filter` attribute on the wrapping panel so CSS can hide non-matching
 * entries.
 *
 * Each instance scopes its tab/panel ARIA wiring with `useId()` so
 * multiple independent tablists can coexist on the same page (skills
 * filter + installer filter).
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 */
export const SkillsFilter = ({
  filters,
  defaultFilter,
  panelClassName = "SkillsLanding__filterPanel",
  ariaLabel = "Filter skills",
  children,
}: Props) => {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const tabId = (filter: string) => `${baseId}-tab-${filter}`;

  // Callers always pass at least one filter; the `?? ""` is a type-level
  // guard against `noUncheckedIndexedAccess` and never hits at runtime.
  const [activeFilter, setActiveFilter] = useState<string>(
    defaultFilter ?? filters[0] ?? "",
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % filters.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + filters.length) % filters.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filters.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextFilter = filters[nextIndex];
      // `% filters.length` guarantees in-bounds; guard satisfies
      // `noUncheckedIndexedAccess` without changing runtime behavior.
      if (nextFilter === undefined) return;
      setActiveFilter(nextFilter);
      tabRefs.current[nextFilter]?.focus();
    }
  };

  return (
    <>
      <div
        className="SkillsLanding__filters"
        role="tablist"
        aria-label={ariaLabel}
      >
        {filters.map((filter, index) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              role="tab"
              id={tabId(filter)}
              aria-controls={panelId}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              ref={(el) => {
                tabRefs.current[filter] = el;
              }}
              className="SkillsLanding__filterTab"
              data-is-active={isActive}
              onClick={() => setActiveFilter(filter)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {filter}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(activeFilter)}
        className={panelClassName}
        data-active-filter={activeFilter}
      >
        {children}
      </div>
    </>
  );
};
