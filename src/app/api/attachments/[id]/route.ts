import { NextResponse } from 'next/server';
import { readAttachmentFile } from '@/lib/attachments';
import { getSessionUser, canViewTicket } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const row = getDb()
    .prepare(
      `SELECT a.*, t.group_name, t.requester_id, t.assignee_id
       FROM attachments a
       JOIN tickets t ON t.id = a.ticket_id
       WHERE a.id = ?`,
    )
    .get(Number(id)) as
    | {
        id: number;
        filename: string;
        storage_key: string | null;
        content_type: string | null;
        group_name: string;
        requester_id: number;
        assignee_id: number | null;
      }
    | undefined;

  if (!row || !row.storage_key) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (
    !canViewTicket(user, {
      group_name: row.group_name,
      requester_id: row.requester_id,
      assignee_id: row.assignee_id,
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = readAttachmentFile(row.storage_key);
  if (!data) {
    return NextResponse.json({ error: 'File missing' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': row.content_type ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${row.filename}"`,
    },
  });
}
