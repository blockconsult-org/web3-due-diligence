import type { ReactNode } from "react";
import type { FieldSpec } from "@/simulator/engine/fields";
import type { FormatLocale } from "@/simulator/engine/format";

/**
 * Props of the simulator's form controls. Controls are controlled, take
 * every visible string from the caller, and work in stored units: a percent
 * field receives and returns a fraction and does the × 100 itself.
 */

interface FieldBaseProps {
  /** Unique on the page; ties the label, help and error to the control. */
  id: string;
  label: string;
  /** Longer explanation, shown in a popover opened from a "?" button. */
  help?: string;
  /** Accessible name of that button, e.g. "About cliff". */
  helpLabel?: string;
  /** Validation message. Sets aria-invalid and is announced. */
  error?: string;
  disabled?: boolean;
  /** Hide the label visually (it stays for screen readers): table cells. */
  hideLabel?: boolean;
  className?: string;
}

/** A text input for a number, with the unit shown beside it. Commits on blur
 *  and Enter, clamps to the spec, and steps with the arrow keys. */
export interface NumberFieldProps extends FieldBaseProps {
  /** Stored value. Null only when the spec is nullable. */
  value: number | null;
  onChange: (value: number | null) => void;
  spec: FieldSpec;
  locale: FormatLocale;
  /** Tighter padding and no unit column: table cells. */
  compact?: boolean;
  /** Placeholder shown while a nullable field is empty. */
  placeholder?: string;
  /** Replaces the unit the spec implies, e.g. a token symbol. */
  unitLabel?: string;
}

/** A NumberField with a range slider under it. The slider is logarithmic
 *  when the spec says so. */
export interface SliderFieldProps extends Omit<NumberFieldProps, "value" | "onChange" | "compact" | "placeholder"> {
  value: number;
  onChange: (value: number) => void;
}

export interface TextFieldProps extends FieldBaseProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  compact?: boolean;
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** A select: a box showing the choice, with a list of its own under it. */
export interface SelectFieldProps<T extends string> extends FieldBaseProps {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
}

/** A row of mutually exclusive buttons (a radio group). For two to four
 *  short options. */
export interface SegmentedProps<T extends string> extends FieldBaseProps {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

/** A labelled on/off switch. */
export interface ToggleProps extends FieldBaseProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** The "?" button and its popover, for use outside a field. */
export interface HelpProps {
  /** Accessible name of the button. */
  label: string;
  children: ReactNode;
}

/** The accordion that holds the input groups. Several can be open. */
export interface SectionsProps {
  /** Values of the sections open on first render. */
  defaultOpen: string[];
  children: ReactNode;
}

/** One collapsible input group. */
export interface SectionProps {
  /** Unique within its Sections. */
  value: string;
  title: string;
  /** One line shown beside the title while the group is closed, e.g.
   *  "9 rows · 100%". */
  summary?: string;
  /** A count of problems in the group, shown as a marker on the header. */
  issues?: number;
  /** Accessible text for that marker, e.g. "2 problems". */
  issuesLabel?: string;
  children: ReactNode;
}
