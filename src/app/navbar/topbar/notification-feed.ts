import {AlertIncident} from '../../models/Alert';
import {WorkspaceInvitation} from '../../models/Workspace';
import {ReleaseNote} from '../../services/update-notification.service';

export interface DashboardNotification {
  id: string;
  kind: 'invitation' | 'alert' | 'release';
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
      label: 'Alert',
      icon: 'icon-triangle-alert',
      title: incident.rule_name,
      description: `${incident.scope_name} · Alert triggered`,
      occurredAt: incident.opened_at,
      routerLink: '/alerts',
      queryParams: {section: 'history', incident: incident.id},
    })),
    ...releases.map(release => ({
      id: `release-${release.id}`,
      kind: 'release' as const,
      label: 'Release',
      icon: 'icon-tag',
      title: release.title || release.tagName,
      description: `Magpie ${release.tagName}`,
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
