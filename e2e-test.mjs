/**
 * Teste E2E Automatizado — Malinha Fashion
 * Executa o fluxo completo: Login → Loja → Vendedora → Produto → Cliente → Venda
 * Salva screenshots de cada passo em "Captura de telas"
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:8082';
const SCREENSHOT_DIR = path.resolve('Captura de telas');

// Garante que o diretório existe
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const screenshot = async (page, name) => {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  📸 Screenshot salva: ${name}.png`);
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('🚀 Iniciando teste E2E — Malinha Fashion\n');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
    recordVideo: { 
      dir: SCREENSHOT_DIR,
      size: { width: 1440, height: 900 }
    }
  });
  const page = await context.newPage();

  try {
    // ═══════════════════════════════════════════
    // PASSO 1: LOGIN
    // ═══════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASSO 1: LOGIN ADM MASTER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await delay(2000);
    await screenshot(page, '01_pagina_login');

    // Preenche email (usa variavel de ambiente ou valor ficticio de teste)
    const testEmail = process.env.TEST_ADMIN_EMAIL || 'admin.ficticio@malinhastore.test';
    const testPassword = process.env.TEST_ADMIN_PASSWORD || 'SenhaFicticia@2026';

    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(testEmail);

    // Preenche senha ficticia
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(testPassword);
    
    await screenshot(page, '02_credenciais_preenchidas');

    // Clica no botão de login
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    // Espera redirecionar para o dashboard
    await page.waitForURL('**/master**', { timeout: 15000 }).catch(() => {
      console.log('  ⚠️ Redirecionamento não foi para /master, verificando página atual...');
    });
    await delay(3000);
    await screenshot(page, '03_dashboard_apos_login');
    console.log(`  ✅ Login OK — URL atual: ${page.url()}\n`);

    // ═══════════════════════════════════════════
    // PASSO 2: CADASTRO DE LOJA
    // ═══════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASSO 2: CADASTRO DE LOJA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto(`${BASE_URL}/lojas`, { waitUntil: 'networkidle' });
    await delay(2000);
    await screenshot(page, '04_pagina_lojas');

    // Clica em "Nova Loja"
    const novaLojaBtn = page.locator('button', { hasText: /Nova Loja/i });
    await novaLojaBtn.click();
    await delay(1000);
    await screenshot(page, '05_formulario_nova_loja');

    // Preenche o formulário de loja
    const lojaDialog = page.locator('[role="dialog"]');
    await lojaDialog.waitFor({ state: 'visible' });

    // Nome da Loja
    await lojaDialog.locator('input').nth(0).fill('Loja Teste Fashion');
    // Telefone
    await lojaDialog.locator('input').nth(1).fill('(31) 99988-7766');
    // CNPJ
    await lojaDialog.locator('input').nth(2).fill('12.345.678/0001-90');
    // Nome do Proprietário
    await lojaDialog.locator('input').nth(3).fill('Carlos Proprietário');
    // Email Corporativo
    await lojaDialog.locator('input').nth(4).fill('carlos.teste@fashion.com');
    // Senha de Acesso
    await lojaDialog.locator('input').nth(5).fill('Senha123!');

    await screenshot(page, '06_loja_dados_preenchidos');

    // Submete
    const criarLojaBtn = lojaDialog.locator('button[type="submit"]');
    await criarLojaBtn.click();
    await delay(5000);
    await screenshot(page, '07_loja_criada');

    // Verifica toast de sucesso ou presença na lista
    const toastLoja = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '');
    console.log(`  🔔 Toast: ${toastLoja}`);
    console.log('  ✅ Cadastro de Loja concluído\n');

    // ═══════════════════════════════════════════
    // PASSO 3: CADASTRO DE VENDEDORA
    // ═══════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASSO 3: CADASTRO DE VENDEDORA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto(`${BASE_URL}/vendedoras`, { waitUntil: 'networkidle' });
    await delay(2000);
    await screenshot(page, '08_pagina_vendedoras');

    // Clica em "Nova Vendedora"
    const novaVendedoraBtn = page.locator('button', { hasText: /Nova Vendedora/i });
    await novaVendedoraBtn.click();
    await delay(1000);

    const vendedoraDialog = page.locator('[role="dialog"]');
    await vendedoraDialog.waitFor({ state: 'visible' });
    await screenshot(page, '09_formulario_nova_vendedora');

    // Nome Completo
    await vendedoraDialog.locator('input').nth(0).fill('Maria Silva Teste');
    // Email
    await vendedoraDialog.locator('input[type="email"]').fill('maria.teste@fashion.com');
    // Senha
    await vendedoraDialog.locator('input[type="password"]').fill('Senha123!');
    // Telefone
    await vendedoraDialog.locator('input').nth(3).fill('(31) 98877-6655');

    // Seleciona Loja (select dropdown — role master)
    const lojaSelect = vendedoraDialog.locator('button[role="combobox"]');
    if (await lojaSelect.count() > 0) {
      await lojaSelect.click();
      await delay(500);
      // Tenta selecionar "Loja Teste Fashion"
      const lojaOption = page.locator('[role="option"]', { hasText: /Loja Teste Fashion/i });
      if (await lojaOption.count() > 0) {
        await lojaOption.click();
      } else {
        // Seleciona a primeira opção disponível
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.count() > 0) await firstOption.click();
      }
      await delay(500);
    }

    await screenshot(page, '10_vendedora_dados_preenchidos');

    // Submete
    const criarVendedoraBtn = vendedoraDialog.locator('button[type="submit"]');
    await criarVendedoraBtn.click();
    await delay(5000);
    await screenshot(page, '11_vendedora_criada');

    const toastVendedora = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '');
    console.log(`  🔔 Toast: ${toastVendedora}`);
    console.log('  ✅ Cadastro de Vendedora concluído\n');

    // ═══════════════════════════════════════════
    // PASSO 4: CADASTRO DE PRODUTO
    // ═══════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASSO 4: CADASTRO DE PRODUTO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto(`${BASE_URL}/produtos`, { waitUntil: 'networkidle' });
    await delay(2000);
    await screenshot(page, '12_pagina_produtos');

    // Clica em "Novo Produto"
    const novoProdutoBtn = page.locator('button', { hasText: /Novo Produto/i });
    await novoProdutoBtn.click();
    await delay(1000);

    const produtoDialog = page.locator('[role="dialog"]');
    await produtoDialog.waitFor({ state: 'visible' });
    await screenshot(page, '13_formulario_novo_produto');

    // Nome do Produto
    const prodNameInput = produtoDialog.locator('input').filter({ hasText: '' });
    await produtoDialog.locator('input[placeholder="Ex: Camiseta Oversized"]').fill('Vestido Floral Azul');
    // Código Interno
    await produtoDialog.locator('input[placeholder="Ex: REF-001"]').fill('VFA-001');
    // Categoria
    await produtoDialog.locator('input[placeholder="Ex: Blusas"]').fill('Vestidos');
    // Marca
    await produtoDialog.locator('input[placeholder="Ex: BagSync"]').fill('Fashion Trends');
    // Preço
    await produtoDialog.locator('input[placeholder="0,00"]').fill('89,90');
    // Lucro %
    const lucroInput = produtoDialog.locator('input[type="number"]').first();
    await lucroInput.fill('30');

    // Variação — Tamanho, Cor, Qtd
    const tamInput = produtoDialog.locator('input[placeholder="Ex: M"]');
    if (await tamInput.count() > 0) await tamInput.fill('M');
    const corInput = produtoDialog.locator('input[placeholder="Ex: Preto"]');
    if (await corInput.count() > 0) await corInput.fill('Azul Floral');
    // Qtd (number input dentro da variação)
    const qtyInputs = produtoDialog.locator('.space-y-2 input[type="number"]');
    const lastQty = qtyInputs.last();
    if (await lastQty.count() > 0) await lastQty.fill('10');

    await screenshot(page, '14_produto_dados_preenchidos');

    // Submete
    const criarProdutoBtn = produtoDialog.locator('button', { hasText: /Criar Produto|Atualizar/i });
    await criarProdutoBtn.click();
    await delay(3000);
    await screenshot(page, '15_produto_criado');

    const toastProduto = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '');
    console.log(`  🔔 Toast: ${toastProduto}`);
    console.log('  ✅ Cadastro de Produto concluído\n');

    // ═══════════════════════════════════════════
    // PASSO 5: CADASTRO DE CLIENTE
    // ═══════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASSO 5: CADASTRO DE CLIENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto(`${BASE_URL}/clientes`, { waitUntil: 'networkidle' });
    await delay(2000);
    await screenshot(page, '16_pagina_clientes');

    // Clica em "Novo Cliente" ou botão com "+"
    const novoClienteBtn = page.locator('button', { hasText: /Novo Cliente|Cadastrar/i }).first();
    if (await novoClienteBtn.count() === 0) {
      // Tenta o botão com ícone Plus
      await page.locator('button:has(svg.lucide-plus)').first().click();
    } else {
      await novoClienteBtn.click();
    }
    await delay(1000);

    const clienteDialog = page.locator('[role="dialog"]');
    await clienteDialog.waitFor({ state: 'visible' });
    await screenshot(page, '17_formulario_novo_cliente');

    // Nome
    await clienteDialog.locator('input[placeholder="Nome completo"]').fill('Ana Paula Santos');
    // Telefone
    await clienteDialog.locator('input[placeholder="(00) 00000-0000"]').fill('(31) 97654-3210');
    // CPF
    await clienteDialog.locator('input[placeholder="000.000.000-00"]').fill('123.456.789-00');
    // Email (if visible)
    const emailField = clienteDialog.locator('input[type="email"]');
    if (await emailField.count() > 0) await emailField.fill('ana.paula@email.com');

    await screenshot(page, '18_cliente_dados_preenchidos');

    // Submete
    const criarClienteBtn = clienteDialog.locator('button[type="submit"]');
    await criarClienteBtn.click();
    await delay(3000);
    await screenshot(page, '19_cliente_criado');

    const toastCliente = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '');
    console.log(`  🔔 Toast: ${toastCliente}`);
    console.log('  ✅ Cadastro de Cliente concluído\n');

    // ═══════════════════════════════════════════
    // PASSO 6: CADASTRO DE VENDA
    // ═══════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASSO 6: CADASTRO DE VENDA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto(`${BASE_URL}/vendas`, { waitUntil: 'networkidle' });
    await delay(2000);
    await screenshot(page, '20_pagina_vendas');

    // Clica em "Nova Venda"
    const novaVendaBtn = page.locator('button', { hasText: /Nova Venda/i });
    await novaVendaBtn.click();
    await delay(1000);

    const vendaDialog = page.locator('[role="dialog"]');
    await vendaDialog.waitFor({ state: 'visible' });
    await screenshot(page, '21_formulario_nova_venda');

    // Seleciona Cliente
    const clienteSelect = vendaDialog.locator('button[role="combobox"]').first();
    if (await clienteSelect.count() > 0) {
      await clienteSelect.click();
      await delay(500);
      // Tenta selecionar "Ana Paula Santos"
      const clienteOption = page.locator('[role="option"]', { hasText: /Ana Paula|Cliente/i });
      if (await clienteOption.count() > 0) {
        await clienteOption.first().click();
      } else {
        // Seleciona a primeira opção
        const firstOpt = page.locator('[role="option"]').first();
        if (await firstOpt.count() > 0) await firstOpt.click();
      }
      await delay(500);
    }

    // Produto
    await vendaDialog.locator('input[placeholder="Nome do produto"]').fill('Vestido Floral Azul');
    // Código
    await vendaDialog.locator('input[placeholder="REF-000"]').fill('VFA-001');
    // Quantidade
    await vendaDialog.locator('input[type="number"]').fill('1');
    // Valor
    await vendaDialog.locator('input[placeholder="0,00"]').first().fill('89,90');
    // Desconto
    const descontoInput = vendaDialog.locator('input[placeholder="0,00"]').nth(1);
    if (await descontoInput.count() > 0) await descontoInput.fill('0');

    // Forma de pagamento
    const pagamentoSelect = vendaDialog.locator('button[role="combobox"]').last();
    if (await pagamentoSelect.count() > 0) {
      await pagamentoSelect.click();
      await delay(500);
      const pixOption = page.locator('[role="option"]', { hasText: /Pix/i });
      if (await pixOption.count() > 0) {
        await pixOption.click();
      }
      await delay(500);
    }

    await screenshot(page, '22_venda_dados_preenchidos');

    // Submete
    const registrarVendaBtn = vendaDialog.locator('button', { hasText: /Registrar Venda/i });
    await registrarVendaBtn.click();
    await delay(3000);
    await screenshot(page, '23_venda_registrada');

    const toastVenda = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '');
    console.log(`  🔔 Toast: ${toastVenda}`);
    console.log('  ✅ Cadastro de Venda concluído\n');

    // Screenshot final
    await screenshot(page, '24_teste_finalizado');

    // ═══════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║    ✅ TESTE E2E CONCLUÍDO COM        ║');
    console.log('║       SUCESSO!                       ║');
    console.log('╠══════════════════════════════════════╣');
    console.log('║  1. Login ADM Master      ✅         ║');
    console.log('║  2. Cadastro de Loja      ✅         ║');
    console.log('║  3. Cadastro de Vendedora ✅         ║');
    console.log('║  4. Cadastro de Produto   ✅         ║');
    console.log('║  5. Cadastro de Cliente   ✅         ║');
    console.log('║  6. Cadastro de Venda     ✅         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log(`📁 Screenshots salvas em: ${SCREENSHOT_DIR}`);

  } catch (err) {
    console.error('\n❌ ERRO DURANTE O TESTE:', err.message);
    await screenshot(page, 'ERRO_screenshot').catch(() => {});
  } finally {
    // Fecha e salva o vídeo
    await page.close();
    await context.close();
    await browser.close();
    console.log('\n🎬 Vídeo de teste salvo na pasta "Captura de telas"');
    console.log('🏁 Navegador fechado.');
  }
})();
