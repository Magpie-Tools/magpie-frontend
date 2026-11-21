export interface ProxyStatistic {
  id: number;
  transport?: string;
  timeout?: number;
  retries?: number;
  config_key?: string;
  current?: boolean;
  alive: boolean;
  attempt: number;
  response_time: number;
  protocol: string;
  anonymity_level: string;
  judge: string;
  created_at: string;
}


export type ProxyStatisticSort = 'checked' | 'response' | 'attempt' | 'protocol' | 'anonymity' | 'judge';

/** One page of check history: filters are optional; sort defaults to newest first. */
export interface ProxyStatisticsQuery {
  page: number;
  pageSize: number;
  sort: ProxyStatisticSort;
  order: 'asc' | 'desc';
  status?: 'alive' | 'dead';
  protocol?: string;
  transport?: string;
  judgeId?: number;
  settings?: 'current' | 'previous';
  hours?: number;
}

export interface ProxyStatisticsPage {
  statistics: ProxyStatistic[];
  /** Matches every filter. */
  total: number;
  page: number;
  page_size: number;
  /** Ignores the status filter, so the status buttons show what the other filters leave. */
  counts: {alive: number; dead: number};
  options: {
    protocols: {protocol: string; transport: string}[];
    judges: {id: number; url: string}[];
  };
}
