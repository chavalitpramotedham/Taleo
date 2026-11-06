"use client";

export function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="stars" role={onChange ? "radiogroup" : "img"} aria-label={`Rated ${value} of 5`}>
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
          <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
            <path
              d="M12 2.8l2.7 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.7 6.3 19.9l1.4-6.3L2.9 9.3l6.4-.6z"
              fill={n <= value ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
