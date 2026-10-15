/**
 * Ticket search via Fuse.js (MIT) — prototype stand-in for Meilisearch index.
 * @see https://github.com/krisk/Fuse
 */
import Fuse from 'fuse.js';
import { listTickets } from './tickets';

export function searchTickets(
  query: string,
  filters: Parameters<typeof listTickets>[0] = {},
) {
  const q = query.trim();
  if (!q) return listTickets(filters);

  const tickets = listTickets({ ...filters, search: undefined });
  const fuse = new Fuse(tickets, {
    keys: [
      { name: 'display_number', weight: 0.3 },
      { name: 'subject', weight: 0.25 },
      { name: 'requester_name', weight: 0.15 },
      { name: 'requester_email', weight: 0.1 },
      { name: 'support_team', weight: 0.1 },
      { name: 'status_name', weight: 0.1 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
  });

  return fuse.search(q).map((r) => r.item);
}
