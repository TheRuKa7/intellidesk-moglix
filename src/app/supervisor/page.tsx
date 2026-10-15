import { redirect } from 'next/navigation';

/**
 * Full live counters / scheduled reports are workbook Phase 4 (MFI-146 / MFI-147).
 * MVP supervisors use the agent queue KPI cards instead. Domain tests call
 * `getSupervisorReport()` directly — this route stays out of the product chrome.
 */
export default function SupervisorPage() {
  redirect('/agent?view=open');
}
