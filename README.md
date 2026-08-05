# Intranet RH — 01 Tecnologia

Férias e comunicação interna. Next.js 16 (App Router) · MUI v9 · Drizzle + Neon · Auth.js.

**Produção:** https://painel-rh-intra.vercel.app · projeto `cavallin/painel-rh-intra`

Usuários de demonstração (senhas fictícias, dados 100% inventados):

| Papel | E-mail | Senha |
|---|---|---|
| RH (admin master) | `rh@01tecnologia.demo` | ver `.env.local` |
| Gestor (Tecnologia) | `rodrigo.gestor@01tecnologia.demo` | ver `.env.local` |
| Gestor (Operações) | `patricia.gestora@01tecnologia.demo` | ver `.env.local` |
| Colaborador | `bruno.rocha@01tecnologia.demo` | ver `.env.local` |

> Produção e desenvolvimento compartilham o mesmo banco Neon, por decisão de
> escopo desta entrega. Rodar `npm run db:seed` **apaga e recria** os dados que
> estão no ar.

## Estado atual

| Fase | Escopo | Status |
|---|---|---|
| 0 | Fundação: tema, schema, Auth.js, deny-by-default, seed fictício | ✅ código pronto |
| — | Recuperação de senha via WhatsApp (Zaia) | ✅ código pronto |
| 1 | Núcleo de férias: fatos determinísticos, agente IA, solicitar/aprovar | ✅ código pronto |
| 2 | Cadastro completo de colaborador + ViaCEP + RMC | ✅ verificado |
| 3 | Avisos do RH (fan-out Discord + WhatsApp) | ✅ verificado |
| 4 | Formulários + dashboard do gestor + Vercel Cron | ✅ verificado |
| 5 | Calendário e listagem de férias aprovadas | ✅ verificado |

### Limites do plano gratuito da Vercel (Hobby)

O que **cabe** e está no ar:

- 1 cron job (`/api/cron/lembretes`), **uma execução por dia** às 12:00 UTC
  (09:00 em Brasília). O Hobby permite no máximo 2 crons e não aceita cadência
  horária — por isso o RH tem um botão **"Cobrar pendentes agora"** no painel de
  formulários, que roda exatamente a mesma rotina sob demanda.
- Funções até 60s (`maxDuration` declarado na rota do cron).

O que ficou de **fora por causa do plano** e está no roadmap:

- Cobrança de formulários de hora em hora — exigiria o plano Pro.

## Rodando localmente

```bash
npm install
cp .env.example .env.local     # preencha DATABASE_URL e AUTH_SECRET
npm run db:migrate             # cria as 8 tabelas
npm run db:seed                # 1 RH + 2 gestores + 4 colaboradores (100% fictícios)
npm run dev
```

O seed imprime no terminal os e-mails e senhas de demonstração por papel.

### Variáveis de ambiente

| Var | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Neon. Via Vercel: Storage → Add Database → Neon, depois `vercel env pull .env.local`. |
| `AUTH_SECRET` | sim | Assinatura da sessão. Gere com `openssl rand -base64 32`. |
| `ANTHROPIC_API_KEY` | não | Agente que julga as férias. Sem ela, o parecer cai no fallback determinístico. |
| `ZAIA_PASSWORD_RESET_WEBHOOK_URL` | não | Código de recuperação de senha por WhatsApp. |
| `ZAIA_WEBHOOK_URL` | não | Decisão de férias, avisos, lembretes. |
| `DISCORD_WEBHOOK_URL` | não | Avisos no Discord. |
| `CRON_SECRET` | não | Protege a rota agendada (Fase 4). |

