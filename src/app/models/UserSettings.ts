export interface UserSettings {
  http_protocol:     boolean
  https_protocol:    boolean
  socks4_protocol:   boolean
  socks5_protocol:   boolean
  timeout:          number
  retries:          number
  UseHttpsForSocks: boolean

  judges: [{
    url: string
    regex: string
  }]

  scraping_sources: string[]
}
