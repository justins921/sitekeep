"use client";

import { useActionState, useTransition } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { TeamRoster } from "@/lib/team";
import {
  inviteMemberAction,
  revokeInviteAction,
  removeMemberAction,
  type InviteState,
} from "./actions";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TeamManager({ roster }: { roster: TeamRoster }) {
  const isOwner = roster.my_role === "owner";
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteMemberAction,
    null,
  );

  return (
    <div className="space-y-10">
      {isOwner && (
        <Card className="p-6">
          <h2 className="text-base font-bold text-ink">Invite a teammate</h2>
          <p className="mt-1 text-sm text-muted">
            They&apos;ll get an email to join and can then manage clients and
            reports. Seats are free — billing stays per dashboard.
          </p>
          <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="teammate@example.com"
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </form>
          {state && "error" in state && (
            <p className="mt-2 text-sm text-accent-magenta">{state.error}</p>
          )}
          {state && "ok" in state && (
            <p className="mt-2 text-sm text-accent-green">{state.ok}</p>
          )}
        </Card>
      )}

      <section>
        <h2 className="text-base font-bold text-ink">Members</h2>
        <div className="mt-4 space-y-2">
          {roster.members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {m.email ?? "—"} {m.is_me && <span className="text-muted">(you)</span>}
                </p>
                <p className="text-xs text-muted">Joined {fmtDate(m.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={m.role === "owner" ? "brand" : "neutral"}>
                  {m.role === "owner" ? "Owner" : "Member"}
                </Badge>
                {isOwner && m.role !== "owner" && !m.is_me && (
                  <RemoveButton userId={m.user_id} />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isOwner && roster.invitations.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-ink">Pending invitations</h2>
          <div className="mt-4 space-y-2">
            {roster.invitations.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-canvas-alt/60 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{i.email}</p>
                  <p className="text-xs text-muted">
                    Invited {fmtDate(i.created_at)} · expires {fmtDate(i.expires_at)}
                  </p>
                </div>
                <RevokeButton inviteId={i.id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RemoveButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => removeMemberAction(userId))}
      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent-magenta hover:text-accent-magenta disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

function RevokeButton({ inviteId }: { inviteId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => revokeInviteAction(inviteId))}
      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent-magenta hover:text-accent-magenta disabled:opacity-50"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
