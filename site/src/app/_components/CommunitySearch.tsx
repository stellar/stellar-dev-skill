"use client";

import { Children, ReactNode, useId, useState } from "react";

import { Input, Pagination } from "@stellar/design-system";

/** Cards shown per page in the 2-column community grid. */
const PAGE_SIZE = 8;

type Props = {
  /** Lowercased "title description" haystack for each child, in the
   * same render order as `children`. Search runs against these strings
   * so the cards themselves stay server-rendered; this island only
   * toggles wrapper visibility. */
  searchTexts: readonly string[];
  /** Pre-rendered card markup (server). One child per searchTexts
   * entry, same order. */
  children: ReactNode;
};

/**
 * Client island that adds search and pagination to the community
 * skills grid. The cards render server-side and are passed in as
 * `children` (same slot pattern as `SkillsFilter`), so every card's
 * title/description/link stays in the static HTML for non-JS clients;
 * this component only hides wrappers that don't match the query or
 * fall outside the current page.
 *
 * Search matches a case-insensitive substring of the card title or any
 * part of its description, so a query like "DEX" finds a card that
 * only mentions it mid-description.
 */
export const CommunitySearch = ({ searchTexts, children }: Props) => {
  const searchInputId = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const needle = query.trim().toLowerCase();
  const matches = searchTexts.reduce<number[]>((acc, text, index) => {
    if (text.includes(needle)) acc.push(index);
    return acc;
  }, []);

  // Clamp instead of trusting `page`: a new query can shrink the match
  // list below the previously selected page.
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = new Set(
    matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
  );

  return (
    <>
      <div className="SkillsLanding__communitySearch">
        <Input
          id={searchInputId}
          fieldSize="md"
          type="search"
          placeholder="Search community skills"
          aria-label="Search community skills by title or description"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="SkillsLanding__ecosystemGrid">
        {Children.map(children, (child, index) => (
          <div
            key={index}
            className="SkillsLanding__communityItem"
            data-hidden={!visible.has(index)}
          >
            {child}
          </div>
        ))}
      </div>

      {matches.length === 0 && (
        <p className="SkillsLanding__communityEmpty">
          No community skills match your search.
        </p>
      )}

      <p
        className="SkillsLanding__communityCount"
        role="status"
        aria-live="polite"
      >
        Showing {visible.size} of {searchTexts.length} skill
        {searchTexts.length === 1 ? "" : "s"}
      </p>

      {matches.length > PAGE_SIZE && (
        <div className="SkillsLanding__communityPagination">
          <Pagination
            pageSize={PAGE_SIZE}
            itemCount={matches.length}
            currentPage={currentPage}
            setCurrentPage={setPage}
          />
        </div>
      )}
    </>
  );
};
