import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function relay(left: Page, right: Page) {
  const outbound = await left.evaluate(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__: { takeNet: () => unknown[] } }).__MOBILE_COMBAT__
    return api.takeNet()
  })
  const inbound = await right.evaluate(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__: { takeNet: () => unknown[] } }).__MOBILE_COMBAT__
    return api.takeNet()
  })
  await left.evaluate((messages) => {
    const api = (window as unknown as { __MOBILE_COMBAT__: { pushNet: (items: unknown[]) => void } }).__MOBILE_COMBAT__
    api.pushNet(messages)
  }, inbound)
  await right.evaluate((messages) => {
    const api = (window as unknown as { __MOBILE_COMBAT__: { pushNet: (items: unknown[]) => void } }).__MOBILE_COMBAT__
    api.pushNet(messages)
  }, outbound)
}

test('two browsers fight in sync through the loopback transport', async ({ browser, baseURL }) => {
  const hostContext = await browser.newContext({ baseURL })
  const guestContext = await browser.newContext({ baseURL })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  await host.goto('/mobile-combat/?debug=1&net=loopback')
  await guest.goto('/mobile-combat/?debug=1&net=loopback')
  await host.waitForFunction(() => (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__?.ready)
  await guest.waitForFunction(() => (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__?.ready)

  await host.keyboard.press('Enter')
  await guest.keyboard.press('Enter')
  await host.getByTestId('main-online').click()
  await guest.getByTestId('main-online').click()
  await host.getByTestId('input-delay').fill('3')
  await host.getByTestId('online-host').click()
  await expect(host.getByTestId('room-code')).toContainText('Room ')
  const code = (await host.getByTestId('room-code').innerText()).replace('Room ', '').trim()
  await guest.getByTestId('join-code').fill(code)
  await guest.getByTestId('online-join').click()

  await expect.poll(async () => {
    await relay(host, guest)
    return host.getByTestId('online-status').innerText()
  }, { timeout: 15000 }).toContain('Connected')

  await host.getByTestId('online-character').selectOption('maria')
  await guest.getByTestId('online-character').selectOption('brute')
  await host.getByTestId('online-arena').selectOption('ember-pit')
  await relay(host, guest)
  await relay(host, guest)
  await expect(guest.getByTestId('online-opponent')).toContainText('Maria')
  await expect(host.getByTestId('online-opponent')).toContainText('Brute')
  await expect(guest.getByTestId('online-arena')).toHaveValue('ember-pit')

  await host.getByTestId('online-ready').click()
  await guest.getByTestId('online-ready').click()
  await expect.poll(async () => {
    await relay(host, guest)
    return host.evaluate(() => {
      const api = (window as unknown as { __MOBILE_COMBAT__: { netInfo: () => { phase: string; frame: number } } }).__MOBILE_COMBAT__
      return api.netInfo()
    })
  }, { timeout: 30000 }).toMatchObject({ phase: 'start' })

  const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }
  await host.evaluate((intent) => {
    const api = (window as unknown as { __MOBILE_COMBAT__: { setIntent: (id: string, value: typeof intent) => void } }).__MOBILE_COMBAT__
    api.setIntent('player1', intent)
  }, { ...idle, move: 1 })
  await guest.evaluate((intent) => {
    const api = (window as unknown as { __MOBILE_COMBAT__: { setIntent: (id: string, value: typeof intent) => void } }).__MOBILE_COMBAT__
    api.setIntent('player2', intent)
  }, { ...idle, move: -1, crouch: true })

  let shared = 0
  for (let tick = 0; tick < 25; tick += 1) {
    await relay(host, guest)
    await host.waitForTimeout(40)
  }
  const info = await host.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { netInfo: () => { confirmed: number; desync: boolean; frame: number } }
    }).__MOBILE_COMBAT__
    return api.netInfo()
  })
  const other = await guest.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { netInfo: () => { confirmed: number; desync: boolean } }
    }).__MOBILE_COMBAT__
    return api.netInfo()
  })
  shared = Math.min(info.confirmed, other.confirmed)
  expect(info.desync).toBe(false)
  expect(other.desync).toBe(false)
  expect(shared).toBeGreaterThan(10)
  const sums = await Promise.all([
    host.evaluate((frame) => {
      const api = (window as unknown as { __MOBILE_COMBAT__: { netSum: (index: number) => number } }).__MOBILE_COMBAT__
      return api.netSum(frame)
    }, shared),
    guest.evaluate((frame) => {
      const api = (window as unknown as { __MOBILE_COMBAT__: { netSum: (index: number) => number } }).__MOBILE_COMBAT__
      return api.netSum(frame)
    }, shared),
  ])
  expect(sums[0]).toBe(sums[1])
  expect(sums[0]).not.toBe(0)
  await expect(host.getByTestId('net-status')).toContainText('Live')

  const predicted = await host.evaluate((intent) => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setIntent: (id: string, value: typeof intent) => void
        stepFor: (seconds: number) => void
        getAudio: () => { lastCue: string | null }
        netInfo: () => { frame: number; confirmed: number }
      }
    }).__MOBILE_COMBAT__
    api.setIntent('player1', { ...intent, attackDown: false, move: 1 })
    api.stepFor(1)
    api.setIntent('player1', intent)
    api.stepFor(0.5)
    return { cue: api.getAudio().lastCue, ...api.netInfo() }
  }, { ...idle, attackDown: true })
  expect(predicted.cue).toBe('hit')
  expect(predicted.frame).toBeGreaterThan(predicted.confirmed)

  await host.keyboard.press('Escape')
  await expect.poll(async () => {
    await relay(host, guest)
    return guest.getByTestId('online-disconnect').isVisible()
  }, { timeout: 10000 }).toBe(true)

  await hostContext.close()
  await guestContext.close()
})
