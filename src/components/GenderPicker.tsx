"use client";
import type { CharacterGender } from "@/lib/types";

/** A light, optional choice for a custom character: male, female, or left
 *  open. Three small round icons - softly blue / pink / grey, deepening
 *  when chosen - with no "gender" label, so it never feels like a form. */
export function GenderPicker({
  value,
  onChange,
  disabled,
}: {
  value: CharacterGender | null;
  onChange: (v: CharacterGender | null) => void;
  disabled?: boolean;
}) {
  const options: { v: CharacterGender | null; cls: string; label: string; icon: React.ReactNode }[] = [
    {
      v: "male",
      cls: "male",
      label: "Male",
      icon: (
        <>
          <circle cx="10" cy="14" r="5.2" />
          <path d="M14 10l5.5-5.5M15 4.5h4.5V9" />
        </>
      ),
    },
    {
      v: "female",
      cls: "female",
      label: "Female",
      icon: (
        <>
          <circle cx="12" cy="9" r="5.2" />
          <path d="M12 14.2V21M9 18h6" />
        </>
      ),
    },
    {
      v: null,
      cls: "open",
      label: "Not set",
      icon: (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M6.7 17.3L17.3 6.7" />
        </>
      ),
    },
  ];
  return (
    <div className="gender-picker" role="radiogroup" aria-label="Male or female (optional)">
      {options.map((o) => (
        <button
          key={o.cls}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          aria-label={o.label}
          title={o.label}
          className={`gender-opt ${o.cls} ${value === o.v ? "on" : ""}`}
          onClick={() => onChange(o.v)}
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}
