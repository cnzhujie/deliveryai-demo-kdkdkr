import { test, expect, type Locator, type Page } from '@playwright/test'

// 移动端适配 Spec（REQ-001 ~ REQ-006）验收：显式设置视口，覆盖 320 / 375 / 640 / 768 / 820 / 1023 / 1024 / 1280。
const VIEWPORTS = {
  narrow: { width: 320, height: 640 },
  mobile: { width: 375, height: 812 },
  gridBreakpoint: { width: 640, height: 900 },
  tablet: { width: 768, height: 1024 },
  ipadAir: { width: 820, height: 1180 },
  tabletMax: { width: 1023, height: 768 },
  desktopMin: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 720 },
} as const

const MIN_TOUCH = 44
const SIZE_TOLERANCE = 0.5

/** 从首页绑定 A08 桌台并进入点餐视图（menu）。 */
async function enterMenu(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click() // home → welcome
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click() // welcome → menu
  await expect(page.getByRole('heading', { name: '想吃什么，一起点。' })).toBeVisible()
}

/** 断言页面没有水平滚动条（允许 1px 亚像素误差）。 */
async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  expect(
    metrics.docScrollWidth,
    `documentElement.scrollWidth=${metrics.docScrollWidth}, clientWidth=${metrics.docClientWidth}`,
  ).toBeLessThanOrEqual(metrics.docClientWidth + 1)
  expect(metrics.bodyScrollWidth, `body.scrollWidth=${metrics.bodyScrollWidth}`).toBeLessThanOrEqual(metrics.docClientWidth + 1)
}

/** 断言单个元素触控区域 ≥ 44×44px。 */
async function expectTouchTarget(locator: Locator, label: string) {
  const box = await locator.boundingBox()
  expect(box, `${label} 应可见并可测量`).not.toBeNull()
  expect(box!.width, `${label} 宽度 ${box!.width.toFixed(1)}px 应 ≥ ${MIN_TOUCH}px`).toBeGreaterThanOrEqual(MIN_TOUCH - SIZE_TOLERANCE)
  expect(box!.height, `${label} 高度 ${box!.height.toFixed(1)}px 应 ≥ ${MIN_TOUCH}px`).toBeGreaterThanOrEqual(MIN_TOUCH - SIZE_TOLERANCE)
}

/** 批量断言 scope 内所有可见按钮的触控区域 ≥ 44×44px。 */
async function expectAllVisibleButtonsMinTouch(scope: Locator, scopeLabel: string) {
  const buttons = scope.locator('button')
  const count = await buttons.count()
  const tooSmall: string[] = []
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index)
    if (!(await button.isVisible())) continue
    const box = await button.boundingBox()
    const name = (await button.getAttribute('aria-label')) || (await button.innerText()).trim().slice(0, 24) || `button#${index}`
    if (!box) {
      tooSmall.push(`${name}: 无法测量`)
      continue
    }
    if (box.width < MIN_TOUCH - SIZE_TOLERANCE || box.height < MIN_TOUCH - SIZE_TOLERANCE) {
      tooSmall.push(`${name}: ${box.width.toFixed(1)}×${box.height.toFixed(1)}px`)
    }
  }
  expect(tooSmall, `${scopeLabel} 中以下按钮触控区域小于 ${MIN_TOUCH}px`).toEqual([])
}

/** 打开菜品规格弹窗（默认推荐分类第一张卡片）。 */
async function openFirstProductDialog(page: Page) {
  const firstCard = page.locator('article').first()
  await expect(firstCard).toBeVisible()
  await firstCard.locator('button').last().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: '加入本桌购物车' })).toBeVisible()
  return dialog
}

