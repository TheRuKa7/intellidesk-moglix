/**
 * Privilege catalogue + role → privilege map (MFI-023 / MFI-014).
 */
export const PRIVILEGES = [
  { key: 'ticket.view_own', description: 'View own tickets' },
  { key: 'ticket.view_group', description: 'View group tickets' },
  { key: 'ticket.view_all', description: 'View all tickets' },
  { key: 'ticket.update', description: 'Update ticket properties' },
  { key: 'ticket.reply', description: 'Public reply' },
  { key: 'ticket.note', description: 'Internal note' },
  { key: 'ticket.assign', description: 'Assign tickets' },
  { key: 'ticket.close', description: 'Close tickets' },
  { key: 'ticket.watch', description: 'Watch tickets' },
  { key: 'report.view', description: 'View supervisor reports' },
  { key: 'admin.settings', description: 'Edit account settings' },
  { key: 'admin.security', description: 'Edit security policy' },
  { key: 'admin.users', description: 'Manage agents and requesters' },
  { key: 'admin.groups', description: 'Manage groups' },
  { key: 'admin.mailboxes', description: 'Manage mailboxes' },
  { key: 'admin.privileges', description: 'View privilege catalogue' },
  { key: 'mail.simulate', description: 'Use mail simulator' },
  { key: 'api.access', description: 'Call internal API' },
] as const;

export type PrivilegeKey = (typeof PRIVILEGES)[number]['key'];

const AGENT_PRIVS: PrivilegeKey[] = [
  'ticket.view_group',
  'ticket.update',
  'ticket.reply',
  'ticket.note',
  'ticket.assign',
  'ticket.close',
  'ticket.watch',
  'mail.simulate',
  'api.access',
];

const SUPERVISOR_PRIVS: PrivilegeKey[] = [
  ...AGENT_PRIVS,
  'ticket.view_all',
  'report.view',
  'admin.users',
  'admin.groups',
];

const ADMIN_PRIVS: PrivilegeKey[] = PRIVILEGES.map((p) => p.key);

const EXTRA_ROLES: { name: string; level: string; privileges: PrivilegeKey[] }[] = [
  { name: 'L1 Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'L2 Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Specialist — Tech', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Specialist — Finance', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Specialist — SCM', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'PO Punching Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Invoice Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'RFQ Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Customer Care Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Treasury Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Group Lead', level: 'supervisor', privileges: SUPERVISOR_PRIVS },
  { name: 'Team Lead', level: 'supervisor', privileges: SUPERVISOR_PRIVS },
  { name: 'QA Reviewer', level: 'supervisor', privileges: SUPERVISOR_PRIVS },
  { name: 'Knowledge Author', level: 'supervisor', privileges: SUPERVISOR_PRIVS },
  { name: 'Mailbox Owner', level: 'supervisor', privileges: SUPERVISOR_PRIVS },
  { name: 'Report Viewer', level: 'supervisor', privileges: SUPERVISOR_PRIVS },
  { name: 'Security Admin', level: 'admin', privileges: ADMIN_PRIVS },
  { name: 'Catalog Admin', level: 'admin', privileges: ADMIN_PRIVS },
  { name: 'SLA Admin', level: 'admin', privileges: ADMIN_PRIVS },
];

/** 23 named roles from workbook — mapped to prototype privilege sets */
export const ROLE_CATALOGUE: { name: string; level: string; privileges: PrivilegeKey[] }[] = [
  { name: 'Requester', level: 'requester', privileges: ['ticket.view_own'] },
  { name: 'Agent', level: 'agent', privileges: AGENT_PRIVS },
  { name: 'Supervisor', level: 'supervisor', privileges: SUPERVISOR_PRIVS },
  { name: 'Admin', level: 'admin', privileges: ADMIN_PRIVS },
  ...EXTRA_ROLES,
];

export const TICKET_CATEGORIES = [
  {
    name: 'Access',
    subcategories: ['VPN', 'SSO', 'Password reset', 'Application access'],
  },
  {
    name: 'Hardware',
    subcategories: ['Laptop', 'Peripheral', 'Network device'],
  },
  {
    name: 'Software',
    subcategories: ['Install', 'License', 'Crash', 'Update'],
  },
  {
    name: 'Commerce',
    subcategories: ['PO', 'Invoice', 'RFQ', 'Plant mapping'],
  },
  {
    name: 'Other',
    subcategories: ['General', 'Feedback'],
  },
] as const;

export const ALLOWED_SENDER_DOMAINS = ['moglix.com', 'moglilabs.com'] as const;

export const DEFAULT_ACCOUNT_SETTINGS: Record<string, string> = {
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  date_format: 'dd MMM yyyy',
  currency: 'INR',
  ticket_id_prefix: 'INC-',
  next_ticket_id_help: 'Counter continues from Freshservice migration floor',
};

export const DEFAULT_SECURITY_SETTINGS: Record<string, string> = {
  session_lifetime_hours: '12',
  public_url_auth: 'required',
  ticket_sharing: 'disabled',
  allowed_email_domains: 'moglix.com,moglilabs.com',
  max_attachment_mb: '25',
  force_logout_enabled: 'true',
};
