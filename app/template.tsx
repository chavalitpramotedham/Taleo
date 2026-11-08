import { ScrollReset } from "@/components/ScrollReset";

/** Wraps every page so it fades softly in on each navigation (see
 *  .page-enter), starting from the top of the screen. A template
 *  re-mounts per route, unlike the layout. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-enter">
      <ScrollReset />
      {children}
    </div>
  );
}
