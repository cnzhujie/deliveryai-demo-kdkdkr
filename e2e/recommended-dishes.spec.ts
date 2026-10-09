import { test, expect, type Page } from '@playwright/test'

/**
 * 推荐菜模块 E2E 验收测试
 * 覆盖 Spec REQ-001（展示）、REQ-002（点击交互）、REQ-003（数据来源与排序）
 * 被测分支：feat/homepage-recommended-dishes-n9rh @ e08a21b
 */

/** 推荐菜预期数据（badge 优先级 popular > signature > chef > new，取前 3） */
const EXPECTED_DISHES = [
  { name: '鎏金番茄鸳鸯锅', price: '¥68', badge: '人气 No.1' },
  { name: '牛油麻辣锅', price: '¥59', badge: '招牌' },
  { name: '琥珀嫩牛肉', price: '¥42', badge: '主厨推荐' },
]

test.describe('首页推荐菜模块 - E2E 验收测试', () => {

  test.describe('REQ-001: 推荐菜模块展示', () => {
    test('REQ-001.1: 首页桌台选择区域下方展示推荐菜模块', async ({ page }) => {
      await page.goto('/')
      // 推荐菜标题可见
      await expect(page.getByText('人气好菜抢先看')).toBeVisible()
      await expect(page.getByText('点击即绑桌点餐，好味不用等')).toBeVisible()
    })

    test('REQ-001.2: 推荐菜展示 3 道菜品，每道含图片、名称、价格和 badge', async ({ page }) => {
      await page.goto('/')
      // 推荐菜区域内的卡片按钮
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')
      await expect(dishCards).toHaveCount(3)

      for (let i = 0; i < EXPECTED_DISHES.length; i++) {
        const card = dishCards.nth(i)
        const dish = EXPECTED_DISHES[i]
        // 菜品名称
        await expect(card.getByRole('heading', { name: dish.name })).toBeVisible()
        // 价格
        await expect(card.getByText(dish.price)).toBeVisible()
        // badge 标签
        await expect(card.getByText(dish.badge)).toBeVisible()
        // 图片
        await expect(card.locator('img')).toBeVisible()
      }
    })

    test('REQ-001.3: 推荐菜模块在桌台选择区域下方（DOM 顺序）', async ({ page }) => {
      await page.goto('/')
      const quickEnterBtn = page.getByRole('button', { name: /快速进入 A08 桌/ })
      const recommendedTitle = page.getByText('人气好菜抢先看')
      // 推荐菜标题在快速进入按钮之后
      const quickEnterBox = await quickEnterBtn.boundingBox()
      const recommendedBox = await recommendedTitle.boundingBox()
      expect(quickEnterBox).not.toBeNull()
      expect(recommendedBox).not.toBeNull()
      expect(recommendedBox!.y).toBeGreaterThan(quickEnterBox!.y)
    })
  })

  test.describe('REQ-002: 推荐菜点击交互', () => {
    test('REQ-002.1: 点击推荐菜自动绑定 A08 桌并跳转菜单页', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveURL(/#\/home$/)

      // 点击第一道推荐菜
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')
      await dishCards.nth(0).click()

      // URL 变为 #/menu
      await expect(page).toHaveURL(/#\/menu$/)
    })

    test('REQ-002.2: 跳转后菜单页正常展示菜品列表', async ({ page }) => {
      await page.goto('/')
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')
      await dishCards.nth(0).click()

      await expect(page).toHaveURL(/#\/menu$/)
      // 菜单页菜品可见
      await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    })

    test('REQ-002.3: 绑定后支持浏览器后退回到首页', async ({ page }) => {
      await page.goto('/')
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')
      await dishCards.nth(0).click()
      await expect(page).toHaveURL(/#\/menu$/)

      await page.goBack()
      await expect(page).toHaveURL(/#\/home$/)
    })

    test('REQ-002.4: 点击第二道推荐菜也能正常跳转菜单页', async ({ page }) => {
      await page.goto('/')
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')
      await dishCards.nth(1).click()
      await expect(page).toHaveURL(/#\/menu$/)
    })

    test('REQ-002.5: 点击第三道推荐菜也能正常跳转菜单页', async ({ page }) => {
      await page.goto('/')
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')
      await dishCards.nth(2).click()
      await expect(page).toHaveURL(/#\/menu$/)
    })
  })

  test.describe('REQ-003: 数据来源与排序', () => {
    test('REQ-003.1: 推荐菜按 badge 优先级排序（popular > signature > chef > new）', async ({ page }) => {
      await page.goto('/')
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')

      // 第一道：人气 No.1
      await expect(dishCards.nth(0).getByText('人气 No.1')).toBeVisible()
      // 第二道：招牌
      await expect(dishCards.nth(1).getByText('招牌')).toBeVisible()
      // 第三道：主厨推荐
      await expect(dishCards.nth(2).getByText('主厨推荐')).toBeVisible()
    })

    test('REQ-003.2: 推荐菜仅展示 3 道带 badge 的菜品（不含新品 p5）', async ({ page }) => {
      await page.goto('/')
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')
      await expect(dishCards).toHaveCount(3)
      // 第四道带 badge 的菜品（鲜虾滑 / 新品）不应出现在推荐区
      const recommendedSection = page.locator('section').filter({ hasText: '人气好菜抢先看' })
      await expect(recommendedSection.getByText('鲜虾滑')).not.toBeVisible()
      await expect(recommendedSection.getByText('新品')).not.toBeVisible()
    })

    test('REQ-003.3: 推荐菜图片、名称、价格与数据一致', async ({ page }) => {
      await page.goto('/')
      const dishCards = page.locator('section').filter({ hasText: '人气好菜抢先看' }).locator('button')

      for (let i = 0; i < EXPECTED_DISHES.length; i++) {
        const card = dishCards.nth(i)
        const dish = EXPECTED_DISHES[i]
        await expect(card.getByRole('heading', { name: dish.name })).toBeVisible()
        await expect(card.getByText(dish.price)).toBeVisible()
      }
    })
  })

  test.describe('NFR: 回归与兼容性', () => {
    test('NFR-001: 推荐菜展示不影响桌台绑定功能', async ({ page }) => {
      await page.goto('/')
      // 桌台选择按钮仍可用
      await expect(page.getByRole('button', { name: /A08/ }).first()).toBeVisible()
      // 点击桌台绑定进入欢迎页
      await page.getByRole('button', { name: /A08/ }).first().click()
      await expect(page).toHaveURL(/#\/welcome$/)
    })

    test('NFR-002: 快速进入功能正常', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /快速进入 A08 桌/ }).click()
      await expect(page).toHaveURL(/#\/welcome$/)
    })

    test('NFR-003: 英文模式下推荐菜模块正常展示', async ({ page }) => {
      await page.goto('/')
      // 切换到英文
      await page.getByRole('button', { name: /EN|英文|English/i }).first().click()
      // 英文标题
      await expect(page.getByText('Popular Picks')).toBeVisible()
      await expect(page.getByText('Tap to bind table and order instantly')).toBeVisible()
    })

    test('NFR-004: 英文模式下点击推荐菜跳转菜单页', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /EN|英文|English/i }).first().click()
      const dishCards = page.locator('section').filter({ hasText: 'Popular Picks' }).locator('button')
      await dishCards.nth(0).click()
      await expect(page).toHaveURL(/#\/menu$/)
    })
  })
})
