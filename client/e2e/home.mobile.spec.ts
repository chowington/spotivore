import { test, expect } from '@playwright/test'
import { setupAuthenticatedHome, mockSession, SESSION, waitForSpotifyPlayer } from './helpers'

test.use({ viewport: { width: 390, height: 844 } })

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedHome(page)
  await page.goto('/')
})

// ── Panel toggle ──────────────────────────────────────────────────────────────

test('sidebar is visible and track list is hidden on load', async ({ page }) => {
  await expect(page.locator('#sidebar-left')).toBeVisible()
  await expect(page.locator('#main-content')).not.toBeVisible()
})

test('selecting a playlist shows the track list and hides the sidebar', async ({ page }) => {
  await page.locator('.playlist-item').first().click()

  await expect(page.locator('#main-content')).toBeVisible()
  await expect(page.locator('#sidebar-left')).not.toBeVisible()
  await expect(page.locator('#track-list-header h2')).toContainText('My Chill Playlist')
  await expect(page.locator('.track-item')).toHaveCount(3)
})

test('back button is visible in the track list header', async ({ page }) => {
  await page.locator('.playlist-item').first().click()

  await expect(page.locator('.back-btn')).toBeVisible()
})

test('tapping the back button returns to the playlist view', async ({ page }) => {
  await page.locator('.playlist-item').first().click()
  await page.locator('.back-btn').click()

  await expect(page.locator('#sidebar-left')).toBeVisible()
  await expect(page.locator('#main-content')).not.toBeVisible()
})

test('back button is not visible on the playlist view', async ({ page }) => {
  await expect(page.locator('.back-btn')).not.toBeVisible()
})

// ── Player bar ────────────────────────────────────────────────────────────────

test('play button is visible in the player bar', async ({ page }) => {
  await expect(page.locator('#play-button')).toBeVisible()
})

test('prev, next, and shuffle buttons are hidden on mobile', async ({ page }) => {
  await expect(page.locator('button[title="Previous"]')).not.toBeVisible()
  await expect(page.locator('button[title="Next"]')).not.toBeVisible()
  await expect(page.locator('button[title="Toggle shuffle"]')).not.toBeVisible()
})

test('scrubber is hidden on mobile', async ({ page }) => {
  await expect(page.locator('#scrubber-wrapper')).not.toBeVisible()
})

// ── Tap to play ───────────────────────────────────────────────────────────────

test('single tap on a track item triggers playback', async ({ page }) => {
  await waitForSpotifyPlayer(page)
  await page.evaluate(() => {
    // @ts-ignore
    window.__spotifyPlayer._emit('ready', { device_id: 'test-device-id' })
  })

  await page.locator('.playlist-item').first().click()
  await expect(page.locator('.track-item')).toHaveCount(3)

  const playRequest = page.waitForRequest('/api/spotify/play/')
  await page.locator('.track-item').first().click()
  await playRequest
})

// ── Resume session ────────────────────────────────────────────────────────────

test('"Resume" button is accessible after navigating to track list on mobile', async ({ page }) => {
  await mockSession(page, SESSION)
  await page.goto('/')

  await page.locator('.playlist-item').first().click()
  // Wait for the track list to confirm both the panel switch and session fetch completed
  await expect(page.locator('.track-item')).toHaveCount(3)
  await expect(page.locator('button[title="Resume listening session"]')).toBeVisible()
})
