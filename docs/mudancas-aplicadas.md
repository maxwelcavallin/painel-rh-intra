# Mudanças aplicadas — correção dos bugs da revisão

Documento complementar ao [revisao-codigo-bugs.md](./revisao-codigo-bugs.md). Descreve, bug por bug, o que foi alterado e por quê.

**Validação:**
- `npx tsc --noEmit` — passou limpo
- `npx eslint .` — passou limpo
- `npm run test:clt` — 35/35 ok
- `npm run test:clt2` — 39/39 ok
- `npm run test:cadastro` — 34/34 ok
- Testes que dependem de DB (`test:ferias`, etc.) não foram executados por falta de conexão neste ambiente — recomendo rodar antes de subir

**Arquivos alterados:**
- `src/server/audience.ts`
- `src/lib/format.ts`
- `src/server/facts.ts`
- `src/server/vacations.ts`
- `src/db/schema.ts`
- `src/server/notifications.ts`
- `src/server/vacation-alerts.ts`
- `src/lib/clt.ts`
- `src/app/(app)/ferias/controle/page.tsx`
- `src/app/(app)/calendario/year-calendar.tsx`
- `src/server/zaia.ts`
- `src/db/index.ts`
- `scripts/migrate.ts` (Bug 11)
- `src/lib/format.ts` (Bug 13 — helper `csvCell`)
- `src/app/api/relatorios/ferias/route.ts` (Bug 13)
- `src/app/api/relatorios/colaboradores/route.ts` (Bug 13)
- `src/app/(app)/colaboradores/employee-form.tsx` (Bug 14)

---

## Bug 1 — Cálculo de férias ignora abonos anteriores

**Arquivo:** `src/server/facts.ts`

**Mudança 1** — incluído `abonoDays` (e `advance13th`, aproveitando o mesmo select) na consulta de solicitações próprias:

```ts
const ownRequests = await db
  .select({
    id: vacationRequests.id,
    startDate: vacationRequests.startDate,
    endDate: vacationRequests.endDate,
    status: vacationRequests.status,
    abonoDays: vacationRequests.abonoDays,       // ✅ novo
    advance13th: vacationRequests.advance13th,   // ✅ novo (usado no Bug 6)
  })
  .from(vacationRequests)
  ...
```

**Mudança 2** — soma `abonoDays` no cálculo de `daysAlreadyTaken`:

```ts
daysAlreadyTaken = ownRequests
  .filter(...)
  .reduce(
    // Abono consome saldo igual ao gozo — ver vacation-deadlines.ts:107.
    (sum, r) => sum + daysBetweenInclusive(r.startDate, r.endDate) + r.abonoDays,
    0,
  );
```

Alinha `facts.ts` com `vacation-deadlines.ts:107-109`, que já fazia a soma correta.

---

## Bug 2 — Audiência `location` sem valor manda para RMC inteira

**Arquivo:** `src/server/audience.ts`

Adicionada guarda para `audience.value` ausente no `case "location"`, seguindo o mesmo padrão dos outros cases (`sector`, `role`, `user`):

```ts
case "location":
  // Sem valor cai no `scope === null` da linha abaixo — não seleciona ninguém.
  return audience.value
    ? eq(users.isCuritibaMetro, audience.value !== "fora_rmc")
    : null;
```

Agora `{ type: "location", value: null }` retorna lista vazia (comportamento esperado pela guarda da linha 54), em vez de "toda a RMC".

---

## Bug 3 — N+1 no envio de notificações

**Arquivos:** `src/server/notifications.ts`, `src/server/vacation-alerts.ts`

**Mudança 1** (`notifications.ts`) — trocar 3 queries `isEnabled` sequenciais por 1 query só que carrega a matriz de canais do tipo:

```ts
const settingsRows = await db
  .select({
    channel: notificationSettings.channel,
    enabled: notificationSettings.enabled,
  })
  .from(notificationSettings)
  .where(eq(notificationSettings.type, params.type));
const channelEnabled: Partial<Record<Channel, boolean>> = {};
for (const row of settingsRows) channelEnabled[row.channel] = row.enabled;

for (const channel of CONFIGURABLE_CHANNELS) {
  if (!channelEnabled[channel]) continue;
  ...
}
```

Cada `notify()` cai de **3 queries de settings** para **1 query**.

