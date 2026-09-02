import { getDb } from './db';

export function writeAudit(
  entity: string,
  entityId: number,
  actorId: number | null,
  action: string,
  detail?: string,
) {
  getDb()
    .prepare(
      'INSERT INTO audit_log (entity, entity_id, actor_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(entity, entityId, actorId, action, detail ?? null, new Date().toISOString());
}

export function getAuditForTicket(ticketId: number) {
  return getDb()
    .prepare(
      `SELECT a.*, u.name as actor_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity = 'ticket' AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
    )
    .all(ticketId) as Record<string, unknown>[];
}
