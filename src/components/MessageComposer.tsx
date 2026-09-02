'use client';

import { useState } from 'react';

type ReplyAction = (formData: FormData) => void | Promise<void>;

export function MessageComposer({ ticketId, replyAction }: { ticketId: number; replyAction: ReplyAction }) {
  const [mode, setMode] = useState<'public' | 'note'>('public');

  return (
    <div className="composer">
      <div className="composer-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`composer-tab ${mode === 'public' ? 'active' : ''}`}
          onClick={() => setMode('public')}
        >
          Public reply
        </button>
        <button
          type="button"
          role="tab"
          className={`composer-tab ${mode === 'note' ? 'active' : ''}`}
          onClick={() => setMode('note')}
        >
          Internal note
        </button>
      </div>
      <div className="composer-body">
        <p className="composer-hint">
          {mode === 'public'
            ? 'Sent to the requester by email and visible in the portal thread.'
            : 'Visible to agents only. Never sent by email.'}
        </p>
        <form action={replyAction}>
          <input type="hidden" name="ticket_id" value={ticketId} />
          <input type="hidden" name="type" value={mode} key={mode} />
          <textarea name="body" required placeholder={mode === 'public' ? 'Write your reply…' : 'Add an internal note…'} />
          <button className="btn" type="submit">
            {mode === 'public' ? 'Send reply' : 'Add note'}
          </button>
        </form>
      </div>
    </div>
  );
}
