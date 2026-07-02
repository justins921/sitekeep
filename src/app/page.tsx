import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import {
  Badge,
  ButtonLink,
  Card,
  StarRating,
  Spark,
  Avatar,
} from "@/components/ui";

const SERVICES = [
  {
    title: "Page Speed",
    body: "Save time with one-click speed checks.",
    tint: "blue" as const,
  },
  {
    title: "Traffic",
    body: "Showcase growth with clear traffic insights.",
    tint: "violet" as const,
  },
  {
    title: "Security",
    body: "Give clients peace of mind with automated security checks.",
    tint: "green" as const,
  },
];

const STEPS = [
  {
    step: "Step 1",
    title: "Add your client",
    body: "Onboard clients in seconds. No more back-and-forth emails.",
    tint: "blue" as const,
  },
  {
    step: "Step 2",
    title: "Select your services",
    body: "Show your clients exactly what they're getting.",
    tint: "violet" as const,
  },
  {
    step: "Step 3",
    title: "Generate dashboard",
    body: "Turn your hard work into a visual story your clients actually value.",
    tint: "pink" as const,
  },
  {
    step: "Step 4",
    title: "Get monthly revenue",
    body: "Deliver monthly to keep clients happy and your revenue growing.",
    tint: "green" as const,
  },
];

const FEATURES = [
  {
    title: "Automate reports",
    body: "Free yourself from hours of copying, pasting, and formatting reports. Activate, set the schedule, done!",
  },
  {
    title: "Customize dashboard",
    body: "Add notes, hide/show insights. Be in control of what your client sees so they feel it's built just for them.",
  },
  {
    title: "White label",
    body: "Deliver fully branded dashboards and reports under your agency's name so you can build trust and stand out.",
  },
  {
    title: "Centralize insights",
    body: "All your client performance metrics in one place so you can save the time spent juggling between tools.",
  },
  {
    title: "Manage client requests",
    body: "No more digging through endless email threads. One convenient board to keep all client requests organized.",
    soon: true,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We've cut our maintenance time in half! SiteKeep's automated updates and customizable dashboards have given us more time to focus on projects.",
    name: "Sebastian Speier",
    org: "DesignCode",
  },
  {
    quote:
      "SiteKeep is the ultimate maintenance solution. We've saved time and built stronger relationships with our clients.",
    name: "Maya Chen",
    org: "Studio Field",
  },
  {
    quote:
      "Our team loves SiteKeep! It helps us demonstrate the value of our services in a way clients understand. They appreciate the transparency.",
    name: "Tom Rivera",
    org: "Northlight",
  },
];

const FAQS = [
  {
    q: "Who is this for?",
    a: "Whether you're an independent freelancer or an established agency, if you manage client websites, SiteKeep is built for you.",
  },
  {
    q: "How is this different from other ‘time-saving’ tools?",
    a: "Instead of adding complexity, SiteKeep removes it. It automates repetitive tasks like report formatting and client request tracking, giving you more time to focus on what matters most.",
  },
  {
    q: "Will this work with the platforms I already use?",
    a: "Yes! Whether you use Webflow, WordPress, Framer, or any other builder, SiteKeep fits right into your workflow.",
  },
  {
    q: "Does it work for multiple clients?",
    a: "Yes! SiteKeep grows with you. Whether it's 1 client or 50, you can manage them all from a single dashboard.",
  },
  {
    q: "Can I cancel?",
    a: "Cancel anytime right from your SiteKeep dashboard. Your plan will stay active until your billing cycle ends.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />

      {/* Hero */}
      <section className="bg-wash">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <div className="flex items-center justify-center gap-2">
            <Badge tone="orange">⏱️ BETA</Badge>
            <Badge tone="brand">50% off for the first 100</Badge>
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Website done. Client gone?{" "}
            <span className="text-brand">Not with SiteKeep.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-body">
            SiteKeep gives web designers &amp; agencies the tools to keep clients
            long after launch and monetize maintenance every month.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <ButtonLink href="/signup" size="lg" className="gap-2">
              <Spark className="h-5 w-5" /> Try for free today
            </ButtonLink>
            <p className="text-sm text-muted">No credit card required</p>
          </div>

          {/* Service preview cards */}
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {SERVICES.map((s) => (
              <Card key={s.title} tint={s.tint} className="p-6 text-left">
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-body">{s.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4 steps */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="brand">4 steps</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Earn predictable recurring revenue in just 4 steps
          </h2>
          <p className="mt-3 text-body">
            Onboard. Deliver. Impress. Get paid. SiteKeep gives you the tools to
            turn your website services into a reliable source of income.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <Card key={s.step} tint={s.tint} className="p-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                {s.step}
              </span>
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-body">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-canvas py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Recurring revenue for you. Recurring value for your clients.
            </h2>
            <p className="mt-3 text-body">
              Simplify client reporting and task management all in one tool.
              Impress your clients and grow your business while saving hours every
              month.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-6" hover>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  {f.soon && <Badge tone="neutral">Coming soon</Badge>}
                </div>
                <p className="mt-2 text-sm text-body">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            What designers are saying
          </h2>
          <p className="mt-3 text-body">
            Discover how others turned recurring problems into recurring revenue.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="flex flex-col p-6">
              <StarRating />
              <p className="mt-4 flex-1 text-sm text-body">“{t.quote}”</p>
              <div className="mt-5 flex items-center gap-3">
                <Avatar name={t.name} size={40} />
                <div>
                  <p className="text-sm font-semibold text-ink">{t.name}</p>
                  <p className="text-xs text-muted">{t.org}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-canvas py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="orange">Beta offer</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Pricing is a no-brainer
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Free */}
            <Card className="flex flex-col p-8">
              <h3 className="text-lg font-bold">One month free trial</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-ink">$0</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                1x dashboard · no credit card required
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-body">
                {[
                  "Branded client dashboard",
                  "Unlimited custom cards",
                  "Access to all available integrations",
                  "Email report automation",
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2">
                    <span className="text-accent-green">✓</span> {li}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href="/signup"
                variant="secondary"
                size="lg"
                className="mt-8 w-full"
              >
                Try free for a month
              </ButtonLink>
            </Card>

            {/* Paid */}
            <Card tint="blue" className="relative flex flex-col p-8 ring-2 ring-brand">
              <div className="absolute right-6 top-6">
                <Badge tone="magenta">50% off forever</Badge>
              </div>
              <h3 className="text-lg font-bold">Early adopter offer</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-ink">$3</span>
                <span className="text-lg text-faint line-through">$6</span>
                <span className="text-sm text-muted">per dashboard / month</span>
              </div>
              <p className="mt-1 text-sm text-muted">Limited offer · 100 spots only</p>
              <p className="mt-6 flex-1 text-sm text-body">
                Grab your spot now and lock in a price that&apos;s 2x lower for as
                long as you stay subscribed. You&apos;ll get all the upcoming
                features as the app grows.
              </p>
              <ButtonLink href="/signup" size="lg" className="mt-8 w-full">
                Claim discount now
              </ButtonLink>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your questions, answered
          </h2>
          <p className="mt-3 text-body">
            We&apos;ve covered the most common questions about SiteKeep. If you
            don&apos;t see yours, just ask.
          </p>
        </div>
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-[var(--radius-card)] border border-line bg-white p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-ink">
                {f.q}
                <span className="text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-body">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-wash">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Turn one-off projects into recurring revenue.
          </h2>
          <div className="mt-8">
            <ButtonLink href="/signup" size="lg" className="gap-2">
              <Spark className="h-5 w-5" /> Try for free today
            </ButtonLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