/** 将第一道菜加入购物车，等待弹窗关闭。 */
async function addFirstProductToCart(page: Page) {
  const dialog = await openFirstProductDialog(page)
  await dialog.getByRole('button', { name: '加入本桌购物车' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/** 关闭指定标题的弹窗。 */
async function closeDialog(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title })
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
}

async function boxOf(locator: Locator, label: string) {
  const box = await locator.boundingBox()
  expect(box, `${label} 应可见并可测量`).not.toBeNull()
  return box!
}

test.describe('移动端适配 - TopBar 小屏布局（REQ-001）', () => {
  test('REQ-001.1: 320px 下 TopBar 无横向溢出，桌台号与服务呼叫直接可见可用', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.narrow)
    await expectNoHorizontalOverflow(page)

    const header = page.locator('header')
    await expect(header).toBeVisible()
    // 桌台号允许截断，但不能隐藏
    await expect(header.getByText('A08 · 大厅')).toBeVisible()

    const serviceButton = page.getByRole('button', { name: '呼叫服务' })
    const moreButton = page.getByRole('button', { name: '更多功能' })
    await expect(serviceButton).toBeVisible()
    await expect(moreButton).toBeVisible()

    // 关键入口必须完整落在 320px 视口内
    for (const [label, button] of [['呼叫服务', serviceButton], ['更多功能', moreButton]] as const) {
      const box = await boxOf(button, label)
      expect(box.x, `${label} 左边界`).toBeGreaterThanOrEqual(-SIZE_TOLERANCE)
      expect(box.x + box.width, `${label} 右边界`).toBeLessThanOrEqual(VIEWPORTS.narrow.width + SIZE_TOLERANCE)
    }

    // 服务呼叫可直接打开桌边服务
    await serviceButton.click()
    await expect(page.getByRole('dialog', { name: '桌边服务' })).toBeVisible()
    await closeDialog(page, '桌边服务')

    // 「更多」收纳入口完整可用
    await moreButton.click()
    const moreDialog = page.getByRole('dialog', { name: '更多' })
    await expect(moreDialog).toBeVisible()
    for (const name of ['会员与排号', '演示控制台', '老人模式', 'EN']) {
      await expect(moreDialog.getByRole('button', { name })).toBeVisible()
    }
    await moreDialog.getByRole('button', { name: '演示控制台' }).click()
    await expect(page.getByRole('dialog', { name: '演示控制台' })).toBeVisible()
    await closeDialog(page, '演示控制台')
  })

  test('REQ-001.2: 375px 下低频入口收纳到「更多」，直接入口保持可见', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)

    const header = page.locator('header')
    await expect(header.getByText('A08 · 大厅')).toBeVisible()
    await expect(page.getByRole('button', { name: '呼叫服务' })).toBeVisible()
    await expect(page.getByRole('button', { name: '更多功能' })).toBeVisible()

    // 低频入口在手机端不直接占据 TopBar
    await expect(page.getByRole('button', { name: '会员与排号' })).toBeHidden()
    await expect(page.getByRole('button', { name: '演示控制台' })).toBeHidden()
    await expect(page.getByRole('button', { name: '切换至老人模式' })).toBeHidden()
    await expect(page.getByRole('button', { name: '切换语言' })).toBeHidden()

    await page.getByRole('button', { name: '更多功能' }).click()
    const moreDialog = page.getByRole('dialog', { name: '更多' })
    await expect(moreDialog).toBeVisible()
    for (const name of ['会员与排号', '演示控制台', '老人模式', 'EN']) {
      await expect(moreDialog.getByRole('button', { name })).toBeVisible()
    }
    await closeDialog(page, '更多')
  })

  test('REQ-001.5: 1280px 桌面端 TopBar 仍直接展示全部功能入口', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.desktop)

    const header = page.locator('header')
    await expect(header.getByText('A08 · 大厅')).toBeVisible()
    await expect(header.getByRole('button', { name: '点餐' })).toBeVisible()
    await expect(header.getByRole('button', { name: '订单' })).toBeVisible()
    await expect(page.getByRole('button', { name: '会员与排号' })).toBeVisible()
    await expect(page.getByRole('button', { name: '演示控制台' })).toBeVisible()
    await expect(page.getByRole('button', { name: '切换至老人模式' })).toBeVisible()
    await expect(page.getByRole('button', { name: '切换语言' })).toBeVisible()
    await expect(page.getByRole('button', { name: '更多功能' })).toBeHidden()

    await expect(page.locator('nav')).toBeHidden()
    await expect(page.locator('aside')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

test.describe('移动端适配 - 平板断点布局（REQ-002）', () => {
  test('REQ-002.1: 768px 下菜单页为紧凑双列且内容区无大面积空白', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.tablet)
    await expectNoHorizontalOverflow(page)

    const cards = page.locator('article')
    const first = await boxOf(cards.nth(0), '第 1 张菜品卡片')
    const second = await boxOf(cards.nth(1), '第 2 张菜品卡片')
    const third = await boxOf(cards.nth(2), '第 3 张菜品卡片')

    expect(Math.abs(first.y - second.y), '768px 下前两张卡片应同排（2 列）').toBeLessThanOrEqual(1)
    expect(second.x, '第二列应在第一列右侧').toBeGreaterThan(first.x + first.width - 1)
    expect(third.y, '第三张卡片应换行').toBeGreaterThan(first.y + first.height - 1)

    const columnGap = second.x - (first.x + first.width)
    expect(columnGap, 'md 断点卡片间距应 ≥ 16px').toBeGreaterThanOrEqual(16 - SIZE_TOLERANCE)

    const usedWidth = second.x + second.width - first.x
    expect(usedWidth, '内容区应充分利用 768px 宽度').toBeGreaterThanOrEqual(VIEWPORTS.tablet.width * 0.85)
  })

  test('REQ-002.2: 820px iPad Air 竖屏下卡片信息可清晰阅读', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.ipadAir)
    await expectNoHorizontalOverflow(page)

    const firstCard = page.locator('article').first()
    const first = await boxOf(firstCard, '第 1 张菜品卡片')
    expect(first.width, '820px 下卡片宽度应足以展示图片与描述').toBeGreaterThanOrEqual(350)
    await expect(firstCard.getByRole('heading')).toBeVisible()
    await expect(firstCard.locator('img')).toBeVisible()
    await expect(firstCard.locator('button').last()).toBeVisible()
  })

  test('REQ-002.3: 1023px 保持双列，1024px 起恢复桌面侧栏布局', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.tabletMax)
    await expect(page.locator('aside')).toBeHidden()
    await expectNoHorizontalOverflow(page)

    const cards = page.locator('article')
    const first = await boxOf(cards.nth(0), '第 1 张菜品卡片')
    const second = await boxOf(cards.nth(1), '第 2 张菜品卡片')
    expect(Math.abs(first.y - second.y), '1023px 下仍为双列').toBeLessThanOrEqual(1)

    await page.setViewportSize(VIEWPORTS.desktopMin)
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('nav')).toBeHidden()
    await expectNoHorizontalOverflow(page)
  })
})

