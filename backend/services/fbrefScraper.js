// FBref Scraper Service
// Scrapes player match data from FBref.com
// Uses Puppeteer with stealth plugin to bypass Cloudflare protection

import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { existsSync } from 'fs'

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin())

const FBREF_BASE = 'https://fbref.com'

// Rate limiting to be respectful to FBref servers
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Find Chrome executable path based on OS
function getChromePath() {
  const paths = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]
  }

  const platform = process.platform
  const candidates = paths[platform] || []

  for (const path of candidates) {
    if (existsSync(path)) {
      return path
    }
  }

  return null
}

class FBrefScraper {
  constructor() {
    this.cache = new Map()
    this.cacheExpiry = 30 * 60 * 1000 // 30 minutes
    this.lastRequestTime = 0
    this.minRequestInterval = 5000 // 5 seconds between requests
    this.browser = null
    this.usePuppeteer = true // Try Puppeteer first
  }

  // Initialize browser instance
  async initBrowser() {
    if (this.browser) return this.browser

    const chromePath = getChromePath()
    if (!chromePath) {
      console.log('FBref: Chrome not found, falling back to fetch')
      this.usePuppeteer = false
      return null
    }

    try {
      this.browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
        ]
      })
      console.log('FBref: Browser initialized successfully')
      return this.browser
    } catch (error) {
      console.log('FBref: Failed to initialize browser:', error.message)
      this.usePuppeteer = false
      return null
    }
  }

  // Close browser
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  // Respect rate limiting
  async throttle() {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.minRequestInterval) {
      await delay(this.minRequestInterval - timeSinceLastRequest)
    }
    this.lastRequestTime = Date.now()
  }

  // Fetch page with Puppeteer (bypasses Cloudflare)
  async fetchPageWithPuppeteer(url) {
    const browser = await this.initBrowser()
    if (!browser) {
      throw new Error('Browser not available')
    }

    const page = await browser.newPage()

    try {
      // More realistic browser emulation
      await page.setViewport({ width: 1920, height: 1080 })
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')

      // Override webdriver detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
        window.chrome = { runtime: {} }
      })

      // Navigate and wait for content
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      })

      // Wait longer for Cloudflare to process
      await delay(5000)

      // Wait for the table to load
      await page.waitForSelector('table', { timeout: 20000 }).catch(() => {})

      const html = await page.content()
      await page.close()

      return html
    } catch (error) {
      await page.close()
      throw error
    }
  }

  // Fetch with caching and rate limiting
  async fetchPage(url) {
    // Check cache first
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.html
    }

    await this.throttle()

    try {
      console.log(`FBref: Fetching ${url}`)

      let html

      if (this.usePuppeteer) {
        try {
          html = await this.fetchPageWithPuppeteer(url)
        } catch (puppeteerError) {
          console.log('FBref: Puppeteer failed, trying fetch:', puppeteerError.message)
          // Fall back to regular fetch
          html = await this.fetchWithRegularFetch(url)
        }
      } else {
        html = await this.fetchWithRegularFetch(url)
      }

      // Cache the response
      this.cache.set(url, {
        html,
        timestamp: Date.now()
      })

      return html
    } catch (error) {
      console.error(`FBref fetch error for ${url}:`, error.message)
      throw error
    }
  }

  // Regular fetch (may be blocked by Cloudflare)
  async fetchWithRegularFetch(url) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  }

  // Get current season string (e.g., "2024-2025")
  getCurrentSeason() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    // If before August, use previous season
    if (month < 8) {
      return `${year - 1}-${year}`
    }
    return `${year}-${year + 1}`
  }

  // Get alternate season format (e.g., "2024" for calendar year leagues)
  getAltSeason() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    // If before August, use previous year
    if (month < 8) {
      return `${year - 1}`
    }
    return `${year}`
  }

  // Build match logs URL for a player
  getMatchLogsUrl(fbrefId, playerSlug) {
    const season = this.getCurrentSeason()
    return `${FBREF_BASE}/en/players/${fbrefId}/matchlogs/${season}/summary/${playerSlug}-Match-Logs`
  }

  // Build player overview URL (may have fewer restrictions)
  getPlayerUrl(fbrefId, playerSlug) {
    return `${FBREF_BASE}/en/players/${fbrefId}/${playerSlug}`
  }

  // Parse a match row from the match logs table
  parseMatchRow($, row) {
    const cells = $(row).find('td, th')

    // Extract data from cells
    const dateCell = $(row).find('th[data-stat="date"]')
    const date = dateCell.text().trim()

    if (!date || date === 'Date') return null // Skip header rows

    const data = {}

    // Parse each cell by data-stat attribute
    cells.each((i, cell) => {
      const stat = $(cell).attr('data-stat')
      const value = $(cell).text().trim()
      if (stat) {
        data[stat] = value
      }
    })

    // Also get date from th
    const dateFromTh = $(row).find('th[data-stat="date"]').text().trim()
    if (dateFromTh) {
      data.date = dateFromTh
    }

    return data
  }

  // Parse player events from a match row
  parsePlayerEvents(matchData) {
    const events = []

    // Parse goals
    const goals = parseInt(matchData.goals || matchData.gls || '0') || 0
    for (let i = 0; i < goals; i++) {
      events.push({ type: 'goal', minute: null })
    }

    // Parse assists
    const assists = parseInt(matchData.assists || matchData.ast || '0') || 0
    for (let i = 0; i < assists; i++) {
      events.push({ type: 'assist', minute: null })
    }

    // Parse cards
    const yellowCards = parseInt(matchData.cards_yellow || matchData.crdy || '0') || 0
    for (let i = 0; i < yellowCards; i++) {
      events.push({ type: 'yellow', minute: null })
    }

    const redCards = parseInt(matchData.cards_red || matchData.crdr || '0') || 0
    for (let i = 0; i < redCards; i++) {
      events.push({ type: 'red', minute: null })
    }

    return events
  }

  // Calculate minutes played and determine if started
  parseMinutesData(matchData) {
    const minutes = parseInt(matchData.minutes || matchData.min || '0') || 0

    // Check if player started - FBref shows this in the 'game_started' field or infer from minutes
    const started = matchData.game_started === 'Y' ||
                   matchData.starts === '1' ||
                   (minutes >= 45 && !matchData.game_started) // Likely started if played 45+ minutes

    return { minutes, started }
  }

  // Fetch and parse match logs for a player
  async getPlayerMatchLogs(fbrefId, playerSlug) {
    try {
      const url = this.getMatchLogsUrl(fbrefId, playerSlug)
      const html = await this.fetchPage(url)
      const $ = cheerio.load(html)

      const matches = []

      // Debug: List all table IDs found
      const tableIds = []
      $('table').each((i, table) => {
        const id = $(table).attr('id')
        if (id) tableIds.push(id)
      })
      console.log(`FBref: Found tables:`, tableIds.slice(0, 10))

      // Find the summary match logs table (try different IDs)
      let table = $('#matchlogs_all')
      if (!table.length) {
        table = $('table.stats_table').first()
      }
      if (!table.length) {
        table = $('#matchlogs_dom_lg')
      }

      if (!table.length) {
        console.log(`FBref: No match logs table found for ${playerSlug}`)
        // Debug: Check if we got a Cloudflare page
        if (html.includes('Just a moment') || html.includes('Checking your browser')) {
          console.log('FBref: Cloudflare challenge page detected')
        }
        return []
      }

      // Parse each row in the table body
      table.find('tbody tr').each((i, row) => {
        // Skip spacer rows
        if ($(row).hasClass('spacer') || $(row).hasClass('thead')) return

        const matchData = this.parseMatchRow($, row)
        if (!matchData || !matchData.date) return

        // Parse the match details
        const opponent = matchData.opponent || ''
        const venue = matchData.venue || '' // 'H' for home, 'A' for away
        const result = matchData.result || ''
        const comp = matchData.comp || ''

        // Parse score
        const scoreMatch = result.match(/([WDL])\s*(\d+)[–-](\d+)/)
        let homeScore = 0, awayScore = 0
        if (scoreMatch) {
          const [, resultLetter, score1, score2] = scoreMatch
          if (venue === 'H') {
            homeScore = parseInt(score1)
            awayScore = parseInt(score2)
          } else {
            homeScore = parseInt(score2)
            awayScore = parseInt(score1)
          }
        }

        const { minutes, started } = this.parseMinutesData(matchData)
        const events = this.parsePlayerEvents(matchData)
        const participated = minutes > 0

        matches.push({
          date: matchData.date,
          opponent: opponent.replace(/^vs |^@ /, ''),
          isHome: venue === 'H',
          homeScore,
          awayScore,
          result: result.charAt(0), // W, D, or L
          competition: comp,
          participated,
          minutesPlayed: minutes,
          started,
          events,
          rawData: matchData // Keep raw data for debugging
        })
      })

      console.log(`FBref: Found ${matches.length} matches for ${playerSlug}`)
      return matches
    } catch (error) {
      console.error(`FBref: Error getting match logs for ${playerSlug}:`, error.message)
      return []
    }
  }

  // Get the most recent match for a player
  async getLastMatch(fbrefId, playerSlug) {
    const matches = await this.getPlayerMatchLogs(fbrefId, playerSlug)

    // Filter to matches that have already been played (have a result)
    const playedMatches = matches.filter(m => m.result && m.result !== '')

    if (playedMatches.length === 0) return null

    // Sort by date descending and return most recent
    playedMatches.sort((a, b) => new Date(b.date) - new Date(a.date))
    return playedMatches[0]
  }

  // Get matches within a date range
  async getMatchesInRange(fbrefId, playerSlug, startDate, endDate) {
    const matches = await this.getPlayerMatchLogs(fbrefId, playerSlug)

    const start = new Date(startDate)
    const end = new Date(endDate)

    return matches.filter(m => {
      const matchDate = new Date(m.date)
      return matchDate >= start && matchDate <= end
    })
  }

  // Clear cache
  clearCache() {
    this.cache.clear()
  }
}

export default FBrefScraper
