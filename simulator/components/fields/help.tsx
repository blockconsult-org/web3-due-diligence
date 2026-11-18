"use client";

import { useEffect, useId, useRef, type ToggleEvent } from "react";
import type { HelpProps } from "./types";
import { followAnchor, placePopup } from "./use-popup";

/* Pixels between the button and the popover: step 2 of the spacing scale. */
const GAP = 8;

interface HelpPopoverProps extends HelpProps {
  /** Id of the popover, so a field can name it in aria-describedby. */
  id: string;
}

/**
 * A "?" button and the popover it opens.
 *
 * The browser's own popover does the opening: `popovertarget` toggles it,
 * Escape and a click outside close it, it sits in the top layer where no
 * scroll box can cut it off, and the button reports its expanded state to
 * assistive technology without an attribute set here. What the browser does
 * not do everywhere yet is put the popover next to its button, so
 * `placePopup` does that: under the button and centred on it.
 *
 * The popover follows the button in the document, so a screen reader that
 * opens it reads the text next, and `aria-details` points at it as well. A
 * field also names the popover in its `aria-describedby`, which works while
 * the popover is closed.
 *
 * The popover is a span so the pair is valid inside a label row, a heading or
 * a paragraph.
 */
export function HelpPopover({ id, label, children }: HelpPopoverProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const stopFollowing = useRef<(() => void) | null>(null);

  function place() {
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;
    if (!placePopup(button, popover, { align: "center", gap: GAP })) {
      popover.hidePopover();
    }
  }

  function handleBeforeToggle(event: ToggleEvent<HTMLSpanElement>) {
    stopFollowing.current?.();
    stopFollowing.current = null;
    if (event.newState !== "open") return;

    // The popover has no size until this event has returned, so the first
    // placement waits for the next frame, which still runs before the
    // popover is painted. After that it follows the button.
    const frame = requestAnimationFrame(place);
    const stop = followAnchor(place);
    stopFollowing.current = () => {
      cancelAnimationFrame(frame);
      stop();
    };
  }

  // A popover removed while open, with a closing section, gets no event.
  useEffect(() => () => stopFollowing.current?.(), []);

  return (
    <>
      {/* The pseudo-element widens the 24px square to a 44px touch target
          without making the label row taller. */}
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={id}
        aria-label={label}
        aria-details={id}
        className="sim-help-button relative inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center font-mono text-xs leading-none before:absolute before:-inset-2.5"
      >
        <span aria-hidden>?</span>
      </button>
      <span
        ref={popoverRef}
        id={id}
        popover="auto"
        onBeforeToggle={handleBeforeToggle}
        className="sim-help-popover"
      >
        {children}
      </span>
    </>
  );
}

export function Help({ label, children }: HelpProps) {
  const id = useId();
  return (
    <HelpPopover id={id} label={label}>
      {children}
    </HelpPopover>
  );
}