**Mudança 2** (`vacation-alerts.ts`) — coletar todas as notificações pendentes num array e disparar com `Promise.allSettled` no fim, em vez de duplo `for` com `await` serial:

```ts
type Pending = Parameters<typeof notify>[0];
const pending: Pending[] = [];

for (const row of rows) {
  ...
  pending.push({ type: "vacation_payment", userId: rh.id, ... });
  ...
}

const results = await Promise.allSettled(pending.map((p) => notify(p)));
report.notified = results.filter((r) => r.status === "fulfilled").length;
```

Antes: N × M × ~5 queries + HTTPs em série. Agora: paralelo com falha isolada.

---

## Bug 4 — `maskRg` expõe demais em RGs curtos

**Arquivo:** `src/lib/format.ts`

Estendido o clamp de "muito curto" de `<=3` para `<=6`, e removido o `Math.max(3, ...)` que inflava a máscara:

```ts
export function maskRg(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.trim();
  // RGs curtos revelariam quase tudo com "***" + últimos 3; escondemos por completo.
  if (clean.length <= 6) return "***";
  return `${"*".repeat(clean.length - 3)}${clean.slice(-3)}`;
}
```

Agora nenhuma entrada de até 6 caracteres vaza dígitos.

---

## Bug 5 — FKs faltando no schema

**Arquivo:** `src/db/schema.ts`

Adicionado `.references(() => users.id)` em 6 colunas que apontam para `users.id` sem constraint:

| Coluna                             | Tabela             | `ON DELETE` |
|------------------------------------|--------------------|-------------|
| `managerId`                        | `users`            | `set null`  |
| `paidBy`                           | `vacationRequests` | `no action` |
| `receiptRegisteredBy`              | `vacationRequests` | `no action` |
| `cancelledBy`                      | `vacationRequests` | `no action` |
| `rhApprovedBy`                     | `vacationRequests` | `no action` |
| `managerApprovedBy`                | `vacationRequests` | `no action` |

**`managerId` → `set null`.** É um ponteiro operacional, não um registro histórico: quando o gestor sai, o funcionário continua existindo, apenas sem gestor. `cascade` aqui apagaria o subordinado junto — inaceitável.

**As 5 colunas de autoria de `vacationRequests` → `no action`** (o padrão do drizzle quando não se passa `onDelete`). A revisão original sugeriu `set null` para todas, mas isso apaga em silêncio *quem* aprovou, pagou ou cancelou umas férias. Férias respondem a fiscalização — recibo assinado, prazo do art. 145 — e um registro sem autor não se reconstrói. `no action` faz o banco recusar o delete e preservar o rastro.

Isso também alinha com o padrão que o projeto já tinha: `broadcasts.created_by`, `forms.created_by` e `notification_settings.updated_by` são todas `no action`. E o `seed.ts` já foi escrito para esse mundo — apaga `vacationRequests` (linha 89) antes de `users` (linha 90), com o comentário nas linhas 79-81 dizendo explicitamente que colunas de "autor da ação" precisam entrar na ordem de limpeza.

Na prática a constraint quase nunca dispara: o app não faz hard delete de usuário, usa soft delete (`isActive` / `employmentStatus: "desligado"`). O único `delete(users)` do projeto está no seed.

Para `managerId` (auto-referência de `users`), foi necessário importar o tipo `AnyPgColumn` do `drizzle-orm/pg-core`:

```ts
import { ..., type AnyPgColumn } from "drizzle-orm/pg-core";

managerId: uuid("manager_id").references((): AnyPgColumn => users.id, {
  onDelete: "set null",
}),
```

### Migration — aplicada

```
drizzle/0004_cold_thena.sql   ADD CONSTRAINT nas 6 colunas
drizzle/0005_sad_wallop.sql   troca as 5 de vacationRequests para no action
```

Antes de aplicar foi verificado que não havia órfãos — `ADD CONSTRAINT` falha se alguma coluna guardar um UUID que não existe em `users.id`:

| Coluna                                    | Preenchidos | Órfãos |
|-------------------------------------------|-------------|--------|
| `users.manager_id`                        | 9           | 0      |
| `vacation_requests.paid_by`               | 4           | 0      |
| `vacation_requests.receipt_registered_by` | 4           | 0      |
| `vacation_requests.cancelled_by`          | 0           | 0      |
| `vacation_requests.rh_approved_by`        | 3           | 0      |
| `vacation_requests.manager_approved_by`   | 3           | 0      |

