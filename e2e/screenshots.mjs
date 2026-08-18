import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('e2e/screenshots', { recursive: true });
const browser = await chromium.launch();

const login = async (page) => {
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Servidor (ex: http://seuip:8080)').fill('http://127.0.0.1:8800');
  await page.getByPlaceholder('Usuário').fill('99294464');
  await page.getByPlaceholder('Senha').fill('24579281');
  await page.getByRole('button', { name: 'Conectar' }).click();
  await page.getByRole('button', { name: /Filmes \(80\)/ }).waitFor({ timeout: 30000 });
};

const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await login(desktop);
await desktop.getByRole('button', { name: /Filmes \(80\)/ }).click();
await desktop.getByText('Filme Terror 8').first().waitFor({ timeout: 15000 });
await desktop.getByText('Drama (8)').first().click();
await desktop.waitForTimeout(500);
await desktop.screenshot({ path: 'e2e/screenshots/desktop-categorias.png' });
await desktop.getByText('Filme Drama 1').first().click();
await desktop.waitForTimeout(600);
await desktop.screenshot({ path: 'e2e/screenshots/desktop-modal.png' });
await desktop.getByRole('button', { name: 'Fechar' }).click();

const mobile = await browser.newPage({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
await login(mobile);
await mobile.screenshot({ path: 'e2e/screenshots/mobile-home.png' });
await mobile.getByRole('button', { name: /Filmes \(80\)/ }).click();
await mobile.getByText('Filme Terror 8').first().waitFor({ timeout: 15000 });
await mobile.screenshot({ path: 'e2e/screenshots/mobile-filmes.png' });
await mobile.getByText('Filme Drama 1').first().click();
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: 'e2e/screenshots/mobile-modal-bottom-sheet.png' });

await browser.close();
console.log('screenshots salvos em e2e/screenshots/');