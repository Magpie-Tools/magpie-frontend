export interface GlobalSettings {
  protocols: {
    http: boolean
    https: boolean
    socks4: boolean
    socks5: boolean
  },

  checker: {
    dynamic_threads: boolean,
    threads: number,
    retries: number,
    timeout: number,
    checker_timer: {
      days: number,
      hours: number,
      minutes: number,
      seconds: number
    },
    judges_threads: number,
    judges_timeout: number,
    judges: {
      url: string,
      regex: string
    }[],
    judge_timer: {
      days: number,
      hours: number,
      minutes: number,
      seconds: number
    },
    use_https_for_socks: boolean,
    ip_lookup: string,
    standard_header: ["USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"],
    proxy_header: ["HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"]
  },

  scraper: {
    dynamic_threads: false,
    threads: 250,
    retries: 2,
    timeout: 7500,

    scraper_timer: {
      days: 0,
      hours: 0,
      minutes: 5,
      seconds: 0
    },

    scrape_sites: string[]
  },

  blacklist_sources: string[]
}