test.describe('移动端适配 - 菜品网格窄屏（REQ-003）', () => {
  test('REQ-003.1: 320px 下菜品网格为单列，卡片内容与加入按钮完整可用', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.narrow)
    const cards = page.locator('article')
    await expect(cards).toHaveCount(10)

    const first = await boxOf(cards.nth(0), '第 1 张菜品卡片')
    const second = await boxOf(cards.nth(1), '第 2 张菜品卡片')
    expect(Math.abs(first.x - second.x), '320px 下应单列对齐').toBeLessThanOrEqual(1)
    expect(second.y, '320px 下第 2 张卡片应换行').toBeGreaterThan(first.y + first.height - 1)
    expect(first.width, '320px 下卡片应占满可用宽度').toBeGreaterThan(VIEWPORTS.narrow.width - 40)

    await expect(cards.nth(0).getByRole('heading')).toBeVisible()
    await expect(cards.nth(0).locator('img')).toBeVisible()
    await expectTouchTarget(cards.nth(0).locator('button').last(), '320px 菜品加入按钮')

    const objectFit = await cards.nth(0).locator('img').evaluate((element) => getComputedStyle(element).objectFit)
    expect(objectFit, '菜品图片应以 cover 等比裁切，避免拉伸').toBe('cover')
  })

  test('REQ-003.2: 375px 下保持单列，加入按钮触控区域 ≥ 44×44', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)
    const cards = page.locator('article')
    const first = await boxOf(cards.nth(0), '第 1 张菜品卡片')
    const second = await boxOf(cards.nth(1), '第 2 张菜品卡片')
    expect(Math.abs(first.x - second.x), '375px 下应单列对齐').toBeLessThanOrEqual(1)
    expect(second.y, '375px 下第 2 张卡片应换行').toBeGreaterThan(first.y + first.height - 1)
    await expectTouchTarget(cards.nth(0).locator('button').last(), '375px 菜品加入按钮')
  })

  test('REQ-003.3: 640px 起恢复双列布局', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.gridBreakpoint)
    const cards = page.locator('article')
    const first = await boxOf(cards.nth(0), '第 1 张菜品卡片')
    const second = await boxOf(cards.nth(1), '第 2 张菜品卡片')
    expect(Math.abs(first.y - second.y), '640px 下前两张卡片应同排（2 列）').toBeLessThanOrEqual(1)
    expect(second.x, '第二列应在第一列右侧').toBeGreaterThan(first.x + first.width - 1)
  })
})

