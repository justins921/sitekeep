import { NextResponse } from "next/server";
import { renderRecapEmail } from "@/lib/keep-score/recap-email";
import type { RecapData } from "@/lib/keep-score/recap";
import type { WeekStatus } from "@/lib/keep-score/score";

export const runtime = "nodejs";

// Dev-only: render the weekly recap email with representative sample data so it
// can be previewed in a browser. Returns 404 in production.

function weeks(pattern: WeekStatus[]): RecapData["sites"][number]["overview"]["weeks"] {
  return pattern.map((status, i) => ({
    weekStart: `2026-0${1 + Math.floor(i / 4)}-0${(i % 4) + 1}`,
    status,
    score: status === "none" ? null : status === "green" ? 94 : status === "amber" ? 82 : 61,
  }));
}

const G: WeekStatus = "green";
const A: WeekStatus = "amber";
const R: WeekStatus = "red";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sample: RecapData = {
    agency: { id: "demo", name: "Northlight Studio", brandColor: "#4c8dff", logoUrl: null },
    weekLabel: "week of Jul 7",
    sites: [
      {
        id: "1",
        name: "Fox Valley Dental",
        url: "https://foxvalleydental.com",
        slug: "fox-valley",
        delta: 2,
        overview: {
          weeks: weeks([G, G, G, G, G, G, G, G, G, G, G, G]),
          keepScore: 94,
          status: "green",
          streak: { chainWeeks: 12, previousBest: 12, brokeRecently: false },
          incidentFreeDays: 84,
        },
      },
      {
        id: "2",
        name: "Apollo Fitness",
        url: "https://apollofitness.io",
        slug: "apollo",
        delta: -6,
        overview: {
          weeks: weeks([G, G, G, G, G, G, G, G, G, R, A, A]),
          keepScore: 82,
          status: "amber",
          streak: { chainWeeks: 2, previousBest: 9, brokeRecently: false },
          incidentFreeDays: 14,
        },
      },
      {
        id: "3",
        name: "Rivera Law",
        url: "https://riveralaw.com",
        slug: "rivera",
        delta: null,
        overview: {
          weeks: weeks([G, G, A, G, G, G, G, G, G, G, G, G]),
          keepScore: 96,
          status: "green",
          streak: { chainWeeks: 10, previousBest: 10, brokeRecently: false },
          incidentFreeDays: 70,
        },
      },
    ],
    rollup: {
      siteCount: 3,
      healthy: 2,
      avgScore: 91,
      incidentsResolved: 1,
      bestStreak: 12,
      allGreen: false,
    },
  };

  const { html } = renderRecapEmail(sample, {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
