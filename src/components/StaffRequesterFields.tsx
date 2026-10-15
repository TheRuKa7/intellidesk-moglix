'use client';

import { useState } from 'react';

type RequesterOption = { id: number; name: string; email: string };

/** Staff requester: pick from directory or create by email (phone/walk-up). */
export function StaffRequesterFields({ requesters }: { requesters: RequesterOption[] }) {
  const [mode, setMode] = useState<'existing' | 'new'>(requesters.length ? 'existing' : 'new');

  return (
    <>
      <div className="form-row">
        <label>Requester *</label>
        <div className="page-actions" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'existing' ? '' : 'btn-ghost'}`}
            onClick={() => setMode('existing')}
            disabled={requesters.length === 0}
          >
            Directory
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'new' ? '' : 'btn-ghost'}`}
            onClick={() => setMode('new')}
          >
            New email
          </button>
        </div>
        {mode === 'existing' && requesters.length > 0 ? (
          <select id="requester_id" name="requester_id" required defaultValue="">
            <option value="" disabled>
              Select requester
            </option>
            {requesters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.email})
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="requester_id" value="" />
            <label htmlFor="requester_email">Requester email *</label>
            <input
              id="requester_email"
              name="requester_email"
              type="email"
              required
              placeholder="employee@moglix.com"
            />
            <label htmlFor="requester_name">Requester name</label>
            <input id="requester_name" name="requester_name" placeholder="Optional display name" />
          </>
        )}
      </div>
      <div className="form-row">
        <label htmlFor="source">Source *</label>
        <select id="source" name="source" defaultValue="phone">
          <option value="phone">Phone</option>
          <option value="portal">Walk-up / assisted portal</option>
          <option value="other">Other</option>
        </select>
      </div>
    </>
  );
}