test.describe('移动端适配 - Sticky 层级（REQ-004）', () => {
  test('REQ-004.1: 375px 下滚动时搜索栏稳定吸附在 TopBar 下方且无遮挡', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)
    const header = page.locator('header')
    const searchInput = page.getByPlaceholder('搜索锅底、菜品或饮品')

    await page.evaluate(() => window.scrollTo(0, 700))
    await page.waitForFunction(() => window.scrollY > 300)

    const headerStyle = await header.evaluate((element) => {
      const style = getComputedStyle(element)
      return { position: style.position, top: style.top, zIndex: style.zIndex }
    })
    expect(headerStyle, 'TopBar 应为 sticky top-0 z-30').toEqual({ position: 'sticky', top: '0px', zIndex: '30' })

    const stickyStyle = await searchInput.evaluate((element) => {
      let node: HTMLElement | null = element.parentElement
      while (node) {
        const style = getComputedStyle(node)
        if (style.position === 'sticky') return { top: style.top, zIndex: style.zIndex }
        node = node.parentElement
      }
      return null
    })
    expect(stickyStyle, '搜索栏应为 sticky top-16 z-20，与 64px 头部对齐').toEqual({ top: '64px', zIndex: '20' })

    const headerBox = await boxOf(header, 'TopBar')
    const searchBox = await boxOf(searchInput, '搜索输入框')
    expect(headerBox.y, '滚动后 TopBar 应吸附在视口顶部').toBeLessThanOrEqual(1)
    expect(searchBox.y, '搜索栏不应被 TopBar 遮挡').toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1)
    expect(searchBox.y, '搜索栏与 TopBar 之间不应出现明显空隙').toBeLessThanOrEqual(headerBox.y + headerBox.height + 2)

    // 等待过渡/滚动稳定后位置不应跳动（无闪烁）
    await page.waitForTimeout(350)
    const searchBoxAfter = await searchInput.boundingBox()
    expect(searchBoxAfter).not.toBeNull()
    expect(Math.abs(searchBoxAfter!.y - searchBox.y), '搜索栏吸附位置应稳定').toBeLessThanOrEqual(1)
  })

  test('REQ-004.3: 1280px 桌面端滚动时搜索栏不被 TopBar 遮挡', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.desktop)
    const header = page.locator('header')
    const searchInput = page.getByPlaceholder('搜索锅底、菜品或饮品')

    await page.evaluate(() => window.scrollTo(0, 600))
    await page.waitForFunction(() => window.scrollY > 300)

    const headerBox = await boxOf(header, 'TopBar')
    const searchBox = await boxOf(searchInput, '搜索输入框')
    expect(searchBox.y, '桌面端搜索栏不应被 TopBar 遮挡').toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1)
    expect(searchBox.y, '桌面端搜索栏与 TopBar 之间不应出现明显空隙').toBeLessThanOrEqual(headerBox.y + headerBox.height + 2)
  })
})

