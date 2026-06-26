# Plano de Campo ATAQ — Setup

## Stack
- Frontend: React + Vite (PWA instalável no celular)
- Backend: Supabase (Postgres + Auth + Realtime)
- Deploy: Vercel
- Notificações: n8n + Evolution API → WhatsApp

## 1. Supabase
1. Novo projeto em supabase.com → South America
2. SQL Editor → cole `supabase_schema.sql` → Run
3. Database → Replication → habilite `modificacoes` e `ajustes`
4. Settings → API → copie URL e anon key

## 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:
```
VITE_SUPABASE_URL=https://XXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_N8N_WEBHOOK_URL=https://seu-n8n/webhook/plano-campo
```

## 3. Rodar local
```bash
npm install && npm run dev
```

## 4. Deploy Vercel
```bash
npm install -g vercel && vercel --prod
```
Adicione as variáveis de ambiente no painel da Vercel.

## 5. Usuário admin
Crie seu usuário via Supabase Auth, depois:
```sql
UPDATE usuarios SET papel = 'admin', regiao_id = NULL
WHERE email = 'seu@email.com';
```

## 6. Instalar no celular (PWA)
- Android/Chrome: banner automático "Adicionar à tela inicial"
- iPhone/Safari: Compartilhar → "Adicionar à Tela de Início"

## 7. Webhook n8n (payload enviado a cada edição)
```json
{
  "evento": "modificacao",
  "regiao": "AGRESTE — Supervisor 1",
  "supervisor": "Nome",
  "cliente": "MERCADINHO GODOI",
  "clienteCod": "1219",
  "vendedor": "ADRIANA",
  "alteracoes": [{ "campo": "Dia de atendimento", "de": "TER", "para": "QUA" }],
  "obs": "cliente pediu mudança"
}
```

### Code node n8n (formata msg WhatsApp):
```js
const d = $input.item.json
const alts = d.alteracoes.map(a => `  • ${a.campo}: *${a.de}* → *${a.para}*`).join('\n')
return [{ json: { mensagem:
  `🔔 *Plano de Campo ATAQ*\n\n*Região:* ${d.regiao}\n*Supervisor:* ${d.supervisor}\n` +
  `*Cliente:* ${d.cliente} (#${d.clienteCod})\n*Vendedor:* ${d.vendedor}\n\n*Alterações:*\n${alts}` +
  (d.obs ? `\n\n_Obs.: ${d.obs}_` : '')
}}]
```

## Diagrama de comunicação
```
Supervisor (celular/PWA)
    │  HTTPS (Supabase SDK)
    ▼
Supabase (Postgres + RLS)
    │ Realtime WebSocket        │ Webhook POST
    ▼                           ▼
Badge ao vivo no admin      n8n → Evolution API → WhatsApp
```
Row Level Security: cada supervisor só acessa a sua região, garantido no banco.
