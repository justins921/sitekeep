"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Check,
  Gauge,
  Link2,
  Loader,
  Lock,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";
import { normalizeUrl } from "@/lib/utils";
import { scoreColor } from "@/lib/design-tokens";
import type { KeepDimension } from "@/lib/keep-score/score";
import type { ScanCheck, ScanResult } from "@/lib/scan/types";
import { ScoreDial } from "./ScoreDial";

type Phase = "input" | "scanning" | "result" | "quiz" | "plan";

const CHECK_ICONS: Record<KeepDimension, typeof Activity> = {
  uptime: Activity,
  performance: Gauge,
  ssl_domain: Lock,
  links: Link2,
  form: Activity,
};

const CHECK_SEQUENCE: { dimension: KeepDimension; label: string }[] = [
  { dimension: "uptime", label: "Checking if the site is up" },
  { dimension: "performance", label: "Measuring load speed" },
  { dimension: "ssl_domain", label: "Inspecting the SSL certificate" },
  { dimension: "links", label: "Sampling for broken links" },
];

const STATUS_COLOR: Record<ScanCheck["status"], string> = {
  good: "var(--color-keep)",
  warn: "var(--color-accent-orange)",
  bad: "var(--color-accent-red)",
  skipped: "var(--color-faint)",
};

function StatusIcon({ status }: { status: ScanCheck["status"] }) {
  const color = STATUS_COLOR[status];
  if (status === "good") return <Check className="h-4 w-4" style={{ color }} />;
  if (status === "bad") return <X className="h-4 w-4" style={{ color }} />;
  if (status === "warn") return <TriangleAlert className="h-4 w-4" style={{ color }} />;
  return <span className="text-xs text-faint">—</span>;
}

// -- Live-check animation ----------------------------------------------------