test.describe('移动端适配 - 触控区域（REQ-005）', () => {
  test('REQ-005.1: 375px 下 TopBar 所有可见按钮触控区域 ≥ 44×44', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)
    await expectAllVisibleButtonsMinTouch(page.locator('header'), '375px TopBar')
  })

  test('REQ-005.2: 375px 下底部导航栏各导航项触控区域 ≥ 44×44', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    const navItems = nav.locator('button')
    await expect(navItems).toHaveCount(4)
    for (let index = 0; index < 4; index += 1) {
      await expectTouchTarget(navItems.nth(index), `底部导航第 ${index + 1} 项`)
    }
  })

  test('REQ-005.3: 320px 老人模式下触控区域 ≥ 44px 且布局不溢出', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.narrow)
    await page.getByRole('button', { name: '更多功能' }).click()
    const moreDialog = page.getByRole('dialog', { name: '更多' })
    await moreDialog.getByRole('button', { name: '老人模式' }).click()

    await expect(page.locator('html')).toHaveClass(/elderly/)
    // 等待老人模式 250ms 字号过渡完成后再测量
    await page.waitForTimeout(400)
    const fontSize = await page.locator('html').evaluate((element) => getComputedStyle(element).fontSize)
    expect(fontSize, '老人模式字号应放大至 125%').toBe('20px')
    await expectNoHorizontalOverflow(page)
    await expectAllVisibleButtonsMinTouch(page.locator('body'), '320px 老人模式页面')
  })

  test('REQ-005.4: 375px 下菜品弹窗内所有按钮触控区域 ≥ 44×44', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)
    const dialog = await openFirstProductDialog(page)
    await expectAllVisibleButtonsMinTouch(dialog, '菜品规格弹窗')
  })
})

test.describe('移动端适配 - 底部导航与浮动按钮（REQ-006）', () => {
  test('REQ-006.1: 375px 下浮动购物车按钮与底部导航不重叠且均可点击', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)
    await addFirstProductToCart(page)

    const floatingCart = page.getByRole('button', { name: /查看购物车/ })
    const nav = page.locator('nav')
    await expect(floatingCart).toBeVisible()
    await expect(nav).toBeVisible()

    const floatingBox = await boxOf(floatingCart, '浮动购物车按钮')
    const navBox = await boxOf(nav, '底部导航栏')
    expect(
      floatingBox.y + floatingBox.height,
      `浮动按钮底部 ${(floatingBox.y + floatingBox.height).toFixed(1)}px 应在导航栏顶部 ${navBox.y.toFixed(1)}px 之上`,
    ).toBeLessThanOrEqual(navBox.y + SIZE_TOLERANCE)

    // 浮动按钮完整可点击
    await floatingCart.click()
    await expect(page.getByRole('dialog', { name: '本桌购物车' })).toBeVisible()
    await closeDialog(page, '本桌购物车')

    // 底部导航各项可独立点击
    await nav.getByRole('button', { name: '订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    await expect(page.getByRole('heading', { name: '这一锅，正在抵达' })).toBeVisible()
    await nav.getByRole('button', { name: '点餐' }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByRole('heading', { name: '想吃什么，一起点。' })).toBeVisible()
  })
})

test.describe('移动端适配 - 核心流程与内容正确性', () => {
  test('FLOW-001: 375px 手机端完成 menu → order → checkout 全流程', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.mobile)
    await addFirstProductToCart(page)
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: /查看购物车/ }).click()
    const cartDialog = page.getByRole('dialog', { name: '本桌购物车' })
    await expect(cartDialog).toBeVisible()
    await cartDialog.getByRole('button', { name: '提交加菜' }).click()

    await expect(page).toHaveURL(/#\/order$/)
    await expect(page.getByRole('heading', { name: '这一锅，正在抵达' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: '去结账' }).click()
    await expect(page).toHaveURL(/#\/checkout$/)
    await expect(page.getByRole('heading', { name: '核对本桌账单' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: /确认支付/ }).click()
    await expect(page.getByRole('heading', { name: '付款完成' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('NFR-001: 320px 下主流程各页面均无水平溢出', async ({ page }) => {
    await enterMenu(page, VIEWPORTS.narrow)
    await expectNoHorizontalOverflow(page)

    await addFirstProductToCart(page)
    await page.getByRole('button', { name: /查看购物车/ }).click()
    const cartDialog = page.getByRole('dialog', { name: '本桌购物车' })
    await cartDialog.getByRole('button', { name: '提交加菜' }).click()

    await expect(page.getByRole('heading', { name: '这一锅，正在抵达' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: '去结账' }).click()
    await expect(page.getByRole('heading', { name: '核对本桌账单' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
