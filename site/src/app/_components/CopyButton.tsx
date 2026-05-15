"use client";

import { useEffect, useRef, useState } from "react";

import { CheckCircleIcon, Copy01Icon } from "./icons";

type CopyButtonVariant = "pill" | "path";

export type CopyButtonProps = {
  /** The string written to the clipboard. */
  value: string;
  /** Optional label shown to the user; defaults to `value`. */
  displayValue?: string;
  /**
   * Visual variant.
   * - `pill`: prominent hero-style copy chip.
   * - `path`: smaller path-style chip used inside skill cards.
   */
  variant?: CopyButtonVariant;
};

const COPIED_RESET_MS = 1000;

// Fallback for browsers / contexts where `navigator.clipboard` is
// unavailable (insecure HTTP origins, sandboxed iframes, permission
// denied). Returns true on success.
const legacyCopy = (text: string): boolean => {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
};

/**
 * Button that copies a string to the clipboard and shows a transient
 * "copied" affordance. Used for both the hero pill and per-card path
 * pills.
 */
export const CopyButton = ({
  value,
  displayValue,
  variant = "pill",
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const handleCopy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      } else {
        ok = legacyCopy(value);
      }
    } catch {
      // Clipboard API can reject (denied permission, non-secure
      // context). Fall through to the legacy path before giving up.
      ok = legacyCopy(value);
    }

    setCopied(ok);
    setFailed(!ok);

    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
      resetTimer.current = null;
    }, COPIED_RESET_MS);
  };

  const wrapperClass =
    variant === "pill" ? "SkillsCopyPill__wrapper" : "SkillsCard__pathWrapper";
  const buttonClass =
    variant === "pill" ? "SkillsCopyPill" : "SkillsCard__pathButton";
  const textClass =
    variant === "pill" ? "SkillsCopyPill__text" : "SkillsCard__pathText";

  const liveMessage = copied
    ? `Copied ${displayValue ?? value}`
    : failed
      ? "Copy failed"
      : "";

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        className={buttonClass}
        onClick={handleCopy}
        aria-label={
          copied
            ? `Copied ${displayValue ?? value}`
            : failed
              ? `Copy failed for ${displayValue ?? value}`
              : `Copy ${displayValue ?? value}`
        }
        data-copied={copied}
        data-failed={failed}
      >
        <span className={textClass}>{displayValue ?? value}</span>
        {variant === "pill" ? (
          <span className="SkillsCopyPill__copyIcon">
            {copied ? <CheckCircleIcon /> : <Copy01Icon />}
          </span>
        ) : copied ? (
          <CheckCircleIcon />
        ) : (
          <Copy01Icon />
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </div>
  );
};
