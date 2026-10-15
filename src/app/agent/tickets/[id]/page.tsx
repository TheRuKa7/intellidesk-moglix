import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmCloseButton } from '@/components/ConfirmCloseButton';
import { CategoryFields } from '@/components/CategoryFields';
import { FlashBanner } from '@/components/FlashBanner';
import { MessageBody } from '@/components/MessageBody';
import { MessageComposer } from '@/components/MessageComposer';
import { SubmitButton } from '@/components/SubmitButton';
import {
  AttachmentCard,
  Breadcrumb,
  PriorityPill,
  SlaMeter,
  StatusPill,
  UserAvatar,
} from '@/components/ui';
import { canViewTicket, requireStaffOrRedirect } from '@/lib/auth';
import { COMMERCE_FIELDS, PRIORITIES, STATUSES } from '@/lib/constants';
import { getAuditForTicket } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { formatDateTime, ticketDueBucket } from '@/lib/format';
import {
  agentCloseAction,
  agentLinkRelatedAction,
  agentMergeAction,
  agentPickupAction,
  agentReplyAction,
  agentTagAction,
  agentUpdateTicketAction,
  agentWatchAction,
} from '@/lib/ticket-actions';
import { getOutboxForTicket, getTicketById, listTickets } from '@/lib/tickets';
import { isWatching, listWatcherUsers } from '@/lib/platform';
import { applyCannedResponse, listCannedResponses } from '@/lib/canned-responses';
import { acquireTicketLock } from '@/lib/ticket-lock';
import { listLinkedTickets, listTicketTags } from '@/lib/ticket-relations';
import { TICKET_CATEGORIES } from '@/lib/privileges';

const STATUS_GROUPS = [
  { label: 'In progress', names: ['Open', 'Re-Open'] },
  { label: 'Waiting on requester', names: ['Pending'] },
  {
    label: 'Waiting on approval',
    names: [
      'Manager Approval Awaited',
      'BU Approval Awaited',
      'Finance Approval Awaited',
      'Treasury Action Awaited',
      'Supply Approval Awaited',
      'Approval Awaited',
      'Legal Action Awaited',
    ],
  },
  {
    label: 'Waiting on team',
    names: [
      'Waiting for Tech',
      'Waiting for catalog',
      'Waiting for category',
      'Pushed to SCM',
      'Plant Creation Action',
      'CL Action Awaited',
      'Documents Uploaded',
      'Plant Created',
      'AutoMap',
      'AutoMap False',
      'Invalid UTR',
    ],
  },
  { label: 'Parked', names: ['On Hold'] },
];

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'activity', label: 'Activity' },
  { id: 'resolution', label: 'Resolution' },
] as const;

const NOTICE_COPY: Record<string, string> = {
  created: 'Ticket created.',
  updated: 'Ticket properties saved.',
  replied: 'Reply sent to the requester.',
  noted: 'Internal note added.',
  forwarded: 'Ticket forwarded.',
  watched: 'You are watching this ticket.',
  unwatched: 'Stopped watching this ticket.',
  closed: 'Ticket closed.',
  resolved: 'Ticket marked resolved.',
  picked_up: 'Ticket assigned to you.',
  merged: 'Ticket merge completed.',
  linked: 'Related ticket linked.',
};

