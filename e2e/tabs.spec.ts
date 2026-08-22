import { expect, test } from '@playwright/test'

/**
 * Tab behaviour, which is the other thing only a real browser can check.
 *
 * Both tabs are lazily loaded, so these exercise chunk loading against the
 * production base path — the case where a wrong `base` or a stale chunk hash
 * would break a tab while the shell still rendered fine.
 */

const INGOT = 'ingot'

test('loads the breeding tab named in the link', async ({ page }) => {
  await page.goto('?tab=breeding')

  await expect(page.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: /breeding dataset/i })).toBeVisible()
})

test('keeps the calculator build across a tab switch', async ({ page }) => {
  // CLAUDE.md's hidden-not-unmounted rule. A shared build is not persisted until
  // edited, so unmounting the calculator here would silently drop it.
  await page.goto(`?build=${INGOT}.3`)
  await expect(page.getByLabel('Ingot quantity')).toHaveValue('3')

  await page.getByRole('tab', { name: 'Breeding' }).click()
  await expect(page.getByRole('heading', { name: /breeding dataset/i })).toBeVisible()

  await page.getByRole('tab', { name: 'Calculator' }).click()
  await expect(page.getByLabel('Ingot quantity')).toHaveValue('3')
})

test('keeps every param in the URL across a tab switch', async ({ page }) => {
  // Three effects write this query. Any one rebuilding it wholesale erases the
  // others — the regression `applyState`/`applyTab`/`applyBreeding` exist to stop.
  await page.goto(`?build=${INGOT}.3&level=12`)
  await expect(page.getByLabel('Ingot quantity')).toHaveValue('3')

  await page.getByRole('tab', { name: 'Breeding' }).click()

  await expect(page).toHaveURL(new RegExp(`build=${INGOT}\\.3`))
  await expect(page).toHaveURL(/level=12/)
  await expect(page).toHaveURL(/tab=breeding/)
})

test('drops tab= again on the way back to the default', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'Breeding' }).click()
  await expect(page).toHaveURL(/tab=breeding/)

  await page.getByRole('tab', { name: 'Calculator' }).click()

  // An ordinary calculator link looks exactly as it did before tabs existed.
  await expect(page).not.toHaveURL(/tab=/)
})

test('moves between tabs with the arrow keys', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('tab', { name: 'Calculator' }).focus()
  await page.keyboard.press('ArrowRight')

  await expect(page.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Breeding' })).toBeFocused()
})

test('resolves a breeding pair from a link', async ({ page }) => {
  await page.goto('?tab=breeding&pair=chillet.arsox')

  // Scoped to the result panel on purpose. Every Pal name also appears in four
  // 299-option <select>s, so a bare getByText('Chillet Ignis') matches six
  // elements and fails strict mode without the app being wrong.
  const pairPanel = page.locator('section').filter({ hasText: 'Pair calculator' })

  await expect(pairPanel.locator('span').filter({ hasText: /^Chillet Ignis$/ })).toBeVisible()
  await expect(pairPanel.getByText('fixed combo')).toBeVisible()
})

test('solves a chain from a roster', async ({ page }) => {
  // The whole point of the breeding engine, exercised through the real UI.
  await page.goto('?tab=breeding')

  const roster = page.getByLabel('add a pal you own')
  await roster.selectOption('aegidron')
  await roster.selectOption('amione')
  await expect(page.getByText('2 pals')).toBeVisible()

  await page.getByLabel('pal you want').selectOption('anubis')

  const steps = page.locator('ol > li').filter({ hasText: /gen \d/ })
  await expect(steps.first()).toBeVisible()
  expect(await steps.count()).toBeGreaterThan(0)

  // Within the steps, not the page: "target" also appears in the picker's
  // placeholder and in the tie-break prose.
  await expect(steps.getByText('target', { exact: true })).toBeVisible()

  // Generations never decrease down the list, which is what makes the chain
  // runnable top to bottom.
  const gens = await steps.evaluateAll((nodes) =>
    nodes.map((n) => Number(/gen (\d+)/.exec(n.textContent ?? '')?.[1])),
  )
  expect(gens).toEqual([...gens].sort((a, b) => a - b))
})
