"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  FieldShell,
  controlClass,
  cx,
  describedBy,
  fieldIds,
} from "./field-shell";
import { Chevron, Tick } from "./icons";
import type { SelectFieldProps } from "./types";
import { usePopup } from "./use-popup";
import controls from "./controls.module.css";

/* Pixels between the box and its list: step 1 of the spacing scale. */
const GAP = 4;
/** Options a Page Up or Page Down moves by. */
const PAGE = 10;
/** Letters typed within this many milliseconds search as one word. */
const TYPE_AHEAD_MS = 500;

/**
 * A select with a list of its own in place of the system's.
 *
 * The pattern is the select-only combobox: the box keeps the keyboard focus
 * the whole time and names the option the arrow keys are on through
 * aria-activedescendant. Enter, Space and a click choose it. Tab chooses it
 * and moves on. Escape, a press outside the list and the box leaving the
 * window close the list and keep the value. Typing a few letters goes to the
 * option that starts with them, and the same letter again goes to the next.
 *
 * The list is a popup in the browser's top layer (see use-popup.ts), so the
 * scrolling column of inputs cannot cut it off.
 */
export function SelectField<T extends string>({
  id,
  label,
  help,
  helpLabel,
  error,
  disabled = false,
  hideLabel,
  className,
  value,
  options,
  onChange,
  compact,
}: SelectFieldProps<T>) {
  const ids = fieldIds(id);
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const [open, setOpen] = useState(false);
  /** Index of the option the arrow keys or the pointer are on. */
  const [active, setActive] = useState(0);

  const last = options.length - 1;
  // With a value that matches no option, the list opens on its first one.
  const chosen = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const dismiss = useCallback(() => setOpen(false), []);
  usePopup({
    open,
    onDismiss: dismiss,
    anchor: boxRef,
    popup: listRef,
    align: "start",
    gap: GAP,
    matchWidth: true,
  });

  // A long list scrolls with the arrow keys.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${id}-option-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  function openAt(index: number) {
    setActive(Math.max(0, Math.min(index, last)));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    setOpen(false);
    if (option && option.value !== value) onChange(option.value);
  }

  /** The option a typed word leads to, searched from `from` and round. */
  function findTyped(key: string, at: number, from: number): number {
    const fresh = at - typed.current.at > TYPE_AHEAD_MS;
    const text = fresh ? key : typed.current.text + key;
    typed.current = { text, at };
    // One letter, or the same letter again, steps through the options that
    // start with it. A longer word stays on the current option if it fits.
    const repeated = [...text].every((letter) => letter === text[0]);
    const needle = (repeated ? text[0] : text).toLocaleLowerCase();
    const start = repeated ? from + 1 : from;
    for (let step = 0; step < options.length; step += 1) {
      const index = (start + step) % options.length;
      if (options[index].label.toLocaleLowerCase().startsWith(needle)) {
        return index;
      }
    }
    return -1;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || options.length === 0) return;
    const { key } = event;

    if (key.length === 1 && key !== " ") {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const found = findTyped(key, event.timeStamp, open ? active : chosen);
      if (found >= 0) openAt(found);
      return;
    }

    if (!open) {
      const opensAt: Record<string, number> = {
        ArrowDown: chosen,
        ArrowUp: chosen,
        Enter: chosen,
        " ": chosen,
        Home: 0,
        End: last,
      };
      if (key in opensAt) {
        event.preventDefault();
        openAt(opensAt[key]);
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        setActive(Math.min(active + 1, last));
        break;
      case "ArrowUp":
        // With Alt held the arrow closes the list on the current option, as
        // it does on a system select.
        if (event.altKey) choose(active);
        else setActive(Math.max(active - 1, 0));
        break;
      case "PageDown":
        setActive(Math.min(active + PAGE, last));
        break;
      case "PageUp":
        setActive(Math.max(active - PAGE, 0));
        break;
      case "Home":
        setActive(0);
        break;
      case "End":
        setActive(last);
        break;
      case "Enter":
      case " ":
        choose(active);
        break;
      case "Escape":
        setOpen(false);
        break;
      case "Tab":
        // Not prevented: the focus moves on from the box as usual.
        choose(active);
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      helpLabel={helpLabel}
      error={error}
      hideLabel={hideLabel}
      group
      className={className}
    >
      <div
        ref={boxRef}
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-labelledby={ids.label}
        aria-describedby={describedBy(error && ids.error, help && ids.help)}
        aria-invalid={error ? true : undefined}
        aria-disabled={disabled ? true : undefined}
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openAt(chosen);
        }}
        onKeyDown={handleKeyDown}
        // The focus went elsewhere without a choice, so the value stays.
        onBlur={dismiss}
        className={cx(
          controlClass(compact),
          controls.select,
        )}
      >
        <span className="min-w-0 truncate">{options[chosen]?.label}</span>
        <Chevron className={controls.chevron} />
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        popover="manual"
        aria-labelledby={ids.label}
        data-open={open}
        // A press on the list must not take the focus from the box.
        onMouseDown={(event) => event.preventDefault()}
        className={controls.popup}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={option.value === value}
            data-active={open && index === active}
            onPointerMove={() => {
              if (index !== active) setActive(index);
            }}
            onClick={() => choose(index)}
            className={controls.option}
          >
            <span className="min-w-0 wrap-anywhere">{option.label}</span>
            <span className={controls.mark} aria-hidden><Tick className={controls.tick} /></span>
          </div>
        ))}
      </div>
    </FieldShell>
  );
}
