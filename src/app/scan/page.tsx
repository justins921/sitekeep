import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ScanExperience } from "@/components/scan/ScanExperience";
import { normalizeUrl } from "@/lib/utils";

export const metadata = {
  title: "Scan your site — SiteKeep",
  description: "Get a free Keep Score for any website in seconds. No signup required.",
};

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const initialUrl = url ? (normalizeUrl(url) ?? undefined) : undefined;

  return (
    <>
      <SiteNav />
      <section className="bg-wash">
        <div className="mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-20">
          {!initialUrl && (
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Scan any site for its Keep Score
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-body">
                One number, 0–100, for how healthy a site is right now — uptime, speed, SSL, and
                broken links. See it before you sign up.
              </p>
            </div>
          )}
          <div className="rounded-[var(--radius-card-lg)] border border-line bg-surface p-6 shadow-soft-md sm:p-10">
            <ScanExperience initialUrl={initialUrl} />
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
