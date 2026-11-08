/** Wraps every page so it fades softly in on each navigation (see
 *  .page-enter). A template re-mounts per route, unlike the layout. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
