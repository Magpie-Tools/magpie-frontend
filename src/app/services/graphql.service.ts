import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {Observable, throwError} from 'rxjs';
import {map, catchError} from 'rxjs/operators';

const DASHBOARD_QUERY = `#graphql
  query DashboardData($proxyPage: Int!) {
    viewer {
      dashboard {
        totalChecks
        totalScraped
        totalChecksWeek
        totalScrapedWeek
        reputationBreakdown {
          good
          neutral
          poor
          unknown
        }
        countryBreakdown {
          country
          count
        }
        judgeValidProxies {
          judgeUrl
          eliteProxies
          anonymousProxies
          transparentProxies
        }
      }
      proxyCount
      proxyLimit
      proxies(page: $proxyPage) {
        page
        pageSize
        totalCount
        items {
          id
          ip
          port
          estimatedType
          responseTime
          country
          anonymityLevel
          alive
          latestCheck
        }
      }
      proxyHistory(limit: 168) {
        count
        recordedAt
      }
      proxySnapshots {
        alive {
          count
          recordedAt
        }
        scraped {
          count
          recordedAt
        }
      }
      scrapeSourceCount
    }
  }
`;

interface GraphQLError {
  message: string;
}

export interface DashboardQueryData {
  viewer: DashboardViewer;
}

export interface DashboardViewer {
  dashboard: DashboardInfo;
  proxyCount: number;
  proxyLimit: number | null;
  proxies: ProxyPage;
  proxyHistory: ProxyHistoryEntry[];
  proxySnapshots: ProxySnapshots;
  scrapeSourceCount: number;
}

export interface DashboardInfo {
  totalChecks: number;
  totalScraped: number;
  totalChecksWeek: number;
  totalScrapedWeek: number;
  reputationBreakdown: ReputationBreakdown;
  countryBreakdown: CountryBreakdownEntry[];
  judgeValidProxies: JudgeValidProxy[];
}

export interface ReputationBreakdown {
  good: number;
  neutral: number;
  poor: number;
  unknown: number;
}

export interface CountryBreakdownEntry {
  country: string;
  count: number;
}

export interface JudgeValidProxy {
  judgeUrl: string;
  eliteProxies: number;
  anonymousProxies: number;
  transparentProxies: number;
}

export interface ProxyPage {
  page: number;
  pageSize: number;
  totalCount: number;
  items: ProxyNode[];
}

export interface ProxyNode {
  id: number;
  ip: string;
  port: number;
  estimatedType: string;
  responseTime: number;
  country: string;
  anonymityLevel: string;
  protocol: string;
  alive: boolean;
  latestCheck?: string;
}

export interface ProxyHistoryEntry {
  count: number;
  recordedAt: string;
}

export interface ProxySnapshotEntry {
  count: number;
  recordedAt: string;
}

export interface ProxySnapshots {
  alive: ProxySnapshotEntry[];
  scraped: ProxySnapshotEntry[];
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

@Injectable({ providedIn: 'root' })
export class GraphqlService {
  private graphqlUrl = `${environment.apiUrl}/graphql`;

  constructor(private http: HttpClient) {}

  fetchDashboardData(proxyPage = 1): Observable<DashboardQueryData> {
    return this.http
      .post<GraphQLResponse<DashboardQueryData>>(this.graphqlUrl, {
        query: DASHBOARD_QUERY,
        variables: { proxyPage }
      })
      .pipe(
        map((response) => {
          if (response.errors?.length) {
            const message = response.errors.map((e) => e.message).join('; ');
            throw new Error(message || 'GraphQL query failed');
          }
          if (!response.data) {
            throw new Error('GraphQL query returned no data');
          }
          return response.data;
        }),
        catchError((error) => {
          return throwError(() =>
            error instanceof Error
              ? error
              : new Error(typeof error?.message === 'string' ? error.message : 'Failed to fetch dashboard data')
          );
        })
      );
  }
}
