"use client";

import { useEffect } from "react";

import { ArrowLeftIcon } from "./_components/icons";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ErrorContent">
      <div className="ErrorContent__group">
        <h2>Unhandled Error</h2>

        <p>
          Uh-oh, we didn’t handle this error. We would appreciate it if you
          opened an issue on GitHub, providing as many details as possible to
          help us fix this bug.
          {error.digest ? ` (digest: ${error.digest})` : null}
        </p>
      </div>

      <div className="ErrorContent__row">
        <button
          type="button"
          className="ErrorContent__button"
          onClick={() => reset()}
        >
          <ArrowLeftIcon />
          Return
        </button>

        <a
          className="ErrorContent__button ErrorContent__button--primary"
          href="https://github.com/stellar/stellar-dev-skill/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Issue
        </a>
      </div>
    </div>
  );
}
