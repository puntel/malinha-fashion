# Configuração de Autenticação - Malinha Store

## Problema Identificado

O erro `otp_expired` indica que o link de magic link está expirando ou que a configuração de URLs do Supabase não está correta.

## Soluções Implementadas no Código

1. **Melhor tratamento de erros no callback**
   - Adicionado `AuthHashHandler` no App.tsx para capturar erros de autenticação
   - Notificação clara ao usuário quando o link expira

2. **Configuração melhorada do cliente Supabase**
   - Habilitado `detectSessionInUrl: true`
   - Adicionado `flowType: 'pkce'` para maior segurança
   - `shouldCreateUser: false` para evitar criação acidental de usuários

3. **Mensagens de erro mais claras**
   - Feedback específico quando o link expira
   - Redirecionamento automático para login

## Configuração Necessária no Supabase Dashboard

Para resolver completamente o problema, é necessário configurar as URLs no Supabase:

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/nrlwfsmquwceathtxjgo/auth/url-configuration

2. Configure as seguintes URLs:

   **Site URL:**
   ```
   http://localhost:8080
   ```

   **Redirect URLs (adicione todas estas URLs):**
   ```
   http://localhost:8080/**
   http://localhost:8080/dashboard
   http://localhost:8080/login
   ```

3. **Tempo de expiração do Magic Link:**
   - Por padrão, o magic link expira em 1 hora
   - Se os usuários estão tendo problema com links expirando muito rápido, considere aumentar este tempo

4. **Rate Limits:**
   - Se estiver em desenvolvimento, pode ser útil ajustar os rate limits para evitar bloqueios durante testes

## Como Testar

1. Limpe o cache do navegador e localStorage
2. Acesse http://localhost:8080/login
3. Insira um email cadastrado
4. Clique no link recebido por email RAPIDAMENTE (antes de 1 hora)
5. Você deve ser redirecionado para o dashboard correspondente ao seu papel

## Comandos Úteis para Debug

```bash
# Ver logs do Supabase no console do navegador
# Abra DevTools > Console e procure por erros relacionados a "auth"

# Limpar localStorage
localStorage.clear()

# Ver sessão atual do Supabase
const { data } = await supabase.auth.getSession()
console.log(data)
```

## Problemas Comuns

1. **Link já foi usado:** Os magic links são de uso único. Se você clicar duas vezes, o segundo clique falhará.

2. **Link expirou:** Links magic link expiram após o tempo configurado (padrão: 1 hora).

3. **URL incorreta:** Se o Supabase estiver configurado para `localhost:3000` e você está rodando em `localhost:8080`, haverá erro.

4. **Email não cadastrado:** O sistema agora só permite login de usuários já cadastrados (via master dashboard).

## Próximos Passos

Após configurar as URLs no Supabase Dashboard:

1. Teste o fluxo completo de login
2. Verifique se o redirecionamento funciona corretamente
3. Confirme que os usuários conseguem acessar seus dashboards específicos (master, loja, vendedora)