Essa checagem não é opcional neste projeto: o `migrate.ts` usa o driver `neon-http`, que **não tem transação**. Uma migration que falha no meio fica aplicada pela metade, sem rollback.

---

## Bug 6 — `advance13th` sem checagem de unicidade anual

**Arquivo:** `src/server/facts.ts` (+ ajuste em `src/server/vacations.ts`)

Adicionado bloco após a validação de abono que emite **warning** (não conflict, pois pode ser feature intencional gerenciada pela folha Senior) quando o colaborador já tem outra solicitação com `advance13th=true` no mesmo ano-calendário:

```ts
/* --- Antecipação do 13º: uma por ano-calendário (Lei 4.749/65) ---- */
if (params.advance13th) {
  const year = startDate.slice(0, 4);
  const priorAdvance = ownRequests.find(
    (r) =>
      r.status !== "rejected" &&
      r.advance13th &&
      r.startDate.startsWith(year),
  );
  if (priorAdvance) {
    warnings.push(
      `Já existe solicitação com antecipação do 13º em ${year} ` +
      `(início em ${formatBR(priorAdvance.startDate)}, status ${priorAdvance.status}). ` +
      `A Lei 4.749/65, art. 4º, permite apenas uma antecipação por ano-calendário — ` +
      `confira antes de aprovar.`,
    );
  }
}
```

Foi acrescentado `advance13th?: boolean` ao tipo de `params` de `buildVacationFacts`, e `vacations.ts:73` (única chamada real) passa o valor:

```ts
const facts = await buildVacationFacts({ userId, startDate, endDate, abonoDays, advance13th });
```

**Por que warning e não conflict:** dependendo da política do RH, pode haver casos legítimos (correção, cancelamento e refazer). Como warning, o parecer da IA e o gestor humano ficam cientes; se o RH declarar que quer bloqueio rígido, basta trocar `warnings.push` por `conflicts.push`.

---

## Bug 7 — "hoje" calculado em UTC

**Arquivos:** `src/lib/clt.ts`, `src/app/(app)/ferias/controle/page.tsx`, `src/app/(app)/calendario/year-calendar.tsx`

Adicionado helper em `clt.ts`:

```ts
/**
 * Data ISO de "hoje" no fuso de São Paulo — a jornada trabalhista aqui é
 * regida por horário local. Server rodando em UTC (Vercel) já foi para o dia
 * seguinte às 21h de Brasília; usar isso derruba o "quantos dias faltam".
 * `sv-SE` é o formato ISO YYYY-MM-DD que o `Intl` entrega naturalmente.
 */
export function todayISOBrazil(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}
```

E substituído `new Date().toISOString().slice(0, 10)` por `todayISOBrazil()` em:
- `ferias/controle/page.tsx:30` (função `diasAte`)
- `calendario/year-calendar.tsx:113` (marca "hoje" no calendário)

**Nota:** deixei os outros usos de `toISOString().slice(0, 10)` que estão em fluxos server-side puros (crons, testes, agentes com `todayISO` parametrizado) porque neles a data é passada explicitamente e não é usada para julgar "quantos dias faltam pro usuário".

---

## Bug 8 — `normalizePhone` confunde DDI 55 com DDD 55

**Arquivo:** `src/server/zaia.ts`

Substituída heurística "começa com 55" por checagem de comprimento consistente com números brasileiros:

```ts
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  // Número BR sem DDI: 10 (fixo) ou 11 (celular). Com DDI 55: 12 ou 13.
  // "Começa com 55" NÃO é garantia de DDI — DDD 55 (Santa Maria/RS) também
  // começa. Distinguimos pelo comprimento total.
  if (digits.length === 12 || digits.length === 13) {
    return digits.startsWith("55") ? digits : `55${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}