function ScanningView({ url, activeIndex }: { url: string; activeIndex: number }) {
  return (
    <div className="mx-auto max-w-md">
      <p className="text-center text-sm text-muted">Scanning</p>
      <p className="mt-1 text-center text-lg font-semibold text-ink">{url}</p>
      <ul className="mt-8 space-y-3">
        {CHECK_SEQUENCE.map((c, i) => {
          const Icon = CHECK_ICONS[c.dimension];
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={c.dimension}
              className={`flex items-center gap-3 rounded-xl border border-line px-4 py-3 transition-opacity ${
                i > activeIndex ? "opacity-40" : "opacity-100"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas-alt">
                <Icon className="h-4 w-4 text-muted" />
              </span>
              <span className="flex-1 text-sm text-body">{c.label}</span>
              {done ? (
                <Check className="h-4 w-4 text-keep" />
              ) : active ? (
                <Loader className="h-4 w-4 animate-spin text-brand" />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// -- Result breakdown --------------------------------------------------------

function ResultView({ result, onContinue }: { result: ScanResult; onContinue: () => void }) {
  const failing = result.checks.filter((c) => c.status === "warn" || c.status === "bad");
  return (
    <div className="mx-auto max-w-lg text-center">
      {result.unreachable ? (
        <p className="text-sm font-medium text-accent-red">
          We couldn&apos;t reach {result.host} — visitors may be seeing that too.
        </p>
      ) : (
        <p className="text-sm text-muted">Here&apos;s how {result.host} is doing today</p>
      )}

      <div className="mt-5 flex justify-center">
        <ScoreDial score={result.score} />
      </div>

      <ul className="mt-8 space-y-2 text-left">
        {result.checks.map((c) => (
          <li key={c.dimension} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex items-center gap-3">
              <StatusIcon status={c.status} />
              <span className="flex-1 text-sm font-medium text-ink">{c.label}</span>
              <span
                className="num text-sm font-semibold"
                style={{ color: c.subscore == null ? "var(--color-faint)" : scoreColor(c.subscore) }}
              >
                {c.subscore ?? "—"}
              </span>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted">{c.detail}</p>
            {c.insight && (
              <p className="mt-1 pl-7 text-xs text-accent-orange">{c.insight}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <Button size="lg" onClick={onContinue} className="w-full gap-2">
          {failing.length > 0
            ? `Fix ${failing.length} issue${failing.length === 1 ? "" : "s"} — keep this site healthy`
            : "Keep this site healthy"}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-2 text-xs text-muted">Two quick questions and your plan is ready.</p>
      </div>
    </div>
  );
}

// -- Two-question quiz -------------------------------------------------------

type Quiz = { sites: string | null; worry: string | null };

const SITE_OPTIONS = [
  { value: "1", label: "Just this one" },
  { value: "2-3", label: "2–3 sites" },
  { value: "4+", label: "4 or more" },
];
const WORRY_OPTIONS = [
  { value: "downtime", label: "Downtime & outages" },
  { value: "speed", label: "Slow performance" },
  { value: "security", label: "SSL & security lapses" },
  { value: "proof", label: "Showing clients the value" },
];

function QuizView({
  quiz,
  setQuiz,
  onDone,
}: {
  quiz: Quiz;
  setQuiz: (q: Quiz) => void;
  onDone: () => void;
}) {
  const complete = quiz.sites && quiz.worry;
  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-center text-xl font-bold tracking-tight text-ink">
        Let&apos;s tailor your plan
      </h2>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink">How many client sites do you keep?</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {SITE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setQuiz({ ...quiz, sites: o.value })}
              className={`focus-ring rounded-xl border px-3 py-3 text-sm transition-colors ${
                quiz.sites === o.value
                  ? "border-brand bg-brand-50 text-ink"
                  : "border-line text-body hover:border-brand-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink">What worries you most?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {WORRY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setQuiz({ ...quiz, worry: o.value })}
              className={`focus-ring rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                quiz.worry === o.value
                  ? "border-brand bg-brand-50 text-ink"
                  : "border-line text-body hover:border-brand-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-8">
        <Button size="lg" onClick={onDone} disabled={!complete} className="w-full gap-2">
          See my plan <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// -- Personalized plan reveal ------------------------------------------------

const WORRY_COPY: Record<string, string> = {
  downtime: "We'll ping this site around the clock and alert you the moment it drops.",
  speed: "We'll track performance every day and flag regressions before clients notice.",
  security: "We'll watch the SSL certificate and warn you well before it expires.",
  proof: "Each week your clients get a branded recap showing the site stayed healthy.",
};

function PlanView({
  result,
  quiz,
  onStart,
  starting,
}: {
  result: ScanResult;
  quiz: Quiz;
  onStart: () => void;
  starting: boolean;
}) {
  const agency = quiz.sites === "4+";
  const plan = agency ? "Agency" : "Solo";
  const price = agency ? "$29" : "$12";
  const cap = agency ? "up to 15 sites" : "up to 3 sites";
  const worry = quiz.worry ? WORRY_COPY[quiz.worry] : null;

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-sm text-muted">Based on your answers, we recommend</p>
      <h2 className="mt-1 font-display text-3xl font-bold text-ink">{plan}</h2>

      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-left">
        <div className="flex items-baseline gap-2">
          <span className="num text-3xl font-bold text-ink">{price}</span>
          <span className="text-sm text-muted">/ month · {cap}</span>
        </div>
        {worry && <p className="mt-4 text-sm text-body">{worry}</p>}
        <ul className="mt-4 space-y-2 text-sm text-body">
          {[
            `${result.host} imported as your first site`,
            "Keep Score tracked and recomputed continuously",
            "Uptime, speed, SSL & broken-link monitoring",
            agency ? "White-label client dashboards & recaps" : "Client-ready weekly recap emails",
          ].map((li) => (
            <li key={li} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-keep" /> {li}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <Button size="lg" onClick={onStart} disabled={starting} className="w-full gap-2">
          {starting ? "Setting up…" : "Start monitoring"}
          {!starting && <ArrowRight className="h-4 w-4" />}
        </Button>
        <p className="mt-2 text-xs text-muted">14-day trial · card required · cancel anytime</p>
      </div>
    </div>
  );
}

// -- Orchestrator ------------------------------------------------------------

export function ScanExperience({ initialUrl }: { initialUrl?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [inputUrl, setInputUrl] = useState(initialUrl ?? "");
  const [scannedUrl, setScannedUrl] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quiz, setQuiz] = useState<Quiz>({ sites: initialUrl ? "1" : null, worry: null });
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);

  const startScan = useCallback(async (raw: string) => {
    const normalized = normalizeUrl(raw);
    if (!normalized) {
      setError("Enter a valid website address (e.g. example.com).");
      return;
    }
    setError(null);
    setScannedUrl(normalized);
    setActiveIndex(0);
    setPhase("scanning");

    // Advance the live-check animation on a timer while the real scan runs.
    let i = 0;
    const timer = setInterval(() => {
      i = Math.min(i + 1, CHECK_SEQUENCE.length - 1);
      setActiveIndex(i);
    }, 1400);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        clearInterval(timer);
        setError(data.error ?? "Something went wrong. Try again.");
        setPhase("input");
        return;
      }
      // Let the animation reach the last step before revealing the result.
      setActiveIndex(CHECK_SEQUENCE.length);
      clearInterval(timer);
      setResult(data as ScanResult);
      setTimeout(() => setPhase("result"), 500);
    } catch {
      clearInterval(timer);
      setError("We couldn't reach the scanner. Check your connection and try again.");
      setPhase("input");
    }
  }, []);

  // Auto-start when the landing page handed us a URL.
  useEffect(() => {
    if (initialUrl && !startedRef.current) {
      startedRef.current = true;
      void startScan(initialUrl);
    }
  }, [initialUrl, startScan]);

  function handleStart() {
    if (!result) return;
    setStarting(true);
    const params = new URLSearchParams({
      site: result.url,
      plan: quiz.sites === "4+" ? "agency" : "solo",
    });
    router.push(`/signup?${params.toString()}`);
  }

  return (
    <div className="min-h-[28rem]">
      {phase === "input" && (
        <form
          className="mx-auto max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            void startScan(inputUrl);
          }}
        >
          <label htmlFor="scan-url" className="text-sm font-medium text-ink">
            Enter a site to scan
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="scan-url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="yourclient.com"
              autoComplete="url"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <Button type="submit" size="lg" className="shrink-0 gap-2">
              Scan <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-accent-red">{error}</p>}
          <p className="mt-3 text-xs text-muted">Free, no signup — see the Keep Score in seconds.</p>
        </form>
      )}

      {phase === "scanning" && <ScanningView url={scannedUrl} activeIndex={activeIndex} />}

      {phase === "result" && result && (
        <ResultView result={result} onContinue={() => setPhase("quiz")} />
      )}

      {phase === "quiz" && (
        <QuizView quiz={quiz} setQuiz={setQuiz} onDone={() => setPhase("plan")} />
      )}

      {phase === "plan" && result && (
        <PlanView result={result} quiz={quiz} onStart={handleStart} starting={starting} />
      )}
    </div>
  );
}
