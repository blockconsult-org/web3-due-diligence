"use client";

import type { ReactNode } from "react";
import { HelpPopover } from "./help";
import controls from "./controls.module.css";

/** Joins class names, leaving out the ones a condition switched off. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Ids of the parts of a field, derived from the id of its control. */
export function fieldIds(id: string) {
  return {
    label: `${id}-label`,
    help: `${id}-help`,
    error: `${id}-error`,
    unit: `${id}-unit`,
  };
}

/** A value for aria-describedby: the ids that are present, or none at all. */
export function describedBy(
  ...ids: (string | false | undefined)[]
): string | undefined {
  const present = ids.filter(Boolean);
  return present.length > 0 ? present.join(" ") : undefined;
}

/* The box of a text control, after the fields of the contact form: a hairline
   that strengthens under the pointer and takes the accent with focus, and a
   stronger border while the value is invalid. The site has no error colour.
   The surface fill is the one for a field on the open page.

   Text is 16px on a phone in every variant, because iOS zooms the page when a
   smaller field takes focus. A compact control pulls its focus ring in to the
   border, so a table's scroll box does not cut the ring off. */
/** Classes for a control that is its own box: a text input or a select. */
export function controlClass(compact = false): string {
  return cx(
    controls.control,
    "placeholder:text-faint",
    compact && controls.compact,
  );
}

/** Classes for a box around a bare input and its unit. The input inside
 *  supplies the states, so the ring and the borders are drawn on the box. */
export function controlBoxClass(compact = false): string {
  return cx(
    controls.box,
    compact && controls.compact,
  );
}

/**
 * The validation message of a field. The paragraph stays in the tree while
 * empty, so a screen reader announces the message when it arrives. `quiet`
 * keeps the sentence off the screen where a table cell has no room for it;
 * it is still read out, and the control still shows its invalid border.
 */
export function FieldError({
  id,
  error,
  quiet = false,
}: {
  id: string;
  error?: string;
  quiet?: boolean;
}) {
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className={quiet ? "sr-only" : undefined}
    >
      {error ? (
        <span
          className={
            quiet ? undefined : "mt-1.5 block text-sm leading-snug text-fg"
          }
        >
          {error}
        </span>
      ) : null}
    </p>
  );
}

interface FieldShellProps {
  /** Id of the control. The ids of the label, help and error derive from it. */
  id: string;
  label: string;
  help?: string;
  helpLabel?: string;
  error?: string;
  hideLabel?: boolean;
  /** The control is a group, such as a row of radio buttons. A `<label>` can
   *  only point at one element, so the group is named through
   *  aria-labelledby and the label is plain text. */
  group?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The frame every field shares: the label row above the control and the error
 * under it. The control is passed in and wires itself to the ids from
 * `fieldIds`.
 *
 * The label row is 24px high with or without a help button, so fields that
 * sit side by side keep their controls on one line.
 *
 * With `hideLabel` the cell shows the control alone. The label, the help text
 * and the error stay available to a screen reader, and the help button goes,
 * since a row holding only that button would cost the cell its height. A
 * table explains its columns in the header.
 */
export function FieldShell({
  id,
  label,
  help,
  helpLabel,
  error,
  hideLabel = false,
  group = false,
  className,
  children,
}: FieldShellProps) {
  const ids = fieldIds(id);
  const labelClass = hideLabel ? "sr-only" : "text-sm text-muted";
  const labelElement = group ? (
    <span id={ids.label} className={labelClass}>
      {label}
    </span>
  ) : (
    <label id={ids.label} htmlFor={id} className={labelClass}>
      {label}
    </label>
  );

  return (
    <div className={cx("min-w-0", className)}>
      {hideLabel ? (
        <>
          {labelElement}
          {/* Hidden text still serves as a description when a control names
              it in aria-describedby. */}
          {help ? (
            <span id={ids.help} hidden>
              {help}
            </span>
          ) : null}
        </>
      ) : (
        <div className="mb-2 flex min-h-6 items-center gap-2">
          {labelElement}
          {help ? (
            <HelpPopover id={ids.help} label={helpLabel ?? label}>
              {help}
            </HelpPopover>
          ) : null}
        </div>
      )}
      {children}
      <FieldError id={ids.error} error={error} quiet={hideLabel} />
    </div>
  );
}