```

Regras aplicadas:
- 10 dígitos (fixo, DDD+8) ou 11 (celular, DDD+9) → prefixa 55
- 12 (DDI+fixo) ou 13 (DDI+celular) → mantém, prefixa se não começar com 55
- Qualquer outro comprimento → `null`

---

## Bug 9 — Proxy do `db` pode quebrar campos privados

**Arquivo:** `src/db/index.ts`

Mudança conservadora, mantendo o lazy loading que o comentário original explica:

```ts
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    client ??= createClient();
    // `receiver = client` (não o Proxy). Se o Drizzle usar campos privados
    // (`#field`) internamente, refletir com o Proxy como receiver estoura
    // TypeError; passar o client evita isso e não muda semântica de leitura.
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
```

Duas mudanças:
- `Reflect.get(client, prop, client)` em vez de `receiver=proxy` — se algum getter interno do Drizzle acessar `this.#field`, agora `this` resolve para o `client` real
- `.bind(client)` para funções — garante que métodos chamados via `db.select()` tenham `this=client` mesmo se JS resolver `this=proxy` no call-site

Sem impacto funcional para o caso feliz; só cobre a categoria de bug que pode surgir se o `NeonHttpDatabase` internamente usar campos privados.

---

---

## Bug 10 — Regressão: `report.notified` conta pending, não entregas

**Arquivo:** `src/server/vacation-alerts.ts`

Encontrado numa segunda passagem de revisão. Ao paralelizar com `Promise.allSettled` (correção do Bug 3), a métrica `report.notified` foi contada como "Promises fulfilled". Mas `notify()` é documentado para nunca lançar — todo erro é capturado internamente e devolve um `DispatchOutcome` com canal marcado como `"failed"`. Logo, **todos** os Promises resolvem fulfilled, e `report.notified` virou matematicamente igual a `pending.length`.

**Correção** — inspecionar o valor retornado e contar entregas efetivas:

```ts
const results = await Promise.allSettled(pending.map((p) => notify(p)));
// `notify()` nunca lança — o filtro `fulfilled` sozinho contaria só tentativas
// enfileiradas. Consideramos "notificado" quem gravou in-app OU teve pelo menos
// um canal externo entregue, alinhando com o significado do envio serial anterior.
report.notified = results.filter(
  (r) =>
    r.status === "fulfilled" &&
    (r.value.inApp || r.value.channels.some((c) => c.status === "sent")),
).length;
```

Agora a métrica reflete "quantas pessoas efetivamente receberam algo" (mesmo que só via in-app), preservando o significado da versão serial anterior.

---

## Bug 11 — `OWN_TABLES` em `migrate.ts` desatualizado

**Arquivo:** `scripts/migrate.ts`

`assertDatabaseIsOurs` compara as tabelas do banco contra a allowlist `OWN_TABLES` e aborta a migração se encontra qualquer nome fora dela. A tabela `notification_settings` (definida em `schema.ts:319`) estava faltando na lista — a primeira migração aplica a tabela, e a próxima execução aborta com:

> ABORTADO: este banco contém tabelas que não são deste projeto: notification_settings

Não é regressão da correção — era um bug latente que só se manifesta na segunda execução do migrate contra um banco que já tinha a tabela.

**Correção:**

```ts
const OWN_TABLES = new Set([
  "users",
  "password_reset_codes",
  "vacation_requests",
  "notifications",
  "notification_settings",   // ✅ novo
  "broadcasts",
  "broadcast_deliveries",
  "forms",
  "form_responses",
]);
```

Nota: `__drizzle_migrations` (tabela de tracking do próprio Drizzle) mora no schema `drizzle`, não em `public`, então a checagem já a ignora naturalmente.

---

## Bug 12 — `facts.ts` `todayISO` em UTC

**Arquivo:** `src/server/facts.ts:43-47`

Mesma classe do Bug 7, mas em outro arquivo. A primeira revisão só sinalizou `controle/page.tsx` e `year-calendar.tsx`; `facts.ts` — motor que decide bloqueios/warnings de férias — continuou UTC.

**Correção:** substituir por `todayISOBrazil()` (helper criado no Bug 7):

```ts
function todayISO(): string {
  // Regra trabalhista é local — usar UTC daria "amanhã" após 21h de Brasília
  // e derrubaria `startsInThePast`/`noticeDays` no período noturno.
  return todayISOBrazil();
}
```

Impacto: após 21h de Brasília, `startsInThePast` marcava erroneamente `true` para solicitações de hoje, e `noticeDays` da política de 40 dias subtraía um dia inteiro.

---

## Bug 13 — CSV injection nos relatórios