Canal externo sem env var vira **no-op registrado no log** — o app nunca quebra
por causa de um webhook indisponível.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:clt` | Regras da CLT — 35 verificações, sem banco e sem rede |
| `npm run test:clt2` | Abono, dias úteis, prazo de pagamento e período concessivo — 24 verificações, puro |
| `npm run test:cadastro` | RMC, validação de CPF e mascaramento — 34 verificações, puro |
| `npm run test:ferias` | Núcleo de férias — 13 verificações contra o banco real |
| `npm run test:colaborador` | Cadastro de colaborador — 20 verificações contra o banco real |
| `npm run test:avisos` | Avisos e fan-out — 23 verificações. **Publica de verdade no Discord** se o webhook estiver configurado |
| `npm run test:formularios` | Formulários, placar por equipe e lembretes — 33 verificações |
| `npm run test:agente` | Agente da Anthropic de verdade — consome tokens, exige `ANTHROPIC_API_KEY` |
| `npm run db:check` | Testa a conexão com o Neon pelo caminho HTTPS que o app usa |

Os testes contra o banco gravam e apagam os próprios dados; `test:ferias` mexe
nas solicitações do Bruno do seed.
| `npm run db:generate` | Gera SQL a partir do schema |
| `npm run db:migrate` | Aplica as migrations |
| `npm run db:seed` | Popula dados fictícios |
| `npm run db:studio` | Drizzle Studio |

## Arquitetura

### Segurança — "nenhuma rota pública", em duas camadas

O Next.js 16 renomeou `middleware.ts` para **`proxy.ts`**, e a própria
documentação diz que ele é uma checagem *otimista* que não deve ser a única
defesa. Então são duas camadas:

1. **`src/proxy.ts`** — deny-by-default. Bloqueia tudo; só `/login`,
   `/esqueci-senha`, `/redefinir-senha`, `/api/auth/*` e `/api/cron/*` escapam.
   Lê apenas o cookie, nunca o banco. Rota nova nasce protegida por omissão.
2. **`src/lib/dal.ts`** — a defesa real. `requireSession()`, `requireRole()`,
   `requireRH()`, `requireManagerOrRH()` são chamados dentro de **cada** page,
   Server Action e Route Handler, antes de qualquer código de negócio.

A checagem **não** é feita em `layout.tsx`: layout não re-renderiza a cada
navegação e não impede segmentos aninhados nem Server Actions de rodarem.

Escopo por papel é aplicado **na query**, não na renderização — o gestor vê só
a própria equipe porque o `where` filtra por `managerId`.

### A IA não pode derrubar a lei

- `src/lib/clt.ts` — regras da CLT e aritmética de data. Puro, sem banco, sem rede.
- `src/server/facts.ts` — **mede**: saldo, sobreposição, feriados, antecedência.
  Produz `conflicts` (bloqueio duro) e `warnings` (não bloqueia).
- `src/server/agent.ts` — **explica**, e decide só os casos cinzentos.

Se `conflicts` não estiver vazio, a reprovação é imposta **em código** depois da
resposta do modelo (função `clamp`). O papel da IA ali é escrever o "porquê"
legível, não reabrir a decisão. Isso mantém o art. 134 §3º fora do alcance de
alucinação e de prompt injection vindo do campo de observações.

Sem `ANTHROPIC_API_KEY`, ou se a chamada falhar, o parecer cai num fallback
determinístico — a solicitação nunca fica travada esperando a IA.

### Feriados

Nacionais vêm da BrasilAPI **com cálculo local de fallback** (Páscoa por
Meeus/Jones/Butcher). Como o feriado alimenta uma regra que reprova, ela não
pode parar de valer porque uma API caiu. Estadual (PR) e municipal (Curitiba)
são config estática em `src/server/holidays.ts`.

### Armadilhas que já custaram caro aqui

- **Banco dedicado, sempre.** `npm run db:migrate` aborta se encontrar tabelas
  que não são deste projeto. A trava existe porque uma migration já foi aplicada
  por engano no banco de outro produto que tinha `users` e `notifications`
  próprios; como o driver HTTP do Neon não tem transação, ela ficou aplicada
  pela metade.
- **Migration vai por HTTPS, não por TCP.** `drizzle-kit migrate` abre conexão na
  porta 5432, que costuma estar fechada em rede corporativa — ele trava em
  "applying migrations…" sem erro. Por isso `db:migrate` usa `scripts/migrate.ts`.
  O `drizzle-kit generate` continua gerando o SQL (é offline).
- **Nada de passar função pela fronteira server→client.** Um `component={NextLink}`
  ou uma constante importada de um módulo `"use client"` a partir de um Server
  Component chega como `undefined` ou explode em runtime. Por isso as constantes
  da marca moram em `lib/brand.ts` (sem `"use client"`) e o link é registrado
  uma vez no tema via `MuiButtonBase.LinkComponent`.
- **CPF fictício precisa de dígito verificador válido.** O formulário valida, então
  um CPF inventado à mão deixa o próprio registro do seed impossível de editar.
  `seed.ts` calcula os dígitos e se auto-verifica no final.
- **Entrega no Discord é de CANAL, não de pessoa.** O webhook publica num canal
  único; gravar uma linha de entrega por destinatário fingiria um envio
  individual que não aconteceu. Por isso `broadcast_deliveries.user_id` é
  nullable: `NULL` = entrega de canal. WhatsApp, esse sim, é uma linha por pessoa.
- **Audiência sem valor não pode virar "todo mundo".** Um "setor" sem setor
  escolhido seleciona ZERO pessoas, nunca a empresa inteira — o fallback
  silencioso aqui mandaria um aviso interno de área para todos.
- **`isCuritibaMetro` é derivado, nunca digitado.** Calculado no save a partir de
  cidade+UF, com a mesma função pura usada na tela (`lib/rmc.ts`), para o que se
  vê e o que se grava não divergirem. A UF entra na conta: existe Lapa em SP e
  Rio Negro em SC, e nenhuma das duas é da RMC.

## Central de comunicações

Em **/comunicacoes** (só RH) há uma matriz **tipo de aviso × canal**. Oito tipos
individuais — recuperação de senha, solicitação e decisão de férias, vencimento,
recibo, pagamento, formulário novo e cobrança — cada um ligável em WhatsApp,
Discord ou e-mail, com botão de teste que dispara para o próprio RH.

