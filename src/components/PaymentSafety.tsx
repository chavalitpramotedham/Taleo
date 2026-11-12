/** A shield with a tick: paying safely. */
export function ShieldIcon() {
  return (
    <svg className="shield-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M12 2.8 4.6 5.6v5.6c0 4.7 3.1 8.6 7.4 10 4.3-1.4 7.4-5.3 7.4-10V5.6L12 2.8Z" fill="currentColor" opacity="0.18" />
      <path d="M12 2.8 4.6 5.6v5.6c0 4.7 3.1 8.6 7.4 10 4.3-1.4 7.4-5.3 7.4-10V5.6L12 2.8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m8.6 12.1 2.4 2.4 4.4-4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * How paying is kept safe, said plainly - for credit packs and for the
 * Plus and Pro plans. Every line here must stay true of how payments are
 * built (server/stripe, /api/account/checkout, /api/account/subscription,
 * /api/stripe/webhook):
 *  - the card is entered on Stripe's own hosted page; Taleo never receives
 *    or stores card details;
 *  - prices are worked out on Taleo's server (lib/tiers), never taken from
 *    the browser;
 *  - credits and plans change only on Stripe's signed confirmation, and
 *    each payment counts once;
 *  - plans are cancelled in Stripe's billing page and stay until the month
 *    paid for ends, with no charge after.
 * Until payments are open it says so first - nothing can be charged.
 */
export function PaymentSafety({ open, plans = false }: { open: boolean; plans?: boolean }) {
  return (
    <section className="buy-credits-safety" aria-label="How paying is kept safe">
      <ul>
        {!open && (
          <li>
            <b>Not open yet.</b> Card payments are still being set up, so nothing can be charged from here today.
          </li>
        )}
        <li>
          <b>Paid on Stripe&apos;s page.</b> {open ? "You" : "When payments open, you"}&apos;ll enter your card on Stripe&apos;s own secure checkout page (Stripe handles card payments for millions of businesses), not on Taleo.
        </li>
        <li>
          <b>We never see your card.</b> Your card number goes straight to Stripe. Taleo doesn&apos;t receive it or store it.
        </li>
        <li>
          <b>You confirm the total first.</b> Stripe shows the amount - with any tax due where you live - before you pay, and nothing is charged until you confirm there. Prices are set by Taleo, not by your browser, so they can&apos;t be changed along the way.
        </li>
        <li>
          <b>{plans ? "Your plan follows the payment." : "Credits follow the payment."}</b> {plans ? "A plan starts" : "Credits are added"} only once Stripe tells us the payment went through - and each payment counts once.
        </li>
        {plans && (
          <li>
            <b>Cancel any time.</b> Plans renew monthly. Cancel in Stripe&apos;s billing page (Manage subscription): you keep your plan until the month you&apos;ve paid for ends, and you&apos;re not charged again.
          </li>
        )}
      </ul>
    </section>
  );
}
