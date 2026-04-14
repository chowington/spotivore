import { test, expect } from '@playwright/test'
import {
  mockSpotifySDK,
  mockConnection,
  mockAuthUrl,
  setupAuthenticatedHome,
  setupLoginPage,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await mockSpotifySDK(page)
})

test('unauthenticated user visiting / is redirected to /login', async ({ page }) => {
  await mockConnection(page, { connected: false })
  await mockAuthUrl(page)

  await page.goto('/')

  await expect(page).toHaveURL('/login')
  await expect(page.locator('button', { hasText: 'Connect to Spotify' })).toBeVisible()
})

test('login page shows app title and Connect to Spotify button', async ({ page }) => {
  await setupLoginPage(page)

  await page.goto('/login')

  await expect(page.locator('h1')).toHaveText('Spotivore')
  await expect(page.locator('button', { hasText: 'Connect to Spotify' })).toBeVisible()
})

test('clicking Connect to Spotify navigates to the Spotify OAuth URL', async ({ page }) => {
  await setupLoginPage(page)
  // Prevent an actual network request to Spotify's servers
  await page.route('https://accounts.spotify.com/**', (route) =>
    route.fulfill({ status: 200, body: '<html></html>', contentType: 'text/html' }),
  )

  await page.goto('/login')
  await page.locator('button', { hasText: 'Connect to Spotify' }).click()

  await page.waitForURL('https://accounts.spotify.com/fake-auth')
})

test('authenticated user navigating to /login is redirected to /', async ({ page }) => {
  await setupAuthenticatedHome(page)

  await page.goto('/login')

  await expect(page).toHaveURL('/')
})
