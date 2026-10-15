/**
 * Lifecycle notification templates via Handlebars (MIT).
 * Pattern matches Zammad/email desk template engines.
 * @see https://github.com/handlebars-lang/handlebars.js
 */
import Handlebars from 'handlebars';

const compiled = {
  ticket_created: Handlebars.compile(
    `Hello {{requesterName}},\n\nWe received your request {{displayNumber}}.\n\nSubject: {{subject}}\n\n{{description}}\n\nYou can reply to this email to add updates.\n\n— Moglix IntelliDesk`,
  ),
  team_notify: Handlebars.compile(
    `New {{source}} ticket {{displayNumber}} for {{groupName}}.\n\nSubject: {{subject}}\n\n{{description}}`,
  ),
  agent_reply: Handlebars.compile(
    `{{authorName}} replied on {{displayNumber}}:\n\n{{body}}\n\n— Moglix IntelliDesk`,
  ),
  requester_reply: Handlebars.compile(
    `{{authorName}} replied on {{displayNumber}}:\n\n{{body}}`,
  ),
  resolved: Handlebars.compile(
    `Your ticket {{displayNumber}} has been resolved.\n\nResolution:\n{{resolutionNote}}\n\nReply to reopen if you still need help.`,
  ),
  closed: Handlebars.compile(
    `Your ticket {{displayNumber}} is now closed.\n\nThank you for contacting Moglix support.`,
  ),
  assigned: Handlebars.compile(`You were assigned ticket {{displayNumber}}: {{subject}}`),
  sla_breach: Handlebars.compile(
    `SLA breached on {{displayNumber}}: {{subject}}\n\nPlease review and record a breach reason.`,
  ),
};

export type NotificationEvent = keyof typeof compiled;

export function renderNotification(event: NotificationEvent, data: Record<string, unknown>): string {
  const tpl = compiled[event];
  return tpl(data);
}

export function listNotificationEvents(): NotificationEvent[] {
  return Object.keys(compiled) as NotificationEvent[];
}
