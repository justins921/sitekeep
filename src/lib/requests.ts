// Shared types + presentation metadata for the client request board. Kept free
// of server-only imports so client components can import it.

export const REQUEST_STATUSES = ["open", "in_progress", "done"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_META: Record<
  RequestStatus,
  { label: string; tone: "brand" | "orange" | "green" }
> = {
  open: { label: "Open", tone: "brand" },
  in_progress: { label: "In progress", tone: "orange" },
  done: { label: "Done", tone: "green" },
};

export type ClientRequest = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  priority: "low" | "medium" | "high" | null;
  submitted_by_email: string | null;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
};
