import { chromium } from 'playwright';

let pass = 0, fail = 0;
const ok = (n, c) => { console.log(`  ${c ? '✓' : '✗'} ${n}`); if (c) pass++; else fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

console.log('[1] Login e salvamento (checkbox marcado por padrão)');
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
ok('checkbox salvar visível', (await page.getByRole('checkbox').count()) === 1);
ok('checkbox marcado por padrão', await page.getByRole('checkbox').isChecked());
await page.getByPlaceholder('Servidor (ex: http://seuip:8080)').fill('http://127.0.0.1:8800');
await page.getByPlaceholder('Usuário').fill('99294464');
await page.getByPlaceholder('Senha').fill('24579281');
await page.getByRole('button', { name: 'Conectar' }).click();
await page.getByRole('button', { name: /Canais \(/ }).waitFor({ timeout: 30000 });
ok('conectou', true);

console.log('[2] Reload auto-conecta (sem digitar)');
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Canais \(/ }).waitFor({ timeout: 30000 });
ok('reload conectou automaticamente', true);

console.log('[3] Logout mantém credenciais preenchidas e não auto-conecta');
await page.getByRole('button', { name: 'Sair' }).click();
await page.getByRole('button', { name: 'Conectar' }).waitFor({ timeout: 5000 });
ok('tela de login após sair', true);
ok('servidor preenchido', (await page.getByPlaceholder('Servidor (ex: http://seuip:8080)').inputValue()) === 'http://127.0.0.1:8800');
ok('usuário preenchido', (await page.getByPlaceholder('Usuário').inputValue()) === '99294464');
ok('checkbox marcado (dados salvos existem)', await page.getByRole('checkbox').isChecked());
ok('limpar dados salvos visível', (await page.getByRole('button', { name: 'Limpar dados salvos deste navegador' }).count()) === 1);
await page.waitForTimeout(1500);
ok('não auto-conectou após logout', (await page.getByRole('button', { name: /Canais \(/ }).count()) === 0);

console.log('[4] Limpar dados salvos');
await page.getByRole('button', { name: 'Limpar dados salvos deste navegador' }).click();
ok('botão some após limpar', (await page.getByRole('button', { name: 'Limpar dados salvos deste navegador' }).count()) === 0);
ok('checkbox desmarcado após limpar', !(await page.getByRole('checkbox').isChecked()));

console.log('[5] Reload após limpar → login sem auto-conectar');
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Conectar' }).waitFor({ timeout: 5000 });
ok('tela de login após limpar', true);
ok('usuário vazio', (await page.getByPlaceholder('Usuário').inputValue()) === '');

console.log('[6] Conectar com checkbox desmarcado → não persiste');
await page.getByRole('checkbox').uncheck();
await page.getByPlaceholder('Servidor (ex: http://seuip:8080)').fill('http://127.0.0.1:8800');
await page.getByPlaceholder('Usuário').fill('99294464');
await page.getByPlaceholder('Senha').fill('24579281');
await page.getByRole('button', { name: 'Conectar' }).click();
await page.getByRole('button', { name: /Canais \(/ }).waitFor({ timeout: 30000 });
ok('conectou sem salvar', true);
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Conectar' }).waitFor({ timeout: 5000 });
ok('não auto-conectou (não salvou)', true);
ok('usuário vazio no reload', (await page.getByPlaceholder('Usuário').inputValue()) === '');

console.log('[7] Nova aba → login sem dados salvos');
const page2 = await ctx.newPage();
await page2.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
ok('nova aba mostra login', (await page2.getByRole('button', { name: 'Conectar' }).count()) === 1);
await page2.close();

await browser.close();
console.log(`\nRESULTADO: ${pass} OK, ${fail} FALHAS`);
process.exit(fail ? 1 : 0);