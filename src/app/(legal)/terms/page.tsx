import type { Metadata } from "next";

// ⚠️ TEMPLATE ONLY — NOT LEGAL ADVICE. This is starter scaffold content that
// MUST be reviewed and completed by a qualified attorney before public launch.
// Fill in every [BRACKETED] placeholder (legal entity, contact, effective date,
// governing law) and adjust clauses to your actual business and jurisdiction.

export const metadata: Metadata = {
  title: "Terms of Service — SiteKeep",
  robots: { index: false },
};

const ENTITY = "[LEGAL ENTITY NAME]";
const CONTACT = "[CONTACT EMAIL]";
const EFFECTIVE = "[EFFECTIVE DATE]";
const LAW = "[GOVERNING LAW / JURISDICTION]";
const ADDRESS = "[COMPANY ADDRESS]";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-lg font-bold text-ink">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-body">{children}</p>;
}

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Effective date: {EFFECTIVE}</p>

      <div className="mt-4 rounded-xl bg-fill-blue px-4 py-3 text-xs text-brand">
        Template placeholder — this document must be reviewed by legal counsel and
        the bracketed fields completed before launch.
      </div>

      <P>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use
        of SiteKeep (the &ldquo;Service&rdquo;), operated by {ENTITY}
        (&ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account or using the
        Service, you agree to these Terms and to our{" "}
        <a href="/privacy" className="text-brand hover:underline focus-ring">Privacy Policy</a>.
        If you do not agree, do not use the Service.
      </P>

      <H>1. The Service</H>
      <P>
        SiteKeep is a client-reporting and website-maintenance platform for
        agencies. It aggregates website metrics (performance, traffic, security,
        uptime), generates branded client dashboards and reports, and provides
        related tools. Features may change over time.
      </P>

      <H>2. Accounts &amp; eligibility</H>
      <P>
        You must be at least 18 and able to form a binding contract. You are
        responsible for your account credentials and all activity under your
        account, and for the accuracy of information you provide. You must promptly
        notify us of any unauthorized use.
      </P>

      <H>3. Subscriptions, billing &amp; payments</H>
      <P>
        Paid plans are billed on a per-dashboard basis (currently $3 per active
        dashboard per month), processed by our payment provider, Stripe. Your first
        dashboard may include a free trial period; additional dashboards are charged
        when added. Fees are billed in advance on a recurring basis and are
        non-refundable except as required by law. Subscriptions renew automatically
        until cancelled; you may cancel at any time and cancellation takes effect at
        the end of the current billing period. You are responsible for applicable
        taxes. We may change pricing on prospective notice.
      </P>

      <H>4. Acceptable use</H>
      <P>
        You agree not to misuse the Service, including: violating any law or
        third-party rights; uploading malware; attempting to access data that is not
        yours; reverse-engineering or scraping the Service; or using it to send spam.
        You are responsible for the websites and data you connect and for having the
        rights to do so.
      </P>

      <H>5. Client data &amp; third-party services</H>
      <P>
        The Service integrates third-party services on your behalf, including Google
        Analytics (GA4), Google PageSpeed Insights, and others. By connecting them
        you authorize us to access the relevant data to provide the Service, and you
        represent that you have the necessary rights and consents. Your use of those
        services is also subject to their terms. You are the controller of your
        clients&rsquo; data; we process it on your behalf as described in the Privacy
        Policy.
      </P>

      <H>6. Intellectual property</H>
      <P>
        We and our licensors own the Service and all related IP. We grant you a
        limited, non-exclusive, non-transferable right to use the Service. You retain
        ownership of content you upload (e.g., logos, notes); you grant us a license
        to host and process it to provide the Service.
      </P>

      <H>7. Disclaimers</H>
      <P>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind,
        to the fullest extent permitted by law. Metrics, uptime monitoring, and
        alerts are provided on a best-effort basis and may be delayed, incomplete, or
        inaccurate; do not rely on them as your sole source of truth for critical
        decisions.
      </P>

      <H>8. Limitation of liability</H>
      <P>
        To the maximum extent permitted by law, {ENTITY} will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or for
        lost profits or data. Our total liability for any claim will not exceed the
        amounts you paid us in the twelve months before the event giving rise to the
        claim.
      </P>

      <H>9. Indemnification</H>
      <P>
        You agree to indemnify and hold {ENTITY} harmless from claims arising out of
        your use of the Service, your content or client data, or your violation of
        these Terms or applicable law.
      </P>

      <H>10. Termination</H>
      <P>
        You may stop using the Service at any time. We may suspend or terminate
        access if you breach these Terms or to comply with law. On termination, your
        right to use the Service ends; certain provisions survive.
      </P>

      <H>11. Changes to these Terms</H>
      <P>
        We may update these Terms; material changes will be notified through the
        Service or by email. Continued use after changes take effect constitutes
        acceptance.
      </P>

      <H>12. Governing law</H>
      <P>
        These Terms are governed by the laws of {LAW}, without regard to conflict-of-law
        rules, and disputes will be resolved in the courts located there.
      </P>

      <H>13. Contact</H>
      <P>
        Questions about these Terms: {CONTACT} · {ENTITY}, {ADDRESS}.
      </P>
    </article>
  );
}
