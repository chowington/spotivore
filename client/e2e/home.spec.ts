import { test, expect } from '@playwright/test'
import { setupAuthenticatedHome, mockSession, mockPlaylists, mockTracks, waitForSpotifyPlayer, SESSION, PLAYLISTS, TRACKS } from './helpers'

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedHome(page)
  await page.goto('/')
})

test('home page structure renders all three sections', async ({ page }, testInfo) => {
  // On mobile, #main-content starts hidden until a playlist is selected
  test.skip(testInfo.project.name.startsWith('Mobile'), 'Mobile layout covered in home.mobile.spec.ts')
  await expect(page.locator('#sidebar-left')).toBeVisible()
  await expect(page.locator('#main-content')).toBeVisible()
  await expect(page.locator('#player-row')).toBeVisible()
})

test('"Select a playlist" message is shown before a playlist is selected', async ({ page }) => {
  await expect(page.locator('.no-playlist-message')).toContainText('Select a playlist')
})

test('playlists load and display in the sidebar', async ({ page }) => {
  await expect(page.locator('.playlist-item')).toHaveCount(2)
  await expect(page.locator('.playlist-item').nth(0)).toContainText('My Chill Playlist')
  await expect(page.locator('.playlist-item').nth(1)).toContainText('Workout Bangers')
})

test('clicking a playlist loads its tracks', async ({ page }) => {
  await page.locator('.playlist-item').first().click()

  await expect(page.locator('#track-list-header')).toBeVisible()
  await expect(page.locator('#track-list-header h2')).toContainText('My Chill Playlist')
  await expect(page.locator('.track-item')).toHaveCount(3)
})

test('track list shows the correct track count', async ({ page }) => {
  await page.locator('.playlist-item').first().click()

  await expect(page.locator('.track-count')).toHaveText('3 tracks')
})

test('track names are visible in the track list', async ({ page }) => {
  await page.locator('.playlist-item').first().click()

  await expect(page.getByText('Song One')).toBeVisible()
  await expect(page.getByText('Song Two')).toBeVisible()
  await expect(page.getByText('Song Three')).toBeVisible()
})

test('clicking the "Playlists" header refreshes the playlist list', async ({ page }) => {
  // Wait for initial load
  await expect(page.locator('.playlist-item')).toHaveCount(2)

  // Register a new handler that returns 3 playlists (takes precedence — last registered wins)
  const threePlaylistsResponse = [
    ...PLAYLISTS,
    { spotify_id: 'pl-new', name: 'New Arrivals', track_count: 5 },
  ]
  await mockPlaylists(page, threePlaylistsResponse)

  await page.locator('.header-caps').click()

  await expect(page.locator('.playlist-item')).toHaveCount(3)
  await expect(page.getByText('New Arrivals')).toBeVisible()
})

test('refresh button re-fetches the track list', async ({ page }) => {
  await page.locator('.playlist-item').first().click()
  await expect(page.locator('.track-item')).toHaveCount(3)

  // Override to return a single track
  const singleTrack = [TRACKS[0]]
  await mockTracks(page, singleTrack)

  await page.locator('#refresh-btn').click()

  await expect(page.locator('.track-item')).toHaveCount(1)
})

test('"Resume" button appears when a session exists', async ({ page, browser: _browser }) => {
  // Need fresh setup with session enabled — re-navigate after overriding session mock
  // Playwright routes stack; the new handler fires first (last-registered wins)
  await mockSession(page, SESSION)

  // Reload so the mock is in effect before the route guard fires
  await page.goto('/')

  await page.locator('.playlist-item').first().click()
  // Wait for tracks to confirm the panel switch (mobile) and session fetch completed
  await expect(page.locator('.track-item')).toHaveCount(3)
  await expect(page.locator('button[title="Resume listening session"]')).toBeVisible()
})

test('"Resume" button is absent when no session exists', async ({ page }) => {
  await page.locator('.playlist-item').first().click()

  await expect(page.locator('.track-item')).toHaveCount(3)
  await expect(page.locator('button[title="Resume listening session"]')).not.toBeVisible()
})

test('"Resume" button disappears after clicking it', async ({ page }) => {
  await mockSession(page, SESSION)
  await page.goto('/')

  // Trigger the ready event so the player has a device ID (required by resumeSession)
  await waitForSpotifyPlayer(page)
  await page.evaluate(() => {
    // @ts-ignore
    window.__spotifyPlayer._emit('ready', { device_id: 'test-device-id' })
  })

  await page.locator('.playlist-item').first().click()
  await expect(page.locator('button[title="Resume listening session"]')).toBeVisible()

  await page.locator('button[title="Resume listening session"]').click()

  await expect(page.locator('button[title="Resume listening session"]')).not.toBeVisible()
})
