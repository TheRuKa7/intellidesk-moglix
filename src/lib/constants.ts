export const TICKET_COUNTER_START = 2_176_596;

export const PORTAL_SUPPORT_TEAMS = [
  'Analytics Reporting',
  'Credlix Team',
  'Customer Care',
  'Enterprise Marketing Projects',
  'Tech Support Team',
  'Digimro Billing',
  'DRG Labs',
  'RIL Support',
  'TSL',
  'Plant Mapping',
  'Supply Excellence',
  'UAE Helpdesk',
] as const;

export const ALL_SUPPORT_TEAMS = [
  ...PORTAL_SUPPORT_TEAMS,
  'Invoice North',
  'Invoice South',
  'PO Punching North',
  'PO Punching South',
  'RFQ North',
  'RFQ South',
  'RFQ East',
  'RFQ West',
  'Customer Care Ahmedabad',
  'Customer Care Bangalore',
  'Customer Care Mumbai',
  'Treasury',
  'Taxation Team',
  'Bank Guarantee',
  'Letter of Credit',
  'Credlix Underwriting',
  'Plant KYC',
  'SCM Ops',
  'NetSuite Team',
  'DevOps Team',
  'IT Support Team',
] as const;

/** All 25 agent statuses — aligned with workbook R2_Statuses_and_Picklists */
export const STATUSES: { name: string; category: string; slaClock: 'run' | 'pause' | 'stop' }[] = [
  { name: 'Open', category: 'in_progress', slaClock: 'run' },
  { name: 'Re-Open', category: 'in_progress', slaClock: 'run' },
  { name: 'Pending', category: 'waiting_requester', slaClock: 'pause' },
  { name: 'Manager Approval Awaited', category: 'waiting_approval', slaClock: 'pause' },
  { name: 'BU Approval Awaited', category: 'waiting_approval', slaClock: 'pause' },
  { name: 'Finance Approval Awaited', category: 'waiting_approval', slaClock: 'pause' },
  { name: 'Treasury Action Awaited', category: 'waiting_approval', slaClock: 'pause' },
  { name: 'Supply Approval Awaited', category: 'waiting_approval', slaClock: 'pause' },
  { name: 'Approval Awaited', category: 'waiting_approval', slaClock: 'pause' },
  { name: 'Legal Action Awaited', category: 'waiting_approval', slaClock: 'pause' },
  { name: 'Waiting for Tech', category: 'waiting_team', slaClock: 'pause' },
  { name: 'Waiting for catalog', category: 'waiting_team', slaClock: 'pause' },
  { name: 'Waiting for category', category: 'waiting_team', slaClock: 'pause' },
  { name: 'Pushed to SCM', category: 'waiting_team', slaClock: 'pause' },
  { name: 'Plant Creation Action', category: 'waiting_team', slaClock: 'pause' },
  { name: 'CL Action Awaited', category: 'waiting_team', slaClock: 'pause' },
  { name: 'Documents Uploaded', category: 'waiting_team', slaClock: 'pause' },
  { name: 'Plant Created', category: 'waiting_team', slaClock: 'pause' },
  { name: 'AutoMap', category: 'waiting_team', slaClock: 'pause' },
  { name: 'AutoMap False', category: 'waiting_team', slaClock: 'pause' },
  { name: 'Invalid UTR', category: 'waiting_team', slaClock: 'pause' },
  { name: 'On Hold', category: 'parked', slaClock: 'pause' },
  { name: 'Resolved', category: 'done', slaClock: 'stop' },
  { name: 'Interim Resolve', category: 'done', slaClock: 'stop' },
  { name: 'Closed', category: 'done', slaClock: 'stop' },
];

/** Requester-facing labels from workbook R2 (agents see internal names) */
export const REQUESTER_STATUS_LABELS: Record<string, string> = {
  Open: 'Being Processed',
  Pending: 'Awaiting your Reply',
  Resolved: 'This ticket has been Resolved',
  Closed: 'This ticket has been Closed',
  'On Hold': 'On Hold',
  'Documents Uploaded': 'Document Uploaded',
  'Plant Created': 'Plant Created',
  'BU Approval Awaited': 'BU Approval Awaited',
  'Legal Action Awaited': 'Legal Action Awaited',
  'Finance Approval Awaited': 'Finance Approval Awaited',
  'Plant Creation Action': 'Plant Creation Action',
  'CL Action Awaited': 'CL Action Awaited',
  'Re-Open': 'Re-Open',
  'Interim Resolve': 'Interim Resolve',
  'Manager Approval Awaited': 'Manager Approval Awaited',
  'Waiting for catalog': 'Waiting for catalog',
  'Waiting for Tech': 'Waiting for Tech',
  'Waiting for category': 'Waiting for category',
  'Treasury Action Awaited': 'Treasury Action Awaited',
  'Supply Approval Awaited': 'Supply Approval Awaited',
  'Approval Awaited': 'Approval Awaited',
  'Pushed to SCM': 'Pushed to SCM',
  AutoMap: 'AutoMap',
  'AutoMap False': 'AutoMap False',
  'Invalid UTR': 'Invalid UTR',
};

export const AGENT_SAVED_VIEWS = [
  { id: 'open', label: 'Open tickets' },
  { id: 'mine', label: 'Assigned to me' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due_today', label: 'Due today' },
  { id: 'all', label: 'All tickets' },
] as const;

export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;

export const COMMERCE_FIELDS = [
  'support_team',
  'requester_team',
  'mapping_team',
  'po_region',
  'dp_zone',
  'bank_location',
  'process_flow',
  'action_taken',
  'cpo_id',
  'order_number',
  'invoice_number',
  'plant_id',
  'rfq_id',
] as const;

export const PILOT_GROUP = 'Tech Support Team';
export const PILOT_MAILBOX = 'techsupport@moglix.com';

export const DEMO_USERS = [
  { email: 'agent@moglix.com', name: 'Tech Agent', role: 'agent', group: PILOT_GROUP },
  { email: 'supervisor@moglix.com', name: 'Desk Supervisor', role: 'supervisor', group: PILOT_GROUP },
  { email: 'employee@moglix.com', name: 'Rahul Employee', role: 'requester', group: null },
  { email: 'admin@moglix.com', name: 'Desk Admin', role: 'admin', group: null },
] as const;
