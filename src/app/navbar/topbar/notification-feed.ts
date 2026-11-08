import {AlertIncident} from '../../models/Alert';
import {WorkspaceInvitation} from '../../models/Workspace';
import {ReleaseNote} from '../../services/update-notification.service';

export interface DashboardNotification {
  id: string;
  kind: 'invitation' | 'alert' | 'release';
  /** Open alerts are still firing; everything else is informational. */
  tone: 'neutral' | 'critical';
  label: string;
  icon: string;
  title: string;
  description: string;
  occurredAt: string;
  routerLink: string;
  queryParams?: Record<string, string | number>;
}

export function buildNotificationFeed(
  invitations: readonly WorkspaceInvitation[],
  incidents: readonly AlertIncident[],
  releases: readonly ReleaseNote[],
): DashboardNotification[] {
  const notifications: DashboardNotification[] = [
    ...invitations.map(invitation => ({
      id: `invitation-${invitation.id}`,
      kind: 'invitation' as const,
      tone: 'neutral' as const,
      label: 'Invitation',
      icon: 'icon-inbox',
      title: `Join ${invitation.workspace_name}`,
      description: `Invited by ${invitation.inviter_email}`,
      occurredAt: invitation.created_at,
      routerLink: '/invitations',
      queryParams: {invitation: invitation.id},
    })),
    ...incidents.map(incident => ({
      id: `alert-${incident.id}`,
      kind: 'alert' as const,
      tone: incident.closed_at ? 'neutral' as const : 'critical' as const,
      label: 'Alert',
      icon: incident.closed_at ? 'icon-circle-check' : 'icon-triangle-alert',
      title: incident.rule_name,
      description: `${incident.scope_name} · ${incident.closed_at ? 'Resolved' : 'Open'}`,
      occurredAt: incident.opened_at,
      routerLink: '/alerts',
      queryParams: {section: 'history', incident: incident.id},
    })),
    ...releases.map(release => ({
      id: `release-${release.id}`,
      kind: 'release' as const,
      tone: 'neutral' as const,
      label: 'Release',
      icon: 'icon-tag',
      title: release.title || `Magpie ${release.tagName}`,
      description: release.title ? `Magpie ${release.tagName}` : 'New release',
      occurredAt: release.publishedAt,
      routerLink: '/notifications',
      queryParams: {release: release.id},
    })),
  ];

  return notifications
    .filter(notification => Number.isFinite(Date.parse(notification.occurredAt)))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id))
    .slice(0, 5);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short age for a feed row: "now", "5m", "3h", "6d", then a calendar date. */
export function formatNotificationAge(occurredAt: string, now: number): string {
  const at = Date.parse(occurredAt);
  if (!Number.isFinite(at)) return '';
  const age = Math.max(0, now - at);
  if (age < MINUTE) return 'now';
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h`;
  if (age < 7 * DAY) return `${Math.floor(age / DAY)}d`;
  const date = new Date(at);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date(now).getFullYear() ? {} : {year: 'numeric'}),
  });
}
