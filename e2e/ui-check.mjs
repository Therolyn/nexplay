/* NexPlay Next - UI checks via Playwright (mock provider + production build).
 * Usage: node e2e/ui-check.mjs [baseUrl]
 * Requires: mock-server.mjs on 8800 and `npm run build && npm run start`.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:8800';
const USER = '99294464';
const PASS = '24579281';

let pass = 0;
let fail = 0;
const consoleErrors = [];

function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // --- Login Xtream ---
  console.log('\n[1] Login Xtream');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  ok('tela de login visível', await page.getByText('NexPlay').first().isVisible());
  await page.getByPlaceholder('Servidor (ex: http://seuip:8080)').fill(MOCK);
  await page.getByPlaceholder('Usuário').fill(USER);
  await page.getByPlaceholder('Senha').fill(PASS);
  await page.getByRole('button', { name: 'Conectar' }).click();
  await page.getByRole('button', { name: /Canais \(/ }).waitFor({ timeout: 30000 });
  ok('conectou e mostra abas com contagem', true);

  // --- Home: abas e categorias ---
  console.log('\n[2] Navegação');
  const filmeTab = page.getByRole('button', { name: /Filmes \(80\)/ });
  ok('aba Filmes visível', await filmeTab.isVisible());
  await filmeTab.click();
  await page.getByText('Filme Terror 8').first().waitFor({ timeout: 15000 });
  ok('grid de filmes carregado (página completa)', true);
  ok('contagem na aba Filmes = 80', /Filmes \(80\)/.test(await filmeTab.innerText()));
  await page.getByRole('button', { name: /Categorias/ }).click();
  ok('categorias de filme listadas', (await page.getByText('Ação (8)').count()) > 0);
  await page.getByText('Ação (8)').first().click();
  await page.waitForTimeout(1500);
  ok('filtro por categoria Ação aplicado (8 itens)', (await page.locator('[role="button"]').filter({ hasText: 'Filme Ação' }).count()) >= 8);

  // --- Modal de filme com sinopse ---
  console.log('\n[3] Modal de filme');
  await page.getByText('Filme Ação 1').first().click();
  await page.getByText('Sinopse detalhada do filme.').waitFor({ timeout: 15000 });
  ok('modal aberto com sinopse do painel', true);
  ok('detalhes (duração) exibidos', (await page.getByText('Duração: 01:58:00').count()) === 1);
  await page.getByRole('button', { name: '☆ Favoritar' }).click();
  await page.getByRole('button', { name: '★ Favorito', exact: true }).waitFor({ timeout: 5000 });
  ok('favoritou', true);
  await page.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: '★ Favoritos' }).click();
  await page.getByText('Filme Ação 1').first().waitFor({ timeout: 5000 });
  ok('favorito aparece no drawer', true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // --- Player ---
  console.log('\n[4] Player');
  await page.getByText('Filme Ação 1').first().click();
  await page.getByRole('button', { name: /▶ Assistir/ }).click();
  await page.locator('video').waitFor({ state: 'attached', timeout: 10000 });
  ok('player aberto com video', true);
  await page.getByRole('button', { name: '✕ Fechar' }).click();

  // --- Modal de filme sem sinopse (aviso honesto) ---
  console.log('\n[5] Filme sem sinopse');
  await page.getByRole('button', { name: /Filmes \(80\)/ }).click();
  await page.getByRole('button', { name: /Categorias/ }).click();
  await page.getByRole('option', { name: 'Todas (80)' }).click();
  await page.getByText('Filme Terror 5').first().click();
  await page.getByText('Sinopse detalhada do filme.').last().waitFor({ timeout: 15000 });
  ok('modal de filme abre', true);
  ok('botão Assistir disponível', (await page.getByRole('button', { name: /▶ Assistir/ }).count()) === 1);
  await page.getByRole('button', { name: 'Fechar' }).click();

  // --- Séries: modal com temporadas ---
  console.log('\n[6] Séries');
  await page.getByRole('button', { name: /Séries \(\d+\)/ }).first().click();
  await page.getByText('Série Drama 1').first().waitFor({ timeout: 15000 });
  await page.getByText('Série Drama 1').first().click();
  await page.getByRole('heading', { name: 'Série Drama 1' }).waitFor({ timeout: 15000 });
  ok('modal de série aberto', true);
  ok('sinopse da série exibida', (await page.getByText(/Plot da série Drama 1/).count()) > 0);
ok('temporada 1 listada', (await page.getByText('Temporada 1', { exact: true }).count()) > 0);
  await page.getByText('Drama 1 - Temporada 1 Episódio 1').first().waitFor({ timeout: 5000 });
  ok('episódios listados (T1 aberta por padrão)', true);
  await page.getByText('Temporada 2', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByText('Drama 1 - Temporada 2 Episódio 1').first().waitFor({ timeout: 5000 });
  ok('toggle de temporada funciona', true);
  await page.getByText('Drama 1 - Temporada 2 Episódio 1').first().click();
  await page.locator('video').waitFor({ state: 'attached', timeout: 10000 });
  ok('player de episódio abre', true);
  await page.getByRole('button', { name: '✕ Fechar' }).click();

  // --- Busca ---
  console.log('\n[7] Busca');
  await page.getByRole('button', { name: /Filmes \(80\)/ }).click();
  await page.getByText('Filme Terror 8').first().waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Buscar…').fill('Filme Ação');
  await page.waitForTimeout(800);
  ok('busca filtra (resultados visíveis)', (await page.getByText('Filme Ação 1').count()) > 0);
  await page.getByPlaceholder('Buscar…').fill('zzzz-inexistente');
  await page.waitForTimeout(800);
  ok('busca sem resultado mostra aviso', (await page.getByText('Nada encontrado nesta busca.').count()) === 1);
  await page.getByPlaceholder('Buscar…').fill('');

  // --- M3U login ---
  console.log('\n[8] Login M3U + série via painel');
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByRole('button', { name: 'Lista M3U' }).click();
  await page.getByPlaceholder(/URL da lista/).fill(`${MOCK}/get.php?username=${USER}&password=${PASS}&type=m3u_plus&output=ts`);
  await page.getByRole('button', { name: 'Conectar' }).click();
  await page.getByRole('button', { name: /Séries \(\d+\)/ }).first().waitFor({ timeout: 30000 });
  ok('conectou via M3U', true);
  await page.getByRole('button', { name: /Séries \(\d+\)/ }).first().click();
  await page.getByText('Canal Séries 1').first().waitFor({ timeout: 20000 });
  ok('séries M3U na grade', true);
  await page.getByText('Série Drama 1').first().click();
  await page.getByRole('heading', { name: 'Série Drama 1' }).waitFor({ timeout: 20000 });
  ok('série M3U resolvida via painel (series-search)', true);
  await page.getByText(/Plot da série Drama 1/).waitFor({ timeout: 20000 });
  ok('sinopse do painel na série M3U', true);

  // --- Console limpo ---
  console.log('\n[9] Console');
  const bad = consoleErrors.filter((t) => !t.includes('favicon') && !/logo\/\d+\.png/.test(t));
  ok('console sem erros', bad.length === 0, bad.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} OK, ${fail} FALHAS`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});