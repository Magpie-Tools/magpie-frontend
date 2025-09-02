export interface ProxyCheck {
  id: string;
  ip: string;
  status: 'working' | 'failed' | 'timeout';
  latency?: number; // in ms
  date: Date;
  time: string;
}
