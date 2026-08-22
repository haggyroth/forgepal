import { expect, test } from '@playwright/test'

/**
 * The calculator's composed flows, against a production build.
 *
 * Everything here is deliberately end-to-end rather than a unit test: each of
 * these crosses shareState, query, storage, useBuilds and the App effects, and
 * every one of those has its own passing unit suite. What is not covered
 * elsewhere is that they compose, and that they compose *in the built artifact
 * served from `/forgepal/`* rather than in jsdom at `/`.
 */

const INGOT = 'ingot'

test('serves from the production base path', async ({ page }) => {
  // The failure this exists for: `base` resolving wrongly 404s every asset, and
  // the app still "loads" as a blank page with a 200 on the HTML.
  const failed: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`)
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ForgePal')

  expect(new URL(page.url()).pathname).toBe('/forgepal/')
  expect(failed).toEqual([])
})

test('opens a shared build link', async ({ page }) => {
  await page.goto(`?build=${INGOT}.7&level=25`)

  await expect(page.getByLabel('Ingot quantity')).toHaveValue('7')
  await expect(page.getByLabel(/tech level/i)).toHaveValue('25')
})

test('mirrors an edit back into the URL, so the link stays shareable', async ({ page }) => {
  await page.goto(`?build=${INGOT}.3`)
  await expect(page.getByLabel('Ingot quantity')).toHaveValue('3')

  await page.getByRole('button', { name: 'Increase Ingot' }).click()

  await expect(page.getByLabel('Ingot quantity')).toHaveValue('4')
  await expect(page).toHaveURL(new RegExp(`build=${INGOT}\\.4`))
})

test('survives a reload with the build intact', async ({ page }) => {
  // The round trip the unit tests can only check a leg of at a time:
  // state -> URL -> storage -> reload -> decode -> render.
  await page.goto(`?build=${INGOT}.3`)
  await page.getByRole('button', { name: 'Increase Ingot' }).click()
  await expect(page.getByLabel('Ingot quantity')).toHaveValue('4')

  await page.reload()

  await expect(page.getByLabel('Ingot quantity')).toHaveValue('4')
})

test('restores a saved build on a bare visit, with no query at all', async ({ page }) => {
  await page.goto(`?build=${INGOT}.5`)
  await page.getByRole('button', { name: 'Increase Ingot' }).click()

  // Navigate away from the query entirely — persistence, not the URL, has to
  // carry it now.
  await page.goto('./')

  await expect(page.getByLabel('Ingot quantity')).toHaveValue('6')
})

test('exports the requisition as a Markdown download', async ({ page }) => {
  await page.goto(`?build=${INGOT}.3`)
  await expect(page.getByLabel('Ingot quantity')).toHaveValue('3')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'download .md' }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/\.md$/)

  const stream = await download.createReadStream()
  const text = await new Promise<string>((resolve, reject) => {
    let out = ''
    stream.on('data', (c) => (out += c))
    stream.on('end', () => resolve(out))
    stream.on('error', reject)
  })

  // Enough to prove it is the real export rather than an empty file.
  expect(text).toContain('Ingot')
  expect(text.length).toBeGreaterThan(50)
})

test('reports a link naming an item the dataset no longer has', async ({ page }) => {
  await page.goto('?build=ghost-widget.3')

  const notice = page.getByRole('status')
  await expect(notice).toContainText('no longer in the dataset')
  await expect(notice).toContainText('ghost-widget')
})
