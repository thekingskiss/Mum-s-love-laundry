import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import SectionHeading from '../components/SectionHeading.jsx';
import { SHOP_EMAIL, SHOP_NAME } from '../lib/shopInfo.js';

const LAST_UPDATED = 'August 2026';

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-14">
      <Helmet>
        <title>Terms of Service — {SHOP_NAME}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <SectionHeading title="Terms of Service" eyebrow={`Last updated: ${LAST_UPDATED}`} />

      <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <strong>Draft notice:</strong> these terms describe how {SHOP_NAME}'s
        service actually works today. They have not been reviewed by a
        lawyer — have them checked before relying on them to limit liability
        or govern real customer transactions.
      </div>

      <div className="prose prose-slate mt-10 max-w-none space-y-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">1. Our Service</h2>
          <p className="mt-2">
            {SHOP_NAME} offers walk-in laundry, ironing, and dry-cleaning
            services. Customers bring items to our shop themselves and
            collect them in person once ready — we do not currently offer
            pickup or delivery.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">2. Orders &amp; Pricing</h2>
          <p className="mt-2">
            Prices are itemized per garment or linen type, shown on our{' '}
            <Link to="/pricing" className="text-brand-600 hover:underline">Pricing page</Link> and
            confirmed again when you build an order. A small number of items
            are priced within a range; for those, the order total shown is an
            estimate at the low end, and the exact price is confirmed when
            you drop the item off in person.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">3. Cancellations</h2>
          <p className="mt-2">
            You may cancel an order yourself, free of charge, only while it
            is still in "Order Received" status — before we've begun
            processing it. Once an order has moved into washing, ironing, or
            later stages, contact us directly and we'll do our best to
            accommodate you, but a refund or reversal is not guaranteed at
            that point.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">4. Care of Your Items</h2>
          <p className="mt-2">
            We handle every item with care, but we are not responsible for
            damage caused by pre-existing wear, non-colorfast dyes, or
            manufacturer defects not disclosed at drop-off. If you believe an
            item was damaged or lost while in our care, notify us as soon as
            possible so we can investigate.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">5. Uncollected Items &amp; Storage Fees</h2>
          <p className="mt-2">
            Pickup is free for the first 7 days after we notify you that your
            order is ready. After that, a storage fee of GHS 5 per day
            applies for every day it remains uncollected. We'll email and
            text you when your order is ready, and send follow-up reminders
            while it sits uncollected — but the fee applies regardless of
            whether a reminder reaches you. If you expect a delay in
            collecting an order, contact us and we're happy to work out an
            arrangement.
          </p>
          <p className="mt-2">
            <strong>{SHOP_NAME} is not responsible for items left uncollected
            for more than 7 days after we notify you they're ready.</strong> We
            take reasonable care of finished orders while they wait for
            pickup, but we cannot guarantee an item's condition or presence
            beyond that window — please collect your order promptly, or
            contact us in advance if you need it held longer.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">6. Your Account</h2>
          <p className="mt-2">
            You're responsible for keeping your password confidential and
            for activity under your account. Contact us immediately if you
            believe your account has been accessed without your permission.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">7. Changes</h2>
          <p className="mt-2">
            We may update these terms as our service changes. Continued use
            of our service after an update means you accept the revised
            terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">8. Contact</h2>
          <p className="mt-2">
            Questions about these terms can be sent to{' '}
            <a href={`mailto:${SHOP_EMAIL}`} className="text-brand-600 hover:underline">{SHOP_EMAIL}</a>{' '}
            or via our <Link to="/contact" className="text-brand-600 hover:underline">Contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
