/** Who runs Taleo, as a calling card: the app's own icon (as it sits on a
 *  phone's home screen), a fine rule, then who to write to. */
export function FounderCard() {
  return (
    <address className="policy-card" aria-label="Who runs Taleo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="policy-card-icon" src="/icon-192.png?v=2" alt="Taleo" width={192} height={192} loading="lazy" decoding="async" />
      <span className="policy-card-rule" aria-hidden />
      <span className="policy-card-who">
        <b>Chavalit Pramotedham</b>
        <span className="policy-card-role">Founder</span>
        <a href="mailto:taleostories.dev@gmail.com">taleostories.dev@gmail.com</a>
        <span className="policy-card-site">taleo-stories.app</span>
      </span>
    </address>
  );
}
