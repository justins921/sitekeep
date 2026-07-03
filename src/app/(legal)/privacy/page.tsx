import type { Metadata } from "next";

// ⚠️ TEMPLATE ONLY — NOT LEGAL ADVICE. Starter scaffold that MUST be reviewed by
// a qualified attorney / privacy professional before launch. Complete every
// [BRACKETED] placeholder and confirm the subprocessor list, retention periods,
// legal bases, and rights match your actual practices and jurisdictions
// (e.g., GDPR/UK GDPR, CCPA/CPRA).

export const metadata: Metadata = {
  title: "Privacy Policy — SiteKeep",
  robots: { index: false },
};

const ENTITY = "[LEGAL ENTITY NAME]";
const CONTACT = "[CONTACT EMAIL]";
const EFFECTIVE = "[EFFECTIVE DATE]";
const ADDRESS = "[COMPANY ADDRESS]";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-lg font-bold text-ink">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-body">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="mt-1.5 text-sm leading-relaxed text-body">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Effective date: {EFFECTIVE}</p>

      <div className="mt-4 rounded-xl bg-fill-blue px-4 py-3 text-xs text-brand">
        Template placeholder — this document must be reviewed by a privacy
        professional and the bracketed fields completed before launch.
      </div>

      <P>
        This Privacy Policy explains how {ENTITY} (&ldquo;we,&rdquo; &ldquo;us&rdquo;)
        collects, uses, and shares information in connection with SiteKeep (the
        &ldquo;Service&rdquo;). For data you connect about your own clients, you are
        the controller and we act as your processor.
      </P>

      <H>1. Information we collect</H>
      <ul className="mt-2 list-disc pl-5">
        <LI><strong>Account data:</strong> your name, email, agency name, password (hashed), and settings.</LI>
        <LI><strong>Client &amp; site data you add:</strong> client names, website URLs, contacts, notes, requests, and branding assets.</LI>
        <LI><strong>Metrics we collect on your behalf:</strong> website performance (Google PageSpeed Insights), analytics (Google Analytics 4), security/SSL checks, and uptime results for the sites you connect.</LI>
        <LI><strong>Payment data:</strong> processed by Stripe; we receive limited billing metadata (e.g., subscription status), not full card numbers.</LI>
        <LI><strong>Usage &amp; technical data:</strong> log data, IP address, device/browser info, and error diagnostics.</LI>
      </ul>

      <H>2. How we use information</H>
      <P>
        To provide, maintain, and improve the Service; generate dashboards, reports,
        and alerts; process payments; communicate with you; ensure security; and
        comply with law.
      </P>

      <H>3. Legal bases (where applicable)</H>
      <P>
        Where the GDPR/UK GDPR applies, we rely on: performance of a contract
        (providing the Service), legitimate interests (securing and improving the
        Service), consent (where required), and legal obligation. [Confirm bases with
        counsel.]
      </P>

      <H>4. Service providers &amp; subprocessors</H>
      <P>We share data with vendors who process it on our behalf, including:</P>
      <ul className="mt-2 list-disc pl-5">
        <LI><strong>Supabase</strong> — database, authentication, storage.</LI>
        <LI><strong>Vercel</strong> — application hosting.</LI>
        <LI><strong>Stripe</strong> — payment processing.</LI>
        <LI><strong>Resend</strong> — transactional and report emails.</LI>
        <LI><strong>Google</strong> — Analytics Data API (GA4), PageSpeed Insights, Safe Browsing.</LI>
        <LI><strong>[Sentry / error monitoring]</strong> — error diagnostics, if enabled.</LI>
      </ul>
      <P>[Maintain a current subprocessor list and update this section as vendors change.]</P>

      <H>5. Sharing</H>
      <P>
        We do not sell your personal information. We share it with the subprocessors
        above, when you direct us to, to comply with law, or in connection with a
        business transfer. White-label dashboards you publish are accessible to anyone
        with the link you share.
      </P>

      <H>6. Data retention</H>
      <P>
        We retain information for as long as your account is active and as needed to
        provide the Service, then delete or anonymize it within [RETENTION PERIOD],
        except where longer retention is required by law.
      </P>

      <H>7. Security</H>
      <P>
        We use technical and organizational measures (encryption in transit,
        access controls, row-level data isolation between accounts). No method of
        transmission or storage is completely secure.
      </P>

      <H>8. Your rights</H>
      <P>
        Depending on your location, you may have rights to access, correct, delete,
        port, or restrict processing of your personal data, and to object or withdraw
        consent. To exercise these, contact {CONTACT}. You may also have the right to
        lodge a complaint with a supervisory authority.
      </P>

      <H>9. International transfers</H>
      <P>
        Your data may be processed in countries other than yours. Where required, we
        rely on appropriate safeguards such as Standard Contractual Clauses. [Confirm
        with counsel.]
      </P>

      <H>10. Children</H>
      <P>The Service is not directed to children under 16, and we do not knowingly collect their data.</P>

      <H>11. Cookies</H>
      <P>
        We use strictly necessary cookies for authentication and session management.
        [Update if you add analytics/marketing cookies, and add a cookie banner if
        required in your jurisdiction.]
      </P>

      <H>12. Changes</H>
      <P>We may update this Policy; we will post the new effective date and, for material changes, notify you.</P>

      <H>13. Contact</H>
      <P>Privacy questions: {CONTACT} · {ENTITY}, {ADDRESS}.</P>
    </article>
  );
}
