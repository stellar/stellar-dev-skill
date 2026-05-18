import Link from "next/link";

import { ArrowLeftIcon } from "./_components/icons";

export default function NotFound() {
  return (
    <div className="ErrorContent">
      <div className="ErrorContent__group">
        <h2>Error 404 - Page not found</h2>

        <p>
          Oops! The page you’re looking for doesn’t exist. It might have been
          removed, had its name changed, or is temporarily unavailable.
        </p>
      </div>

      <Link href="/" className="ErrorContent__button">
        <ArrowLeftIcon />
        Back to home
      </Link>
    </div>
  );
}
