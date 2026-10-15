import { PORTAL_SUPPORT_TEAMS } from '@/lib/constants';

/** Shared incident intake fields — portal self-serve and staff create-on-behalf. */
export function TicketIntakeFields({
  defaultTeam = 'Tech Support Team',
  maxAttachmentMb = 25,
}: {
  defaultTeam?: string;
  maxAttachmentMb?: number;
}) {
  return (
    <>
      <div className="form-row">
        <label htmlFor="support_team">Support team *</label>
        <select id="support_team" name="support_team" required defaultValue={defaultTeam}>
          {PORTAL_SUPPORT_TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="cc">CC (optional)</label>
        <input id="cc" name="cc" type="email" placeholder="colleague@moglix.com" />
      </div>
      <div className="form-row">
        <label htmlFor="other_remarks">Other remarks</label>
        <textarea id="other_remarks" name="other_remarks" rows={3} placeholder="Any extra context" />
      </div>
      <div className="form-row">
        <label htmlFor="subject">Subject *</label>
        <input id="subject" name="subject" required placeholder="Brief summary" />
      </div>
      <div className="form-row">
        <label htmlFor="description">Description *</label>
        <textarea
          id="description"
          name="description"
          required
          placeholder="What happened? Include steps to reproduce and impact."
        />
      </div>
      <div className="form-row">
        <label htmlFor="attachment">Attach files</label>
        <div>
          <input id="attachment" name="attachment" type="file" />
          <p className="field-hint" style={{ margin: '6px 0 0' }}>
            Max {maxAttachmentMb} MB (Admin → Security). Oversized files are rejected.
          </p>
        </div>
      </div>
    </>
  );
}
