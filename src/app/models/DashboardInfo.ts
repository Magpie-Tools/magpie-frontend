export interface DashboardInfo {
  total_checks: number
  total_scraped: number
  total_checks_week: number
  total_scraped_week: number

  judge_valid_proxies: {
    judge_url: string
    elite_proxies: number
    anonymous_proxies: number
    transparent_proxies: number
  }[]
}
