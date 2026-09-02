import { NextResponse } from 'next/server';
import { getSessionUser, isStaff } from '@/lib/auth';
import { runAutoCloseJob } from '@/lib/tickets';

export async function POST() {
  const user = await getSessionUser();
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const closed = runAutoCloseJob(user.id);
  return NextResponse.json({ closed });
}
