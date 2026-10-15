'use client';

import { useEffect, useMemo, useState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';

type ReplyAction = (formData: FormData) => void | Promise<void>;
type Mode = 'public' | 'note' | 'forward';

export type CannedOption = {
  id: number;
  title: string;
  shortcut: string | null;
  rendered: string;
};

const MODE_META: Record<Mode, { label: string; hint: string; submit: string; pending: string }> = {
  public: {
    label: 'Reply',
    hint: 'Visible to the requester · emailed · shown in the portal thread',
    submit: 'Send reply',
    pending: 'Sending…',
  },
  note: {
    label: 'Add note',
    hint: 'Agents only · never emailed · highlighted yellow in the timeline',
    submit: 'Add note',
    pending: 'Saving…',
  },
  forward: {
    label: 'Forward',
    hint: 'Send ticket context to another mailbox · logged as an internal note',
    submit: 'Forward',
    pending: 'Forwarding…',
  },
};

export function MessageComposer({
  ticketId,
  replyAction,
  canned = [],
  locked = false,
  initialMode = 'public',
  returnView = 'open',
}: {
  ticketId: number;
  replyAction: ReplyAction;
  canned?: CannedOption[];
  locked?: boolean;
  initialMode?: Mode;
  returnView?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [body, setBody] = useState('');
  const meta = MODE_META[mode];

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setBody('');
  }

  const cannedById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of canned) map.set(c.id, c.rendered);
    return map;
  }, [canned]);

  function applyCanned(id: string) {
    const n = Number(id);
    if (!n) return;
    const text = cannedById.get(n);
    if (!text) return;
    setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
  }

  if (locked) {
    return (
      <div className="composer composer-locked" id="composer">
        <p className="composer-hint">
          This ticket is locked by another agent. Use previous/next to keep working the queue, or wait
          until the lock expires.
        </p>
      </div>
    );
  }

  return (
    <div className={`composer composer-mode-${mode}`} id="composer">
      <div className="composer-tabs" role="tablist" aria-label="Composer mode">
        {(['public', 'forward', 'note'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`composer-tab composer-tab-${m}${mode === m ? ' active' : ''}`}
            onClick={() => switchMode(m)}
          >
            {MODE_META[m].label}
          </button>
        ))}
      </div>
      <div className="composer-body">
        <p className="composer-hint">{meta.hint}</p>
        {canned.length > 0 && mode !== 'forward' ? (
          <div className="composer-canned">
            <label htmlFor="canned_pick">Canned response</label>
            <select
              id="canned_pick"
              defaultValue=""
              onChange={(e) => {
                applyCanned(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">Insert template…</option>
              {canned.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.shortcut ? ` (::${c.shortcut})` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <form action={replyAction} key={mode}>
          <input type="hidden" name="ticket_id" value={ticketId} />
          <input type="hidden" name="type" value={mode} />
          <input type="hidden" name="return_view" value={returnView} />
          {mode === 'forward' ? (
            <>
              <label htmlFor="forward_to">Forward to</label>
              <input
                id="forward_to"
                name="forward_to"
                type="email"
                required
                placeholder="colleague@moglix.com"
                autoComplete="email"
              />
            </>
          ) : null}
          <label htmlFor="composer-body" className="sr-only">
            Message
          </label>
          <textarea
            id="composer-body"
            name="body"
            required
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              mode === 'public'
                ? 'Write your reply to the requester…'
                : mode === 'forward'
                  ? 'Add a note for the recipient…'
                  : 'Add an internal note for your team…'
            }
          />
          <div className="composer-actions">
            <SubmitButton
              className={mode === 'note' ? 'btn btn-note' : 'btn btn-fs-primary'}
              pendingLabel={meta.pending}
            >
              {meta.submit}
            </SubmitButton>
            {body.trim() ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBody('')}>
                Clear
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
