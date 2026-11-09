import { test, expect, type Locator, type Page } from '@playwright/test'

const CONSOLE_DIALOG_NAME = /演示控制台|Demo Console/
const LOG_SECTION_HEADING = /^(操作日志|Activity Log)$/

/** 从首页绑定 A08 桌台，进入欢迎页。 */
async function bindTable(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await expect(page).toHaveURL(/#\/welcome$/)
}

/** 绑定 A08 桌台并进入点餐视图。 */
async function enterMenu(page: Page) {
  await bindTable(page)
  await page.getByRole('button', { name: /进入点餐|Start Ordering/ }).click()
  await expect(page).toHaveURL(/#\/menu$/)
}

/** 打开指定序号的菜品规格弹窗并加入本桌购物车。默认使用第 3 个菜品（琥珀嫩牛肉）。 */
async function addDish(page: Page, productIndex = 2) {
  const card = page.locator('article').nth(productIndex)
  await expect(card).toBeVisible()
  await card.getByRole('button').last().click()
  await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/ }).click()
  await expect(page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/ })).toBeHidden()
}

/** 提交当前购物车中的订单。 */
async function submitOrder(page: Page) {
  await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
  await expect(page).toHaveURL(/#\/order$/)
}

/** 打开 DemoConsole 并返回弹窗 locator。 */
async function openConsole(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: CONSOLE_DIALOG_NAME })
  if (!(await dialog.isVisible())) {
    await page.getByRole('button', { name: CONSOLE_DIALOG_NAME }).click()
  }
  await expect(dialog).toBeVisible()
  return dialog
}

/** 关闭 DemoConsole。 */
async function closeConsole(page: Page) {
  const dialog = page.getByRole('dialog', { name: CONSOLE_DIALOG_NAME })
  await dialog.getByRole('button', { name: /完成设置|Done/ }).click()
  await expect(dialog).toBeHidden()
}

/** 定位 DemoConsole 内的“操作日志”分区。 */
function logSection(dialog: Locator): Locator {
  return dialog.getByRole('heading', { name: LOG_SECTION_HEADING }).locator('..').locator('..')
}

