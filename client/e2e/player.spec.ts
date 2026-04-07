import { test, expect } from '@playwright/test'
import { setupAuthenticatedHome, waitForSpotifyPlayer } from './helpers'

const MOCK_TRACK_STATE = {
  paused: false,
  position: 5000,
  duration: 210000,
  track_window: {
    current_track: {
      id: 'tr1',
      name: 'Song One',
      uri: 'spotify:track:tr1',
      artists: [{ name: 'Artist A' }],
      album: {
        name: 'Album X',
        images: [{ url: 'https://i.scdn.co/image/fake' }],
      },
    },
  },
}

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedHome(page)
  await page.goto('/')
})

test('player bar is present on the home page', async ({ page }) => {
  await expect(page.locator('#player-row')).toBeVisible()
  await expect(page.locator('#player-wrapper')).toBeVisible()
})

test('player controls render: play, previous, next, shuffle', async ({ page }) => {
  await expect(page.locator('#play-button')).toBeVisible()
  await expect(page.locator('button[title="Previous"]')).toBeVisible()
  await expect(page.locator('button[title="Next"]')).toBeVisible()
  await expect(page.locator('button[title="Toggle shuffle"]')).toBeVisible()
})

test('scrubber bar is present', async ({ page }) => {
  await expect(page.locator('#scrubber-wrapper')).toBeVisible()
})

test('no track info is shown in idle state', async ({ page }) => {
  await expect(page.locator('.now-track-name')).not.toBeAttached()
})

test('player shows track info after SDK fires player_state_changed', async ({ page }) => {
  await waitForSpotifyPlayer(page)
  await page.evaluate(() => {
    // @ts-ignore
    window.__spotifyPlayer._emit('ready', { device_id: 'test-device-id' })
  })
  await page.evaluate((state) => {
    // @ts-ignore
    window.__spotifyPlayer._emit('player_state_changed', state)
  }, MOCK_TRACK_STATE)

  await expect(page.locator('.now-track-name')).toHaveText('Song One')
  await expect(page.locator('.now-track-artists')).toHaveText('Artist A')
  await expect(page.locator('#album-art')).toHaveAttribute('src', 'https://i.scdn.co/image/fake')
})

test('play button title reflects playback state', async ({ page }) => {
  await waitForSpotifyPlayer(page)
  await page.evaluate(() => {
    // @ts-ignore
    window.__spotifyPlayer._emit('ready', { device_id: 'test-device-id' })
  })

  // Playing
  await page.evaluate((state) => {
    // @ts-ignore
    window.__spotifyPlayer._emit('player_state_changed', state)
  }, { ...MOCK_TRACK_STATE, paused: false })
  await expect(page.locator('#play-button')).toHaveAttribute('title', 'Pause')

  // Paused
  await page.evaluate((state) => {
    // @ts-ignore
    window.__spotifyPlayer._emit('player_state_changed', state)
  }, { ...MOCK_TRACK_STATE, paused: true })
  await expect(page.locator('#play-button')).toHaveAttribute('title', 'Play')
})
