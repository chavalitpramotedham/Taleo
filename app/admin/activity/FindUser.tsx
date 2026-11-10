"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fuzzyPeople } from "@/lib/fuzzy";

export interface Person {
  id: string;
  username: string | null;
  email: string;
}

/** The search for one account's activity: as a handle or email is typed,
 *  the accounts it could mean are listed beneath (a loose match: letters
 *  in order, a slip forgiven), and a cross in the box clears it. */
export function FindUser({ action, searched, people }: { action: string; searched: string; people: Person[] }) {
  const [typed, setTyped] = useState(searched);
  const box = useRef<HTMLInputElement>(null);
  // (what was searched for is answered by the page itself, below)
  const found = useMemo(() => (typed.trim() && typed.trim() !== searched ? fuzzyPeople(typed, people) : []), [typed, searched, people]);
  return (
    <>
      <form className="field-row" action={action} method="get" role="search">
        <span className="admin-find">
          <input
            ref={box}
            className="input"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            name="q"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Email or handle"
            aria-label="Email or handle"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {typed && (
            <button
              type="button"
              className="admin-find-clear"
              aria-label="Clear"
              onClick={() => {
                setTyped("");
                box.current?.focus();
              }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </span>
        <button type="submit" className="btn btn-primary btn-sm">
          Search
        </button>
      </form>
      {typed.trim() && typed.trim() !== searched && (
        <>
          <h3>{found.length ? (found.length === 1 ? "1 account it could be" : `${found.length} accounts it could be`) : `Nobody like “${typed.trim()}”`}</h3>
          {found.length > 0 && (
            <table className="admin-table">
              <tbody>
                {found.slice(0, 8).map((u) => (
                  <tr key={u.id}>
                    <th>
                      <Link href={`${action}?user=${encodeURIComponent(u.id)}`}>{u.username ? `@${u.username}` : u.email}</Link>
                    </th>
                    <td>{u.username ? u.email : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
