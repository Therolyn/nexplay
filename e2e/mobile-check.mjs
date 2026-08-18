import { chromium } from 'playwright';

let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}`);
  if (cond) passed++;
  else failed++;
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const consoleErrs = [];
page.on('console', (m) => { if (m.type() === 'error') { consoleErrs.push(m.text().slice(0, 300)); console.log('CONSOLE', m.text().slice(0, 300)); } });
page.on('pageerror', (e) => { consoleErrs.push(String(e).slice(0, 500)); console.log('PAGEERROR', String(e).slice(0, 500)); });

try {
  console.log('[1] Login mobile');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Servidor (ex: http://seuip:8080)').fill('http://127.0.0.1:8800');
  await page.getByPlaceholder('Usuário').fill('99294464');
  await page.getByPlaceholder('Senha').fill('24579281');
  await page.getByRole('button', { name: 'Conectar' }).click();
  await page.getByRole('button', { name: /Filmes \(80\)/ }).waitFor({ timeout: 30000 });
  ok('login conectou no mobile', true);

  console.log('[2] Layout sem overflow horizontal');
  const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  ok('body sem scroll horizontal', !hScroll);

  console.log('[3] Tabs e botão categorias');
  const tabH = await page.getByRole('button', { name: /Canais \(96\)/ }).boundingBox();
  ok('tab com altura de toque >= 40px', tabH !== null && tabH.height >= 40);
  const catBtn = page.getByRole('button', { name: /Categorias/ });
  const catH = await catBtn.boundingBox();
  ok('botão categorias com altura de toque >= 40px', catH !== null && catH.height >= 40);

  console.log('[4] Popup de categorias');
  await catBtn.click();
  await page.getByText('Todas (96)').waitFor({ timeout: 5000 });
  ok('popup abre e lista categorias', true);
  const sheet = page.locator('[role="listbox"]');
  const sb = await sheet.boundingBox();
  const vh = await page.evaluate(() => window.innerHeight);
  ok('popup ancorado na base no mobile (bottom-sheet)', sb !== null && sb.y + sb.height >= vh - 10);
  await page.getByText('Esportes (4)').first().click();
  await page.waitForTimeout(1000);
  ok('selecionar categoria filtra a grade', (await page.getByText('Canal Esportes 1').count()) > 0);
  await catBtn.click();
  await page.getByText('Todas (96)').waitFor({ timeout: 5000 });
  await page.getByText('Todas (96)').first().click();
  await page.waitForTimeout(800);

  console.log('[5] Busca mobile');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByPlaceholder('Buscar…').locator('visible=true').first().waitFor({ state: 'visible', timeout: 5000 });
  ok('input de busca aparece no mobile', true);
  await page.getByPlaceholder('Buscar…').locator('visible=true').first().fill('Esportes');
  await page.waitForTimeout(600);
  ok('busca filtra no mobile', (await page.getByText('Canal Esportes 1').count()) > 0);
  await page.getByPlaceholder('Buscar…').locator('visible=true').first().fill('');
  await page.getByRole('button', { name: 'Buscar' }).click();

  console.log('[6] Grid de filmes em 3 colunas');
  await page.getByRole('button', { name: /Filmes \(80\)/ }).click();
  await page.getByText('Filme Terror 8').first().waitFor({ timeout: 15000 });
  const cardPos = [];
  const cards = page.locator('main div[role="button"]');
  for (let i = 0; i < 3; i++) {
    const b = await cards.nth(i).boundingBox();
    if (b) cardPos.push(b.x);
  }
  const col3 = cardPos.length === 3 && Math.abs(cardPos[1] - cardPos[0]) > 40 && Math.abs(cardPos[2] - cardPos[1]) > 40;
  ok('grade com 3 colunas no mobile', col3);

  console.log('[7] Favorito visível sem hover (touch)');
  const favBtn = page.locator('main div[role="button"]').first().locator('button[aria-label="Adicionar favorito"]');
  const favOp = await favBtn.evaluate((el) => getComputedStyle(el).opacity);
  ok('botão favorito visível no touch', parseFloat(favOp) >= 0.9);

  console.log('[8] Modal filme como bottom-sheet');
  await page.getByText('Filme Ação 1').first().click();
  const modalSheet = page.locator('div.max-h-\\[92vh\\]');
  await modalSheet.waitFor({ timeout: 5000 });
  const sb2 = await modalSheet.boundingBox();
  const vh2 = await page.evaluate(() => window.innerHeight);
  ok('modal ancorado na base (bottom-sheet)', sb2 !== null && sb2.y + sb2.height >= vh2 - 10);
  ok('botão Assistir presente', (await page.getByRole('button', { name: /▶ Assistir/ }).count()) > 0);
  await page.getByRole('button', { name: 'Fechar' }).click();

  console.log('[9] Player em tela cheia');
  await page.getByText('Filme Ação 1').first().click();
  await page.getByRole('button', { name: /▶ Assistir/ }).click();
  await page.locator('video').waitFor({ state: 'attached', timeout: 10000 });
  const vbox = await page.locator('video').boundingBox();
  ok('video ocupa a largura toda', vbox !== null && vbox.width >= 355);
  ok('video tem playsInline (não abre externo)', (await page.locator('video').getAttribute('playsinline')) !== null);
  await page.getByRole('button', { name: '✕ Fechar' }).click();
  await page.waitForTimeout(400);

  console.log('[10] Console limpo');
  ok('sem erros no console', consoleErrs.length === 0);
} catch (e) {
  console.log('ERR', String(e).slice(0, 500));
  failed++;
}

await browser.close();
console.log(`\nRESULTADO: ${passed} OK, ${failed} FALHAS`);
process.exit(failed > 0 ? 1 : 0);