test.describe('DemoConsole 操作日志 - E2E 验收测试', () => {
  test('AC-1: 绑定桌台后记录绑定日志', async ({ page }) => {
    await enterMenu(page)
    const dialog = await openConsole(page)
    const logs = logSection(dialog)

    await expect(logs.getByText('绑定桌台 A08', { exact: true })).toBeVisible()
    // 进入点餐仅触发 SET_VIEW，不应生成额外日志
    await expect(logs.locator('li')).toHaveCount(1)
  })

  test('AC-2: 加菜后记录点餐人、菜名与规格', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)
    const dialog = await openConsole(page)
    const logs = logSection(dialog)

    await expect(logs.getByText('姚乾 添加 琥珀嫩牛肉（整份 · 原味）', { exact: true })).toBeVisible()
    await expect(logs.locator('li').first().locator('span').first()).toHaveText(/^\d{2}:\d{2}$/)
  })

  test('AC-3: 修改数量与数量归零时记录正确文案', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)

    await page.getByRole('button', { name: '增加' }).click()
    let dialog = await openConsole(page)
    let logs = logSection(dialog)
    await expect(logs.getByText('琥珀嫩牛肉 数量 1 → 2', { exact: true })).toBeVisible()
    await closeConsole(page)

    await page.getByRole('button', { name: '减少' }).click()
    await page.getByRole('button', { name: '减少' }).click()
    dialog = await openConsole(page)
    logs = logSection(dialog)
    await expect(logs.getByText('琥珀嫩牛肉 已移除', { exact: true })).toBeVisible()
    await expect(logs.locator('li').first()).toContainText('琥珀嫩牛肉 已移除')
  })

  test('AC-4: 提交订单后记录菜数', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)
    await submitOrder(page)
    const dialog = await openConsole(page)

    await expect(logSection(dialog).getByText('提交订单，共 1 道菜', { exact: true })).toBeVisible()
  })

  test('AC-5: 切换履约阶段后记录目标阶段', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)
    await submitOrder(page)
    const dialog = await openConsole(page)

    await dialog.getByRole('button', { name: '制作中', exact: true }).click()
    await expect(logSection(dialog).getByText('订单状态变更为 制作中', { exact: true })).toBeVisible()
  })

  test('AC-6: 呼叫与响应服务后分别记录服务名和响应数量', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: '呼叫服务' }).click()
    await page.getByRole('button', { name: /^加汤/ }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '桌边服务' })).toBeHidden()

    const dialog = await openConsole(page)
    const logs = logSection(dialog)
    await expect(logs.getByText('呼叫服务：加汤', { exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: '模拟服务员响应' }).click()
    await expect(logs.getByText('响应 1 个服务请求', { exact: true })).toBeVisible()
  })

  test('AC-7: 售罄切换后记录菜品与方向', async ({ page }) => {
    await enterMenu(page)
    const dialog = await openConsole(page)
    const logs = logSection(dialog)
    const soldOutButton = dialog.getByRole('button', { name: '鎏金番茄鸳鸯锅', exact: true })

    await soldOutButton.click()
    await expect(logs.getByText('鎏金番茄鸳鸯锅 设为售罄', { exact: true })).toBeVisible()

    await soldOutButton.click()
    await expect(logs.getByText('鎏金番茄鸳鸯锅 恢复供应', { exact: true })).toBeVisible()
    await expect(logs.locator('li').first()).toContainText('鎏金番茄鸳鸯锅 恢复供应')
  })

  test('AC-8: 支付后记录完成支付', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)
    await submitOrder(page)
    await page.getByRole('button', { name: /去结账|Checkout/ }).click()
    await expect(page).toHaveURL(/#\/checkout$/)
    await page.getByRole('button', { name: /确认支付/ }).click()
    await expect(page.getByText('付款完成', { exact: true })).toBeVisible()

    const dialog = await openConsole(page)
    await expect(logSection(dialog).getByText('完成支付', { exact: true })).toBeVisible()
  })

  test('AC-9: 日志超过 50 条时移除最旧条目', async ({ page }) => {
    await enterMenu(page)
    const dialog = await openConsole(page)
    const logs = logSection(dialog)
    const soldOutButton = dialog.getByRole('button', { name: '鎏金番茄鸳鸯锅', exact: true })

    // 已有 1 条绑定日志，再切换售罄 55 次，共 56 条，应截断为最近 50 条
    for (let i = 0; i < 55; i += 1) {
      await soldOutButton.click()
    }

    await expect(logs.locator('li')).toHaveCount(50)
    await expect(logs.getByText('绑定桌台 A08', { exact: true })).toHaveCount(0)
    await expect(logs.locator('li').first()).toContainText('鎏金番茄鸳鸯锅 设为售罄')
  })

  test('AC-10: 一键重置后清空历史日志', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)
    let dialog = await openConsole(page)
    await expect(logSection(dialog).getByText('姚乾 添加 琥珀嫩牛肉（整份 · 原味）', { exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: '一键重置演示' }).click()
    await expect(page.getByRole('button', { name: /A08/ }).first()).toBeVisible()

    // 重置后重新进入，只会产生本次新的绑定日志，旧加菜日志不应残留
    await enterMenu(page)
    dialog = await openConsole(page)
    const logs = logSection(dialog)
    await expect(logs.locator('li')).toHaveCount(1)
    await expect(logs.getByText('绑定桌台 A08', { exact: true })).toBeVisible()
    await expect(logs.getByText('姚乾 添加 琥珀嫩牛肉（整份 · 原味）', { exact: true })).toHaveCount(0)
  })

  test('AC-11: 点击清空日志后展示空状态', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)
    const dialog = await openConsole(page)
    const logs = logSection(dialog)

    await dialog.getByRole('button', { name: '清空日志' }).click()
    await expect(logs.getByText('暂无操作记录', { exact: true })).toBeVisible()
    await expect(logs.locator('li')).toHaveCount(0)
  })

  test('AC-12: 日志按时间倒序展示，最新在最上方', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)
    const dialog = await openConsole(page)
    const items = logSection(dialog).locator('li')

    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('姚乾 添加 琥珀嫩牛肉（整份 · 原味）')
    await expect(items.nth(1)).toContainText('绑定桌台 A08')
  })

  test('AC-13: 无操作时展示空状态文案', async ({ page }) => {
    await page.goto('/?preview=menu')
    await expect(page).toHaveURL(/#\/menu$/)
    const dialog = await openConsole(page)

    await expect(logSection(dialog).getByText('暂无操作记录', { exact: true })).toBeVisible()
    await expect(logSection(dialog).locator('li')).toHaveCount(0)
  })

  test('AC-14: 切换语言后已有日志保持原语言，新日志使用新语言', async ({ page }) => {
    await enterMenu(page)
    await addDish(page)

    await page.getByRole('button', { name: '切换语言' }).click()
    await expect(page.getByRole('button', { name: 'Demo Console' })).toBeVisible()

    const dialog = await openConsole(page)
    const logs = logSection(dialog)
    await expect(logs.getByText('姚乾 添加 琥珀嫩牛肉（整份 · 原味）', { exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: 'Golden Tomato Dual-Flavor Pot', exact: true }).click()
    await expect(logs.getByText('Golden Tomato Dual-Flavor Pot marked sold out', { exact: true })).toBeVisible()
    await expect(logs.locator('li').first()).toContainText('Golden Tomato Dual-Flavor Pot marked sold out')
  })
})
