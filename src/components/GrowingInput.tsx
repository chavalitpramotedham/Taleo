"use client";
import { useLayoutEffect, useRef } from "react";

/** A text box that wraps long text onto more lines and grows to fit it, so
 *  the whole idea (typed or dictated) is always visible - never scrolled
 *  sideways inside a one-line bar. Enter submits (Shift+Enter is ignored),
 *  like the single-line box it replaces. */
export function GrowingInput({
  value,
  onChange,
  onEnter,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`input growing-input ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!e.shiftKey) onEnter?.();
        }
      }}
      {...rest}
    />
  );
}
