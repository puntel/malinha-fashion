# 🧪 Roteiro de Teste Manual — Malinha Fashion

> **URL do Sistema:** http://localhost:8082/
> **Data do Teste:** 16/09/2026

---

## ✅ PASSO 1 — Login ADM Master

| Campo  | Valor |
|--------|-------|
| Email  | joaopuntel@gmail.com |
| Senha  | SenhaMaster123! |

- Acesse http://localhost:8082/
- Informe as credenciais acima
- Clique em **Entrar**
- **Resultado esperado:** Redirecionamento ao dashboard

---

## ✅ PASSO 2 — Cadastro de Loja

1. No menu lateral, clique em **Lojas**
2. Clique em **Nova Loja** (ou botão "+")
3. Preencha os campos:

| Campo     | Valor de Teste |
|-----------|----------------|
| Nome      | Loja Teste Fashion |
| Email     | loja.teste@email.com |
| Telefone  | (11) 99999-1234 |
| Senha     | Senha123! |

4. Clique em **Salvar / Criar**
5. **Resultado esperado:** Loja aparece na lista

---

## ✅ PASSO 3 — Cadastro de Vendedora

1. No menu lateral, clique em **Vendedoras**
2. Clique em **Nova Vendedora** (ou botão "+")
3. Preencha os campos:

| Campo     | Valor de Teste |
|-----------|----------------|
| Nome      | Maria Silva |
| Email     | maria.silva@email.com |
| Telefone  | (11) 98765-4321 |
| Loja      | Loja Teste Fashion |
| Senha     | Senha123! |

4. Clique em **Salvar / Criar**
5. **Resultado esperado:** Vendedora aparece na lista

---

## ✅ PASSO 4 — Cadastro de Produto

1. No menu lateral, clique em **Produtos**
2. Clique em **Novo Produto** (ou botão "+")
3. Preencha os campos:

| Campo      | Valor de Teste |
|------------|----------------|
| Nome       | Vestido Floral Azul |
| Descrição  | Vestido floral em tecido leve, tamanho M |
| Preço      | 89,90 |
| Estoque    | 10 |
| Categoria  | (selecione qualquer disponível) |

4. Clique em **Salvar / Criar**
5. **Resultado esperado:** Produto aparece na lista

---

## ✅ PASSO 5 — Cadastro de Cliente

1. No menu lateral, clique em **Clientes**
2. Clique em **Novo Cliente** (ou botão "+")
3. Preencha os campos:

| Campo     | Valor de Teste |
|-----------|----------------|
| Nome      | Ana Paula Santos |
| Email     | ana.paula@email.com |
| Telefone  | (11) 97654-3210 |
| CPF       | 123.456.789-00 |

4. Clique em **Salvar / Criar**
5. **Resultado esperado:** Cliente aparece na lista

---

## ✅ PASSO 6 — Cadastro de Venda

1. No menu lateral, clique em **Vendas**
2. Clique em **Nova Venda** (ou botão "+")
3. Preencha os campos:

| Campo           | Valor de Teste |
|-----------------|----------------|
| Cliente         | Ana Paula Santos |
| Produto         | Vestido Floral Azul |
| Quantidade      | 1 |
| Vendedora       | Maria Silva |
| Forma de Pgto   | (selecione qualquer disponível) |

4. Clique em **Salvar / Registrar**
5. **Resultado esperado:** Venda registrada com sucesso

---

## 📌 Observações

- Sistema rodando sem pagamento (Stripe desabilitado para testes)
- Segurança por roles: ADM Master > Loja > Vendedora
- Vídeo de teste deve ser salvo nesta pasta

