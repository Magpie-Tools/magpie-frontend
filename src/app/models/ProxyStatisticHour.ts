/** One UTC hour of a proxy's check history, as returned by the hourly statistics endpoint. */
export interface ProxyStatisticHour {
  /** Start of the hour as an ISO timestamp. */
  hour: string;
  checks: number;
  failed: number;
  /** Average response time of the successful checks in ms; 0 when none succeeded. */
  avg_response_time: number;
}

export interface ProxyStatisticHours {
  /** Start of the requested window as an ISO timestamp. */
  since: string;
  hours: ProxyStatisticHour[];
}