Duas regras que valem entender:

- **A notificação dentro da intranet fica fora da matriz.** Ela é o próprio
  sistema, não um canal externo que possa cair — sempre é criada.
- **O código de recuperação de senha não vira notificação in-app.** Quem precisa
  dele não consegue entrar, e o código não pode ficar registrado no sistema.

Nesta entrega o **WhatsApp faz o papel do e-mail**, por decisão de produto. O
canal de e-mail já aparece mapeado mas marcado como indisponível; quando for
implementado, é ligar por tipo sem tocar em código.

## Onde a multa acontece

O fluxo não termina na aprovação. **/ferias/controle** rastreia os três passos
seguintes, que é onde o dinheiro se perde:

- **Recibo assinado** — sem ele a empresa fica exposta.
- **Pagamento até 2 dias ÚTEIS antes do início** (art. 145). O cálculo pula fim
  de semana e feriado: contar em dias corridos daria uma data em que o dinheiro
  não entra na conta.
- **Repasse à Senior** — CSV em `/api/relatorios/ferias`, com o lote pendente
  separado, para os envios dos dias 10 e 20.

E **/ferias/vencimentos** mostra o prazo que realmente importa: o **período
concessivo** (arts. 134 e 137). Passar dele obriga a pagar em dobro. Quem entra
em situação crítica recebe aviso automático na passada diária.

## Roadmap pós-entrega

- **Envio de e-mail** (comunicados, decisões de férias, lembretes) — v1 não manda
  e-mail nenhum; WhatsApp e in-app cobrem tudo.
- **DM no Discord para o gestor** — webhook publica em canal fixo e não faz
  mensagem privada. Precisaria de um bot (`DISCORD_BOT_TOKEN`), o bot no mesmo
  servidor das pessoas, e o **ID numérico** de cada uma (a API não resolve
  `@handle`). A coluna `users.discord_user_id` já existe para isso; hoje o gestor
  é avisado por WhatsApp + in-app.
- **Acesso restrito para a Sênior** — visão só da janela de férias necessária,
  sem visibilidade interna de RH/gestores.

## Pendências conhecidas

- **Leitura do art. 134 §3º:** implementada a literal (bloqueia início na sexta
  e no sábado). A leitura mais rígida — que também bloqueia a quinta quando a
  empresa não trabalha aos sábados — está pronta atrás de
  `STRICT_SATURDAY_AS_REST` em `src/lib/clt.ts`. Falta o "de acordo" do
  RH/jurídico.
- **Lista de feriados PR/Curitiba:** conferida por pesquisa pública, não pelo
  decreto oficial. Vale a confirmação do RH antes de ir pro ar.
- **Logo:** o lockup é desenhado em código (`src/components/logo.tsx`), com
  variante em negativo para a AppBar. Trocar por SVG oficial quando chegar — a
  API do componente não muda.