export default async function AgentTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
    tab?: string;
    notice?: string;
    composer?: string;
    view?: string;
  }>;
}) {
  const user = await requireStaffOrRedirect();
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as (typeof TABS)[number]['id']) : 'details';
  const ticket = getTicketById(Number(id));
  if (!ticket || !canViewTicket(user, ticket as never)) notFound();

  const lockResult = acquireTicketLock(ticket.id as number, user.id);
  const lockBlocked = 'blocked' in lockResult && lockResult.blocked;
  const activeLock = lockResult.lock;

  const agents = getDb()
    .prepare("SELECT id, name FROM users WHERE role IN ('agent', 'supervisor', 'admin') AND active = 1")
    .all() as { id: number; name: string }[];
  const activity = getAuditForTicket(ticket.id as number);
  const outbound = getOutboxForTicket(ticket.id as number);
  const messages = ticket.messages as Record<string, unknown>[];
  const firstPublic = messages.find((m) => m.type === 'public');
  const descriptionHtml = (firstPublic?.body_html as string | null | undefined) ?? null;
  const customFields = ticket.custom_fields as Record<string, string>;
  const attachments = ticket.attachments as {
    id: number;
    filename: string;
    storage_key: string | null;
    size_bytes?: number | null;
  }[];
  const scopeGroup = user.role === 'agent' ? user.group_name ?? undefined : undefined;
  const queueView = sp.view ?? 'open';
  let queueTickets = listTickets({
    groupName: scopeGroup,
    assigneeId: queueView === 'mine' ? user.id : undefined,
    overdueOnly: queueView === 'overdue',
    unassignedOnly: queueView === 'unassigned',
  });
  if (queueView === 'open') {
    queueTickets = queueTickets.filter((t) => t.status_category !== 'done');
  }
  if (queueView === 'due_today') {
    queueTickets = queueTickets.filter((t) => {
      const bucket = ticketDueBucket({
        statusCategory: t.status_category as string,
        slaClock: t.sla_clock as string,
        respondBy: t.respond_by as string | null,
        resolveBy: t.resolve_by as string | null,
        firstResponseAt: t.first_response_at as string | null,
        resolvedAt: t.resolved_at as string | null,
      });
      return bucket === 'today';
    });
  }
  const queueIdx = queueTickets.findIndex((t) => t.id === ticket.id);
  const prev = queueIdx > 0 ? queueTickets[queueIdx - 1] : null;
  const next =
    queueIdx >= 0 && queueIdx < queueTickets.length - 1 ? queueTickets[queueIdx + 1] : null;
  const watching = isWatching(ticket.id as number, user.id);
  const watchers = listWatcherUsers(ticket.id as number);
  const tags = listTicketTags(ticket.id as number);
  const links = listLinkedTickets(ticket.id as number);
  const cannedRaw = listCannedResponses(ticket.group_name as string);
  const canned = cannedRaw.map((c) => ({
    id: c.id,
    title: c.title,
    shortcut: c.shortcut,
    rendered:
      applyCannedResponse({
        cannedId: c.id,
        displayNumber: String(ticket.display_number),
        subject: String(ticket.subject),
        requesterName: (ticket.requester as { name: string }).name,
        agentName: user.name,
      }) ?? c.body,
  }));
  const mergedIntoId = (ticket as { merged_into_id?: number | null }).merged_into_id;
  const mergedInto = mergedIntoId ? getTicketById(mergedIntoId) : null;
  const composerMode =
    sp.composer === 'note' ? 'note' : sp.composer === 'forward' ? 'forward' : 'public';
  const navQs = queueView !== 'open' ? `?view=${queueView}` : '';
  const viewQs = queueView !== 'open' ? `&view=${queueView}` : '';
  const returnViewField = () => (
    <input type="hidden" name="return_view" value={queueView} />
  );
  const requester = ticket.requester as {
    name: string;
    email: string;
    department?: string;
  };
  const isDone = ['Resolved', 'Interim Resolve', 'Closed'].includes(ticket.status.name);
  const basePath = `/agent/tickets/${ticket.id}`;
  const notice =
    sp.notice && NOTICE_COPY[sp.notice]
      ? NOTICE_COPY[sp.notice]
      : sp.saved === '1'
        ? NOTICE_COPY.updated
        : null;

  const propertyStatusGroups = [
    ...STATUS_GROUPS,
    ...(isDone
      ? [{ label: 'Done', names: [ticket.status.name] as string[] }]
      : []),
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Tickets', href: `/agent${navQs}` },
          { label: `#${ticket.display_number as string}` },
        ]}
      />
      {notice ? <FlashBanner variant="success">{notice}</FlashBanner> : null}
      {sp.error === 'resolution' ? (
        <FlashBanner variant="warn">Resolution note is required when resolving a ticket.</FlashBanner>
      ) : null}
      {sp.error === 'forward' ? (
        <FlashBanner variant="warn">Enter a valid forward-to email address.</FlashBanner>
      ) : null}
      {sp.error === 'empty' ? (
        <FlashBanner variant="warn">Message body cannot be empty.</FlashBanner>
      ) : null}
      {sp.error === 'merge' || sp.error === 'link' ? (
        <FlashBanner variant="warn">Could not merge/link — check the ticket number and try again.</FlashBanner>
      ) : null}
      {mergedIntoId ? (
        <FlashBanner variant="info">
          This ticket was merged into{' '}
          <Link href={`/agent/tickets/${mergedIntoId}`}>
            {(mergedInto?.display_number as string) ?? `INC-${mergedIntoId}`}
          </Link>
          . Open the target for the live conversation.
        </FlashBanner>
      ) : null}
      {lockBlocked ? (
        <FlashBanner variant="warn">
          Locked by {activeLock.user_name ?? 'another agent'} until{' '}
          {formatDateTime(activeLock.expires_at)}. Composer is read-only.
        </FlashBanner>
      ) : null}

      <div className="fs-ticket-header">
        <div className="fs-ticket-header-main">
          <div className="fs-ticket-id-row">
            <span className="fs-ticket-id">{ticket.display_number as string}</span>
            <StatusPill status={ticket.status.name} breached={!!ticket.sla_breached} />
            <PriorityPill priority={(ticket.priority as string) || 'Low'} />
            {(ticket.source as string) === 'email' ? (
              <span className="pill pill-neutral">via Email</span>
            ) : (
              <span className="pill pill-neutral">via {(ticket.source as string) || 'Portal'}</span>
            )}
          </div>
          <h1 className="fs-ticket-subject">{ticket.subject as string}</h1>
          <p className="fs-ticket-meta">
            {requester.name} · reported {formatDateTime(ticket.created_at as string)}
            {ticket.group_name ? ` · ${ticket.group_name as string}` : ''}
          </p>
        </div>
        <div className="fs-ticket-actions ticket-header-actions" role="toolbar" aria-label="Ticket actions">
          {!ticket.assignee_id ? (
            <form action={agentPickupAction}>
              <input type="hidden" name="ticket_id" value={ticket.id as number} />
              {returnViewField()}
              <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Picking up…">
                Pick up
              </SubmitButton>
            </form>
          ) : null}
          <Link
            className="btn btn-fs-primary btn-sm"
            href={`${basePath}?tab=details&composer=public${viewQs}#composer`}
          >
            Reply
          </Link>
          <Link
            className="btn btn-ghost btn-sm"
            href={`${basePath}?tab=details&composer=note${viewQs}#composer`}
          >
            Note
          </Link>
          {!isDone ? (
            <Link className="btn btn-ghost btn-sm" href={`${basePath}?tab=resolution${viewQs}`}>
              Resolve
            </Link>
          ) : null}
          {ticket.status.name !== 'Closed' ? (
            <ConfirmCloseButton
              ticketId={ticket.id as number}
              action={agentCloseAction}
              returnView={queueView}
            />
          ) : null}
          <form action={agentWatchAction}>
            <input type="hidden" name="ticket_id" value={ticket.id as number} />
            <input type="hidden" name="watch" value={watching ? '0' : '1'} />
            {returnViewField()}
            <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Saving…">
              {watching ? 'Unwatch' : 'Watch'}
            </SubmitButton>
          </form>
          <span className="fs-ticket-nav" aria-label="Queue navigation">
            {prev ? (
              <Link
                className="btn btn-ghost btn-sm"
                href={`/agent/tickets/${prev.id}${navQs}`}
                title="Previous in queue"
              >
                ←
              </Link>
            ) : (
              <span className="btn btn-ghost btn-sm" aria-disabled>
                ←
              </span>
            )}
            {next ? (
              <Link
                className="btn btn-ghost btn-sm"
                href={`/agent/tickets/${next.id}${navQs}`}
                title="Next in queue"
              >
                →
              </Link>
            ) : (
              <span className="btn btn-ghost btn-sm" aria-disabled>
                →
              </span>
            )}
          </span>
        </div>
      </div>

      {(ticket.source as string) === 'email' || ticket.mailbox || ticket.cc ? (
        <div className="ticket-mail-meta">
          {ticket.mailbox ? (
            <span>
              <strong>To:</strong> {ticket.mailbox as string}
            </span>
          ) : null}
          {ticket.cc ? (
            <span>
              <strong>Cc:</strong> {ticket.cc as string}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="workbench">
        <div className="workbench-main">
          <div className="ticket-tabs" role="tablist">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={`${basePath}?tab=${t.id}${viewQs}`}
                className={`ticket-tab${tab === t.id ? ' active' : ''}`}
                role="tab"
                aria-selected={tab === t.id}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {tab === 'details' ? (
            <div className="card card-elevated fs-ticket-body">
              <h3 className="card-title">Description</h3>
              <div className="msg public msg-description">
                <div className="meta">Original request · {formatDateTime(ticket.created_at as string)}</div>
                <MessageBody
                  body={ticket.description as string}
                  bodyHtml={descriptionHtml}
                />
              </div>
              {attachments.length > 0 ? (
                <div className="attachment-grid">
                  <span className="field-label">Attachments ({attachments.length})</span>
                  <div className="attachment-list">
                    {attachments.map((a) => (
                      <AttachmentCard
                        key={a.id}
                        id={a.id}
                        filename={a.filename}
                        sizeBytes={a.size_bytes}
                        storageKey={a.storage_key}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              <h3 className="card-title">Conversation</h3>
              <div className="thread">
                {(() => {
                  const firstPublicId = messages.find((m) => m.type === 'public')?.id;
                  const conversation = messages.filter((m) => m.id !== firstPublicId);
                  if (conversation.length === 0) {
                    return (
                      <p className="field-hint thread-empty">
                        No replies yet. Use Reply to email the requester, or Add note for your team.
                      </p>
                    );
                  }
                  return conversation.map((m) => {
                    const isNote = m.type === 'note';
                    const fromRequester = m.author_id === ticket.requester_id;
                    return (
                      <div
                        key={m.id as number}
                        className={`msg ${isNote ? 'note' : 'public'}${fromRequester && !isNote ? ' msg-inbound' : ''}${!fromRequester && !isNote ? ' msg-outbound' : ''}`}
                      >
                        <div className="meta">
                          <span className="msg-author">
                            {(m.author_name as string) ?? 'System'}
                          </span>
                          <span>
                            · {isNote ? 'Internal note' : fromRequester ? 'Requester' : 'Public reply'} ·{' '}
                            {formatDateTime(m.created_at as string)}
                            {m.body_html ? ' · Email' : ''}
                          </span>
                        </div>
                        <MessageBody
                          body={m.body as string}
                          bodyHtml={m.body_html as string | null}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
              <MessageComposer
                ticketId={ticket.id as number}
                replyAction={agentReplyAction}
                canned={canned}
                locked={lockBlocked}
                initialMode={composerMode}
                returnView={queueView}
              />
            </div>
          ) : null}

          {tab === 'activity' ? (
            <div className="card card-elevated" id="activity">
              <h3 className="card-title">Activity</h3>
              {activity.length === 0 ? (
                <p className="field-hint">No activity recorded yet.</p>
              ) : (
                <ul className="activity-list">
                  {activity.map((a) => (
                    <li key={a.id as number} className="activity-item">
                      <strong>{a.action as string}</strong>
                      {a.detail ? ` — ${a.detail as string}` : ''}
                      <div className="activity-meta">
                        {(a.actor_name as string) ?? 'System'} · {formatDateTime(a.created_at as string)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="card-title" style={{ marginTop: 24 }}>
                Outbound email
              </h3>
              {outbound.length === 0 ? (
                <p className="field-hint">No lifecycle mail queued for this ticket yet.</p>
              ) : (
                <ul className="activity-list">
                  {outbound.map((m) => (
                    <li key={m.id as number} className="activity-item">
                      <strong>{m.event as string}</strong> → {m.to_addr as string}
                      <div className="activity-meta">
                        {m.subject as string} · {formatDateTime(m.sent_at as string)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === 'resolution' ? (
            <div className="card card-elevated">
              <h3 className="card-title">Resolution</h3>
              <p className="field-hint" style={{ marginBottom: 12 }}>
                Primary finish path: add a resolution note and mark resolved (emails the requester
                and alerts watchers). Close ends the ticket — prefer resolve first unless you mean
                to close immediately.
              </p>
              <form action={agentUpdateTicketAction}>
                <input type="hidden" name="ticket_id" value={ticket.id as number} />
                <input type="hidden" name="status" value="Resolved" />
                {returnViewField()}
                <label htmlFor="resolution_note_tab">Resolution note</label>
                <textarea
                  id="resolution_note_tab"
                  name="resolution_note"
                  defaultValue={(ticket.resolution_note as string) ?? ''}
                  placeholder="Required when marking Resolved"
                  rows={6}
                />
                <div className="page-actions" style={{ marginTop: 8 }}>
                  <SubmitButton pendingLabel="Resolving…">Mark resolved</SubmitButton>
                </div>
              </form>
              {ticket.status.name !== 'Closed' ? (
                <div style={{ marginTop: 12 }}>
                  <ConfirmCloseButton
                    ticketId={ticket.id as number}
                    action={agentCloseAction}
                    returnView={queueView}
                  />
                </div>
              ) : null}
              {(ticket.resolved_at as string) ? (
                <p className="field-hint" style={{ marginTop: 16 }}>
                  Resolved at {formatDateTime(ticket.resolved_at as string)}
                  {(ticket.closed_at as string)
                    ? ` · Closed at ${formatDateTime(ticket.closed_at as string)}`
                    : ''}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="workbench-side">
          <div className="card card-elevated">
            <div className="sla-status-head">
              <StatusPill status={ticket.status.name} breached={!!ticket.sla_breached} />
              <PriorityPill priority={(ticket.priority as string) || 'Low'} />
            </div>
            <h3 className="card-title" style={{ marginTop: 12 }}>
              SLA
            </h3>
            <SlaMeter
              respondBy={ticket.respond_by as string | null}
              resolveBy={ticket.resolve_by as string | null}
              firstResponseAt={ticket.first_response_at as string | null}
              resolvedAt={ticket.resolved_at as string | null}
              slaClock={ticket.status.sla_clock}
              breached={!!ticket.sla_breached}
            />
            {ticket.sla_breached ? (
              <form action={agentUpdateTicketAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="ticket_id" value={ticket.id as number} />
                {returnViewField()}
                <label htmlFor="breach_reason">Breach reason</label>
                <input
                  id="breach_reason"
                  name="breach_reason"
                  defaultValue={(ticket.breach_reason as string) ?? ''}
                  placeholder="Why was SLA missed?"
                />
                <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Saving…">
                  Save reason
                </SubmitButton>
              </form>
            ) : null}
          </div>

          <div className="card card-elevated requester-card" id="requester">
            <h3 className="card-title">Requester</h3>
            <div className="requester-card-body">
              <UserAvatar name={requester.name} size="lg" />
              <div>
                <strong>{requester.name}</strong>
                <p className="field-hint" style={{ margin: '2px 0 0' }}>
                  {requester.department ?? 'Employee'}
                </p>
              </div>
            </div>
            <dl className="requester-details">
              <div>
                <dt>Email</dt>
                <dd>
                  <a className="inline-link" href={`mailto:${requester.email}`}>
                    {requester.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{requester.department ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="card card-elevated">
            <h3 className="card-title">Properties</h3>
            <form action={agentUpdateTicketAction}>
              <input type="hidden" name="ticket_id" value={ticket.id as number} />
              {returnViewField()}
              <label htmlFor="priority">Priority</label>
              <select id="priority" name="priority" defaultValue={(ticket.priority as string) || 'Low'}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <CategoryFields
                categories={TICKET_CATEGORIES}
                defaultCategory={(ticket.category as string) ?? ''}
                defaultSubcategory={(ticket.subcategory as string) ?? ''}
              />
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={ticket.status.name}>
                {propertyStatusGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {STATUSES.filter((s) => g.names.includes(s.name)).map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="field-hint">
                Work statuses only here. To resolve or close, use the{' '}
                <Link href={`${basePath}?tab=resolution${viewQs}`}>Resolution</Link> tab.
              </p>
              <label htmlFor="source_display">Source</label>
              <input id="source_display" value={ticket.source as string} readOnly disabled />
              <label htmlFor="assignee_id">Agent</label>
              <select
                id="assignee_id"
                name="assignee_id"
                defaultValue={ticket.assignee_id ? String(ticket.assignee_id) : ''}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <label htmlFor="group_display">Group</label>
              <input id="group_display" value={ticket.group_name as string} readOnly disabled />
              <div className="form-section">
                <h3 className="form-section-title">Commerce fields</h3>
                {COMMERCE_FIELDS.map((field) => (
                  <div key={field}>
                    <label htmlFor={field}>{field.replace(/_/g, ' ')}</label>
                    <input
                      id={field}
                      name={field}
                      defaultValue={
                        field === 'support_team'
                          ? ((ticket.support_team as string) ?? customFields[field] ?? '')
                          : (customFields[field] ?? '')
                      }
                    />
                  </div>
                ))}
              </div>
              <SubmitButton style={{ width: '100%' }} pendingLabel="Saving…">
                Update ticket
              </SubmitButton>
            </form>
          </div>

          <div className="card card-elevated">
            <h3 className="card-title">Watchers</h3>
            {watchers.length === 0 ? (
              <p className="field-hint">No watchers yet. Use Watch to follow public replies, resolve, and assign events.</p>
            ) : (
              <ul className="activity-list">
                {watchers.map((w) => (
                  <li key={w.id} className="activity-item">
                    <strong>{w.name}</strong>
                    <div className="activity-meta">{w.email}</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="field-hint" style={{ marginTop: 8 }}>
              Watchers get in-app alerts on public reply, resolve, close, and reassignment.
            </p>
          </div>

          <div className="card card-elevated">
            <h3 className="card-title">Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {tags.map((t) => (
                <form key={t.id} action={agentTagAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="ticket_id" value={ticket.id as number} />
                  <input type="hidden" name="remove_tag" value={t.id} />
                  {returnViewField()}
                  <button type="submit" className="pill pill-neutral" title="Remove tag">
                    {t.name} ×
                  </button>
                </form>
              ))}
            </div>
            <form action={agentTagAction} className="stacked-form">
              <input type="hidden" name="ticket_id" value={ticket.id as number} />
              {returnViewField()}
              <input name="tag" placeholder="Add tag (e.g. vpn)" />
              <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                Add tag
              </SubmitButton>
            </form>
          </div>

          <div className="card card-elevated">
            <h3 className="card-title">Related / merge</h3>
            {links.length > 0 ? (
              <ul className="activity-list">
                {links.map((l) => (
                  <li key={`${l.type}-${l.other_id}`} className="activity-item">
                    <strong>{l.type}</strong>{' '}
                    <Link href={`/agent/tickets/${l.other_id}`}>{l.other_display}</Link>
                    <div className="activity-meta">{l.other_subject}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">No linked tickets yet.</p>
            )}
            {!mergedIntoId && !isDone ? (
              <>
                <form action={agentLinkRelatedAction} className="stacked-form" style={{ marginTop: 12 }}>
                  <input type="hidden" name="ticket_id" value={ticket.id as number} />
                  {returnViewField()}
                  <label htmlFor="related_to">Link related</label>
                  <input id="related_to" name="related_to" placeholder="INC-… or ticket id" />
                  <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                    Link
                  </SubmitButton>
                </form>
                <form action={agentMergeAction} className="stacked-form" style={{ marginTop: 12 }}>
                  <input type="hidden" name="ticket_id" value={ticket.id as number} />
                  {returnViewField()}
                  <label htmlFor="merge_into">Merge this ticket into</label>
                  <input id="merge_into" name="merge_into" placeholder="Target INC-… or id" />
                  <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Merging…">
                    Merge
                  </SubmitButton>
                  <p className="field-hint">Moves conversation into the target ticket.</p>
                </form>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
