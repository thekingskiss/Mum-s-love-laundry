import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import SectionHeading from '../components/SectionHeading.jsx';
import { SHOP_EMAIL, SHOP_NAME } from '../lib/shopInfo.js';

const LAST_UPDATED = 'August 2026';

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-14">
      <Helmet>
        <title>Privacy Policy — {SHOP_NAME}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <SectionHeading title="Privacy Policy" eyebrow={`Last updated: ${LAST_UPDATED}`} />

      <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <strong>Draft notice:</strong> this policy describes what {SHOP_NAME}'s
        systems actually collect and store today. It has not been reviewed by
        a lawyer — have it checked against applicable data-protection law
        (e.g. Ghana's Data Protection Act) before relying on it for real
        customers.
      </div>

      <div className="prose prose-slate mt-10 max-w-none space-y-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">1. What We Collect</h2>
          <p className="mt-2">
            When you create an account or place an order, we collect: your
            full name, email address, phone number, and location zone (the
            area you register from); the items and quantities in each order,
            drop-off and pickup dates, and order status history; and, if you
            choose to add one, a profile picture. If you contact us through
            the Contact page, we store your name, email, and message.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">2. How We Store It</h2>
          <p className="mt-2">
            Your data is stored in our own PostgreSQL database. Uploaded
            profile pictures are stored as files on the server that runs our
            application. We do not sell your data or share it with
            advertisers.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">3. Third Parties</h2>
          <p className="mt-2">
            We use third-party services only to deliver order-status
            notifications: an email provider and, where enabled, an SMS
            provider (Twilio). These providers see only the message content
            and your contact address needed to deliver that specific
            notification — they are not given ongoing access to your account.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">4. Cookies &amp; Local Storage</h2>
          <p className="mt-2">
            We don't use tracking or advertising cookies. Your browser's
            local storage holds your login session token and a few display
            preferences (theme, language, display currency) so the site
            remembers them between visits. Clearing your browser's site data
            will sign you out and reset these preferences.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">5. Your Rights</h2>
          <p className="mt-2">
            You can view and update your name, phone number, area, username,
            and profile picture at any time from your{' '}
            <Link to="/settings" className="text-brand-600 hover:underline">Settings</Link> page. To
            request a copy of your data or its deletion, contact us at{' '}
            <a href={`mailto:${SHOP_EMAIL}`} className="text-brand-600 hover:underline">{SHOP_EMAIL}</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">6. Contact</h2>
          <p className="mt-2">
            Questions about this policy can be sent to{' '}
            <a href={`mailto:${SHOP_EMAIL}`} className="text-brand-600 hover:underline">{SHOP_EMAIL}</a>{' '}
            or via our <Link to="/contact" className="text-brand-600 hover:underline">Contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
