"use client";

export function StarRating({
  value,
  onChange,
  small = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  small?: boolean;
}) {
  return (
    <div className={`stars ${small ? "small" : ""}`} role={onChange ? "radiogroup" : "img"} aria-label={`Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${n <= value ? "on" : ""}`}
          onClick={onChange ? () => onChange(n) : undefined}
          disabled={!onChange}
          role={onChange ? "radio" : undefined}
          aria-checked={onChange ? n === value : undefined}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          tabIndex={onChange ? 0 : -1}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}
