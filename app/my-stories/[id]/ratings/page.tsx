"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { RatingRecord } from "@/lib/types";
import { StarRating } from "@/components/StarRating";

export default function StoryRatingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [ratings, setRatings] = useState<RatingRecord[] | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace(`/sign-in?next=/my-stories/${id}/ratings`);
  }, [status, router, id]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/gallery/${id}/ratings`)
      .then((r) => r.json())
      .then((d: { ratings?: RatingRecord[] | null }) => {
        if (d.ratings === null) setError(true);
        else setRatings(d.ratings ?? []);
      })
      .catch(() => setError(true));
  }, [status, id]);

  if (status !== "authenticated" || ratings === undefined) return null;

  return (
    <div className="container">
      <header className="wizard-head">
        <p className="eyebrow">
          <Link href="/my-stories">← My stories</Link>
        </p>
        <h1>Who rated this story</h1>
      </header>

      {error ? (
        <p className="meta">Only the story&apos;s own creator can see this.</p>
      ) : ratings!.length === 0 ? (
        <p className="meta">No ratings yet.</p>
      ) : (
        <div className="ratings-list">
          {ratings!.map((r, i) => (
            <article key={i} className="rating-card">
              <div className="rating-card-head">
                <strong>@{r.username}</strong>
                <StarRating value={r.rating} />
              </div>
              {r.comment && <p className="meta">&ldquo;{r.comment}&rdquo;</p>}
              <p className="meta rating-date">{new Date(r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
