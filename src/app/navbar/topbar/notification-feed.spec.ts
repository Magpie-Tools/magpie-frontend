import {AlertIncident} from '../../models/Alert';
import {WorkspaceInvitation} from '../../models/Workspace';
import {ReleaseNote} from '../../services/update-notification.service';
import {buildNotificationFeed} from './notification-feed';

describe('buildNotificationFeed', () => {
  const invitation = (id: number, created_at: string) => ({
    id, created_at, updated_at: '2026-10-18T00:00:00Z',
    workspace_name: 'Operations', inviter_email: 'owner@example.test',
  } as WorkspaceInvitation);
  const incident = (id: number, opened_at: string) => ({
    id, opened_at, closed_at: '2026-10-18T00:00:00Z',
    rule_name: 'Minimum routes', scope_name: 'Production',
  } as AlertIncident);
  const release = (id: number, publishedAt: string) => ({
    id, publishedAt, title: 'Faster checks', tagName: `v${id}.0.0`,
  } as ReleaseNote);

  it('returns five events total, ordered by event time across all sources', () => {
    const invitations = [invitation(3, '2026-10-17T10:02:00Z'), invitation(99, '2026-10-17T09:59:00Z')];
    const incidents = [incident(5, '2026-10-17T10:05:00Z'), incident(87, '2026-10-17T10:00:00Z'), incident(1, '2026-10-17T10:04:00Z')];
    const releases = [release(2, '2026-10-17T10:03:00Z'), release(101, '2026-10-17T09:00:00Z')];

    expect(buildNotificationFeed(invitations, incidents, releases).map(item => item.id)).toEqual([
      'alert-5', 'alert-1', 'release-2', 'invitation-3', 'alert-87',
    ]);
    expect(invitations.map(item => item.id)).toEqual([3, 99]);
    expect(incidents.map(item => item.id)).toEqual([5, 87, 1]);
    expect(releases.map(item => item.id)).toEqual([2, 101]);
  });

  it('does not move invitations or incidents forward when they are edited or closed', () => {
    const feed = buildNotificationFeed(
      [invitation(1, '2026-10-15T00:00:00Z')],
      [incident(2, '2026-10-16T00:00:00Z')],
      [release(3, '2026-10-17T00:00:00Z')],
    );
    expect(feed.map(item => item.id)).toEqual(['release-3', 'alert-2', 'invitation-1']);
  });

  it('compares timestamps across time zones and excludes undated events', () => {
    const feed = buildNotificationFeed(
      [invitation(1, 'invalid'), invitation(2, '2026-10-17T03:30:00+02:00')],
      [incident(3, '')],
      [release(4, '2026-10-17T01:00:00Z')],
    );
    expect(feed.map(item => item.id)).toEqual(['invitation-2', 'release-4']);
  });

  it('links each event to its inbox, alert history, or release notes', () => {
    const feed = buildNotificationFeed(
      [invitation(1, '2026-10-17T10:00:00Z')],
      [incident(2, '2026-10-17T09:00:00Z')],
      [release(3, '2026-10-17T08:00:00Z')],
    );
    expect(feed[0].routerLink).toBe('/invitations');
    expect(feed[0].queryParams).toEqual({invitation: 1});
    expect(feed[1].routerLink).toBe('/alerts');
    expect(feed[1].queryParams).toEqual({section: 'history', incident: 2});
    expect(feed[2].routerLink).toBe('/notifications');
    expect(feed[2].queryParams).toEqual({release: 3});
  });

  it('keeps distinct events with the same numeric ID and timestamp', () => {
    const at = '2026-10-17T10:00:00Z';
    const feed = buildNotificationFeed([invitation(1, at)], [incident(1, at)], [release(1, at)]);
    expect(new Set(feed.map(item => item.id)).size).toBe(3);
    expect(buildNotificationFeed([], [], [])).toEqual([]);
  });
});
