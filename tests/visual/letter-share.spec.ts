import {expect, test} from '@playwright/test'

for (const width of [1440, 390]) {
  test(`own letter sharing, preview and download at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:900})
    await page.goto('/?variant=share')
    const trigger = page.getByRole('button', {name:'Compartir', exact:true})
    await trigger.click()
    const menu = page.getByRole('dialog', {name:'Comparte tu carta'})
    await expect(menu).toBeVisible()
    const bounds = await menu.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    await expect.poll(async () => {const box = await menu.boundingBox(); return box!.y + box!.height}).toBeLessThanOrEqual(900)
    await page.screenshot({path:test.info().outputPath(`share-menu-${width}.png`)})
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await trigger.click()
    await page.getByRole('button', {name:'Instagram · Story'}).click()
    const dialog = page.getByRole('dialog', {name:'Tu carta, lista para viajar'})
    await expect(dialog).toBeVisible()
    const image = dialog.getByRole('img')
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((img:HTMLImageElement) => img.naturalWidth)).toBe(1080)
    await expect.poll(() => image.evaluate((img:HTMLImageElement) => img.naturalHeight)).toBe(1920)
    const edgeColors = await image.evaluate((img:HTMLImageElement) => {
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0)
      return [[10,960], [1070,960], [540,10], [540,1910]].map(([x,y]) => Array.from(context.getImageData(x,y,1,1).data).slice(0,3))
    })
    expect(edgeColors).toEqual(Array(4).fill([16,32,51]))
    expect(await image.evaluate(img => img.getBoundingClientRect().bottom - img.parentElement!.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1)
    await page.screenshot({path:test.info().outputPath(`share-story-${width}.png`)})
    await page.getByRole('button', {name:'Publicación · 1:1'}).click()
    await expect.poll(() => image.evaluate((img:HTMLImageElement) => img.naturalHeight)).toBe(1080)
    const downloaded = page.waitForEvent('download')
    await page.getByRole('link', {name:'Descargar imagen'}).click()
    const download = await downloaded
    expect(download.suggestedFilename()).toContain('square.png')
    await download.saveAs(test.info().outputPath(`postcard-square-${width}.png`))
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}


test('sharing from the list keeps both Instagram destinations and hides removed options', async ({page}) => {
  await page.setViewportSize({width:390, height:900})
  await page.goto('/?variant=share-list')
  await page.getByRole('button', {name:'Compartir', exact:true}).click()
  await expect(page.getByRole('dialog', {name:'Comparte tu carta'})).toBeVisible()
  await expect(page.getByRole('link', {name:'LinkedIn'})).toHaveCount(0)
  await expect(page.getByRole('button', {name:'Copiar enlace de Atiny Atlas'})).toHaveCount(0)
  await page.screenshot({path:test.info().outputPath('share-list-mobile.png')})
  await page.getByRole('button', {name:'Instagram · Publicación'}).click()
  const image = page.getByRole('img')
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((img:HTMLImageElement) => img.naturalHeight)).toBe(1080)
})


test('desktop opens X and Threads directly even with native share support', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {value:() => true, configurable:true})
    Object.defineProperty(navigator, 'share', {value:async () => {throw new Error('desktop must use the network link')}, configurable:true})
  })
  for (const pattern of ['https://twitter.com/**','https://www.threads.com/**']) {
    await page.context().route(pattern, route => route.fulfill({body:'External network'}))
  }
  for (const [label, host, path] of [['X / Twitter','twitter.com','/intent/tweet'], ['Threads','www.threads.com','/intent/post']] as const) {
    await page.goto('/?variant=share')
    await page.getByRole('button', {name:'Compartir', exact:true}).click()
    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('link', {name:label, exact:true}).click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    const url = new URL(popup.url())
    expect(url.hostname).toBe(host)
    expect(url.pathname).toBe(path)
    expect(url.searchParams.get('text')).toContain('Lee mi carta completa')
    expect(url.searchParams.get('url')).toContain('/messages/')
    await popup.close()
  }
})


test('mobile X and Threads open their composers without invoking the native share menu', async ({browser}) => {
  const context = await browser.newContext({baseURL:test.info().project.use.baseURL, userAgent:'Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/120.0.0.0 Mobile Safari/537.36', viewport:{width:390,height:900}})
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {value:async () => {throw new Error('network action must not invoke native sharing')}, configurable:true})
      Object.defineProperty(navigator, 'canShare', {value:() => true, configurable:true})
    })
    for (const pattern of ['https://twitter.com/**','https://www.threads.com/**']) await context.route(pattern, route => route.fulfill({body:'Network composer'}))
    const page = await context.newPage()
    for (const [label, host] of [['X / Twitter','twitter.com'],['Threads','www.threads.com']] as const) {
      await page.goto('/?variant=share')
      await page.getByRole('button', {name:'Compartir', exact:true}).click()
      const popupPromise = page.waitForEvent('popup')
      await page.getByRole('link', {name:label, exact:true}).click()
      const popup = await popupPromise
      await popup.waitForLoadState('domcontentloaded')
      const url = new URL(popup.url())
      expect(url.hostname).toBe(host)
      expect(url.searchParams.get('text')).toContain('Lee mi carta completa')
      expect(url.searchParams.get('url')).toContain('/messages/')
      await popup.close()
    }
  } finally {await context.close()}
})

test('desktop Instagram leaves only the chosen image download screen open', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {value:async () => {throw new Error('desktop Instagram must not invoke sharing')}, configurable:true})
    Object.defineProperty(navigator, 'canShare', {value:() => true, configurable:true})
  })
  for (const [label, format] of [['Instagram · Story','story'], ['Instagram · Publicación','square']] as const) {
    await page.goto('/?variant=share')
    await page.getByRole('button', {name:'Compartir', exact:true}).click()
    await page.getByRole('button', {name:label}).click()
    const download = page.getByRole('link', {name:'Descargar imagen'})
    await expect(download).toHaveAttribute('download', new RegExp(`${format}\\.png$`))
    expect(page.context().pages()).toHaveLength(1)
    await expect(page.getByRole('link', {name:'Abrir Instagram'})).toHaveCount(0)
    await expect(page.getByRole('button', {name:'Compartir imagen'})).toHaveCount(0)
    await page.getByRole('button', {name:'Cerrar', exact:true}).click()
  }
})
