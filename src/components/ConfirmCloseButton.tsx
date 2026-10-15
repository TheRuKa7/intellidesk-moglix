'use client';

import { useState, useTransition } from 'react';
import { SubmitButton } from '@/components/SubmitButton';

type CloseAction = (formData: FormData) => void | Promise<void>;

export function ConfirmCloseButton({
  ticketId,
  action,
  returnView = 'open',
}: {
  ticketId: number;
  action: CloseAction;
  returnView?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Close
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await action(fd);
        });
      }}
      className="confirm-close"
    >
      <input type="hidden" name="ticket_id" value={ticketId} />
      <input type="hidden" name="return_view" value={returnView} />
      <span className="confirm-close-copy">Close without resolving?</span>
      <SubmitButton className="btn btn-sm btn-danger" pendingLabel="Closing…" disabled={pending}>
        Confirm close
      </SubmitButton>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