**Arquivos:** `src/lib/format.ts` (novo helper), `src/app/api/relatorios/ferias/route.ts`, `src/app/api/relatorios/colaboradores/route.ts`

Escaping anterior cobria só aspas. Campo começando com `=`, `+`, `-`, `@` ou tab é executado pelo Excel/LibreOffice mesmo dentro de aspas — as aspas envolventes são removidas antes da avaliação.

**Cenário concreto:** colaborador com nome `=SUM(A:A)` (ou pior, `=cmd|'/c calc'!A1` no Windows) executa fórmula/comando no destino quando o CSV é aberto pela contabilidade.

**Correção:** novo helper `csvCell()` em `lib/format.ts`:

```ts
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  const safe = /^[=+\-@\t]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
```

Aplicado nos dois route handlers substituindo `.map((campo) => \`"${String(campo).replace(/"/g, '""')}"\`)` por `.map(csvCell)`.

---

## Bug 14 — Race no autocompletar de CEP

**Arquivo:** `src/app/(app)/colaboradores/employee-form.tsx`

`handleCepChange` disparava fetch sem cancelar requests anteriores. Digitação rápida podia gerar cenário onde a resposta lenta chega depois da rápida, sobrescrevendo `city`/`state` com dados do CEP antigo.

**Correção:** ref com contador de sequência que descarta respostas fora de ordem:

```ts
const cepSeqRef = useRef(0);

async function handleCepChange(raw: string) {
  ...
  const seq = ++cepSeqRef.current;
  ...
  const response = await fetch(`/api/cep?cep=${cep}`);
  if (seq !== cepSeqRef.current) return; // resposta obsoleta
  ...
  const address = await response.json();
  if (seq !== cepSeqRef.current) return; // outra digitação chegou primeiro
  setValues(...);
}
```

Preferi ref+contador em vez de `AbortController` porque o abort não impede a resposta que já está no meio da deserialização de completar antes do abort chegar; o contador cobre esse caso também.

---

## Resumo

| # | Bug | Status | Arquivos |
|---|-----|--------|----------|
| 1 | Cálculo de férias ignora abonos | ✅ | `facts.ts` |
| 2 | Audiência `location` null | ✅ | `audience.ts` |
| 3 | N+1 em notificações | ✅ | `notifications.ts`, `vacation-alerts.ts` |
| 4 | `maskRg` expõe demais | ✅ | `format.ts` |
| 5 | FKs faltando (**requer migration**) | ✅ | `schema.ts` |
| 6 | `advance13th` unicidade anual | ✅ (como warning) | `facts.ts`, `vacations.ts` |
| 7 | "hoje" em UTC | ✅ | `clt.ts`, `controle/page.tsx`, `year-calendar.tsx` |
| 8 | DDI 55 vs DDD 55 | ✅ | `zaia.ts` |
| 9 | Proxy do db | ✅ | `db/index.ts` |
| 10 | `report.notified` conta pending (regressão do Bug 3) | ✅ | `vacation-alerts.ts` |
| 11 | `OWN_TABLES` sem `notification_settings` | ✅ | `scripts/migrate.ts` |
| 12 | `facts.ts` `todayISO` em UTC (mesma classe do Bug 7) | ✅ | `facts.ts` |
| 13 | CSV injection nos relatórios | ✅ | `format.ts`, `relatorios/{colaboradores,ferias}/route.ts` |
| 14 | Race no autocompletar de CEP | ✅ | `colaboradores/employee-form.tsx` |

## Checklist antes de subir

1. [x] `npm run db:generate` — migrations `0004` e `0005` geradas
2. [x] Revisar a migration em `drizzle/` antes de aplicar — feito, e aplicada com `npm run db:migrate`
3. [ ] Rodar `npm run test:all` (precisa de DB conectado) para validar suite completa
4. [ ] Testar manualmente:
   - Solicitar férias com abono já usufruído (Bug 1)
   - Enviar aviso segmentado por localidade (Bug 2)
   - Cron `/api/cron/lembretes` com Discord/WhatsApp em ambiente de staging (Bug 3)
   - Cadastrar um colaborador com telefone de DDD 55 (Bug 8)
5. [ ] Pedir aprovação do gestor
6. [ ] Subir mudanças e aplicar migration em produção
