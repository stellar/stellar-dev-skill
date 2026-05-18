"use client";

import NextError from "next/error";

export default function GlobalError() {
  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
