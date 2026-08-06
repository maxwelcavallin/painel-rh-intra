# Revisão de código — bugs encontrados

Documento gerado após revisão do projeto `painel-rh-intra`.

**Como a revisão foi feita:**
1. `npx tsc --noEmit` — passou sem erros
2. `npx eslint .` — passou sem erros
3. Revisão manual de todos os arquivos em `src/`, `scripts/` e configs raiz, com foco em lógica de negócio, autorização, SQL/Drizzle, race conditions e integrações externas

**Escopo deste documento:** apenas bugs verificáveis. Falso-positivos comuns (uso do modelo `claude-opus-5` e do parâmetro `output_config`) foram descartados após confirmação no SDK `@anthropic-ai/sdk@0.115.0` instalado — ambos existem oficialmente.

---

## Bug 1 — Cálculo de férias ignora abonos anteriores

**Severidade:** ALTO
**Arquivo:** `src/server/facts.ts:178-230`

### O código atual

Na função que monta os `VacationFacts` de uma nova solicitação, o sistema busca as solicitações anteriores do próprio colaborador para calcular quantos dias ele já consumiu do período aquisitivo:

```ts
// src/server/facts.ts:178
const ownRequests = await db
  .select({
    id: vacationRequests.id,
    startDate: vacationRequests.startDate,
    endDate: vacationRequests.endDate,
    status: vacationRequests.status,
    // ❌ abonoDays NÃO está no select
  })
  .from(vacationRequests)
  .where(...);

// src/server/facts.ts:218
daysAlreadyTaken = ownRequests
  .filter(r => r.status === "approved" && ...)
  .reduce((sum, r) => sum + daysBetweenInclusive(r.startDate, r.endDate), 0);
  //                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                        Só o gozo (dias entre start e end), sem abono

// src/server/facts.ts:228
const total = daysAlreadyTaken + days + abonoDays;
const exceedsAnnualLimit = total > MAX_DAYS_PER_PERIOD; // 30
```

### Por que é bug

O **abono pecuniário** (art. 143 CLT — venda de até 10 dias das férias) consome saldo do mesmo período aquisitivo que o gozo. O total legal permitido é 30 dias por período (gozo + abono). O código atual só soma o gozo das solicitações passadas, portanto sub-conta o consumo.

### Cenário reproduzível

1. Colaborador tem 1 período aquisitivo aberto (30 dias disponíveis)
2. Solicitação #1: 20 dias de gozo + 10 dias de abono → aprovada. Consumiu os 30 dias legais
3. Solicitação #2, mesmo período aquisitivo: 5 dias de gozo, 0 de abono
4. Sistema calcula:
   - `daysAlreadyTaken = 20` (só o gozo da #1, abono ignorado)
   - `total = 20 + 5 + 0 = 25`
   - `exceedsAnnualLimit = false`
5. Sistema aceita indevidamente. O total real do período passa a ser 35 dias

### Evidência de que é bug (e não intenção)

O outro módulo que calcula consumo do período faz a soma correta:

```ts
// src/server/vacation-deadlines.ts:107
const daysTaken = mine
  .filter(r => r.status === "approved")
  .reduce((sum, r) => sum + r.days + r.abonoDays, 0);
  //                        ^^^^^^^^^^^^^^^^^^^^
  //                        Gozo + abono
```

Inclusive o comentário na linha 106: `// Abono consome saldo igual ao gozo.` Ou seja, o próprio código reconhece a regra em um lugar mas esquece de aplicar em outro.

Além disso, o comentário em `facts.ts:227` diz: `// Abono consome o mesmo saldo do gozo — vender 10 dias e tirar 30 não existe.` — a intenção declarada é bloquear, mas a implementação vaza porque não considera os abonos históricos.

### Correção

```ts
// 1. Adicionar abonoDays no select
const ownRequests = await db
  .select({
    id: vacationRequests.id,
    startDate: vacationRequests.startDate,
    endDate: vacationRequests.endDate,
    status: vacationRequests.status,
    abonoDays: vacationRequests.abonoDays,  // ✅ novo
  })
  ...

// 2. Somar abono no reduce
daysAlreadyTaken = ownRequests
  .filter(...)
  .reduce(
    (sum, r) => sum + daysBetweenInclusive(r.startDate, r.endDate) + r.abonoDays,
    0,
  );
```

---

## Bug 2 — Audiência `location` sem valor manda para RMC inteira

**Severidade:** MÉDIO
**Arquivo:** `src/server/audience.ts:43-54`

### O código atual

```ts
// src/server/audience.ts:33
const scope = (() => {
  switch (audience.type) {
    case "sector":
      return audience.value ? eq(users.sector, audience.value) : null;
    case "role":
      return audience.value ? eq(users.role, audience.value) : null;
    case "user":
      return audience.value ? eq(users.id, audience.value) : null;
    case "location":
      // ❌ Não verifica se value é null
      return eq(users.isCuritibaMetro, audience.value !== "fora_rmc");
    case "all":
    default:
      return null;
  }
})();

// Guarda de segurança
if (audience.type !== "all" && scope === null) return [];
```

### Por que é bug

Todos os outros `case` (`sector`, `role`, `user`) checam `audience.value ? ... : null` antes de retornar um filtro. Isso permite que a guarda da linha 54 funcione: se veio sem valor, `scope` fica `null` e a função retorna lista vazia (comportamento seguro).

O `case "location"` pula essa checagem. Quando `audience.value === null`:
- `audience.value !== "fora_rmc"` avalia como `true` (porque `null !== "fora_rmc"`)
- Retorna `eq(users.isCuritibaMetro, true)` — filtro válido, não-nulo
- A guarda da linha 54 não dispara
- Resultado: manda a mensagem para **toda a RMC** em vez de retornar lista vazia

### Evidência de que é bug

O próprio comentário nas linhas 52-53 declara a intenção contrária:

```ts
// Audiência que exige valor mas veio sem ele não seleciona NINGUÉM.
// Cair para "todo mundo" aqui mandaria um comunicado de setor para a empresa inteira.
if (audience.type !== "all" && scope === null) return [];
```

O código admite explicitamente que fallback para "todo mundo" é o cenário que se quer evitar. A linha 45 viola essa regra por omissão.

### Impacto

Depende da UI: se o formulário sempre força `value ∈ {"rmc", "fora_rmc"}`, o bug não é explorável pela interface. Mas:
- Server actions aceitam objetos arbitrários — chamador interno com bug pode passar `{ type: "location", value: null }`
- Um refactor futuro na UI pode expor
- É defesa em profundidade que já existe para todos os outros tipos, e falha só aqui

### Correção

```ts
case "location":
  if (!audience.value) return null;
  return eq(users.isCuritibaMetro, audience.value !== "fora_rmc");
```

---

## Bug 3 — N+1 no envio de notificações

**Severidade:** MÉDIO (performance / estabilidade)
**Arquivos:** `src/server/notifications.ts:247-248` e `src/server/vacation-alerts.ts:82-102, 129-145`

### O código atual

Em `notifications.ts`, dentro de `notify()`:

```ts
// src/server/notifications.ts:247
for (const channel of CONFIGURABLE_CHANNELS) {
  if (!(await isEnabled(params.type, channel))) continue;  // 1 query por iteração
  ...
}
```

`CONFIGURABLE_CHANNELS` tem 3 canais (`email`, `whatsapp`, `discord`). Cada chamada de `notify()` faz 3 SELECTs sequenciais na tabela `notification_settings`.

E em `vacation-alerts.ts`:

```ts
// src/server/vacation-alerts.ts:82 (padrão que se repete)
for (const row of rows) {
  for (const rhUser of rhUsers) {
    await notify({ userId: rhUser.id, type: "...", ... });  // serial
  }
}
```

### Por que é bug

Suponha 50 solicitações aprovadas ainda-não-pagas + 3 usuários RH:
- 50 × 3 = 150 chamadas de `notify()`
- Cada `notify()` = 1 SELECT usuário + 3 SELECTs settings + 1 INSERT + 2 HTTPs (WhatsApp/Discord com timeout 10s cada)
- Total: **~750 queries + 300 requests HTTP, todos sequenciais**

Cenários problemáticos:
- Cron do `/api/cron/lembretes` (Vercel: timeout de 60s no free, 300s no pro) pode ser cortado no meio, deixando lembretes parcialmente enviados
- Worker do Next.js trava por minutos, impedindo requests concorrentes de outros usuários

### Evidência

`broadcasts.ts` já usa o padrão correto:

```ts
// src/server/broadcasts.ts (por volta da linha 100)
await Promise.allSettled(recipients.map(r => sendZaia({...})));
```

Os dois lugares deveriam usar a mesma estratégia.

### Correção

Duas mudanças:

1. Em `notify()`, carregar a matriz de settings uma vez em vez de query-por-canal:
```ts
const enabledMatrix = await getEnabledChannels(params.type);
for (const channel of CONFIGURABLE_CHANNELS) {
  if (!enabledMatrix[channel]) continue;
  ...
}
```

2. Em `vacation-alerts.ts`, paralelizar com `Promise.allSettled`:
```ts
await Promise.allSettled(
  rows.flatMap(row =>
    rhUsers.map(rh => notify({ userId: rh.id, type: "...", ... }))
  ),
);
```

---

## Bug 4 — `maskRg` expõe demais em RGs curtos

**Severidade:** MÉDIO (privacidade)
**Arquivo:** `src/lib/format.ts:58-64`

### O código atual

```ts
/** Mostra só os 3 últimos caracteres; o RG não tem formato único no Brasil. */
export function maskRg(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.trim();
  if (clean.length <= 3) return "***";
  return `${"*".repeat(Math.max(3, clean.length - 3))}${clean.slice(-3)}`;
}
```

### Por que é bug

O comentário promete: **"Mostra só os 3 últimos caracteres"**. Mas o número de asteriscos é `Math.max(3, clean.length - 3)`. Para strings curtas:

| Entrada    | Length | Asteriscos | Últimos 3 | Resultado    | Chars revelados |
|------------|--------|------------|-----------|--------------|-----------------|
| `"1234"`   | 4      | max(3, 1)=3| `"234"`   | `"***234"`   | 3 de 4 (75%)    |
| `"12345"`  | 5      | max(3, 2)=3| `"345"`   | `"***345"`   | 3 de 5 (60%)    |
| `"123456"` | 6      | max(3, 3)=3| `"456"`   | `"***456"`   | 3 de 6 (50%)    |
| `"1234567"`| 7      | max(3, 4)=4| `"567"`   | `"****567"`  | 3 de 7 (43%)    |

O problema é usar `Math.max(3, ...)`: quando o RG é curto, força mais estrelas do que caracteres restantes, criando uma máscara que **infla o tamanho da string** e ainda revela mais informação relativa.

O clamp `if (clean.length <= 3) return "***"` cobre só o caso extremo. Faltam os intermediários.

### Correção

```ts
export function maskRg(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.trim();
  if (clean.length <= 6) return "***";  // ✅ estende o clamp
  return `${"*".repeat(clean.length - 3)}${clean.slice(-3)}`;
}
```

---

## Bug 5 — FKs faltando no schema (integridade referencial)

**Severidade:** MÉDIO
**Arquivo:** `src/db/schema.ts`

### O código atual

Várias colunas `uuid` que **referenciam `users.id`** foram declaradas sem `.references()`:

| Linha | Coluna                             | Contexto                     |
|-------|------------------------------------|------------------------------|
| 113   | `users.managerId`                  | auto-referência (gestor)     |
| 225   | `vacationRequests.paidBy`          | quem marcou pagamento        |
| 228   | `vacationRequests.receiptRegisteredBy` | quem registrou recibo     |
| 235   | `vacationRequests.cancelledBy`     | quem cancelou                |
| 242   | `vacationRequests.rhApprovedBy`    | RH que aprovou               |
| 249   | `vacationRequests.managerApprovedBy` | gestor que aprovou         |

Exemplo:
```ts
// src/db/schema.ts:113
managerId: uuid("manager_id"),  // ❌ sem .references(() => users.id)

// src/db/schema.ts:225
paidBy: uuid("paid_by"),  // ❌ sem .references(() => users.id)
```

### Por que é bug

Sem FK no banco:
- Deletar um usuário deixa órfãos: UUIDs pendurados apontando para nada
- Nenhuma restrição impede gravar um `paidBy` com UUID aleatório
- Reports que fazem JOIN nesses campos podem devolver resultados incompletos ou linhas com nome vazio, sem erro visível no runtime
- Migrações que renomeiam IDs perdem consistência

### Evidência de que é bug (e não intenção)

Outras colunas equivalentes têm FK declarada, mostrando que o padrão do projeto é ter FK:

```ts
// src/db/schema.ts:319 (notificationSettings)
updatedBy: uuid("updated_by").references(() => users.id),

// src/db/schema.ts:341 (broadcasts)
createdBy: uuid("created_by").notNull().references(() => users.id),
```

Os campos listados acima quebram esse padrão.

O próprio `seed.ts` reconhece implicitamente o problema ao comentar sobre a ordem de delete:

```ts
// src/db/seed.ts:79-81 (aproximado)
// Ordem importa: TODO filho antes do pai...
// ...inclusive as que guardam só o autor da ação
```

Ou seja, o desenvolvedor lembra da relação lógica mas não a declarou no schema.

### Correção

Adicionar `.references(() => users.id)` em cada coluna. Para `managerId` provavelmente sem `onDelete: "cascade"` (queremos SET NULL para não perder o funcionário quando o gestor sai):

```ts
managerId: uuid("manager_id").references(() => users.id, { onDelete: "set null" }),
paidBy: uuid("paid_by").references(() => users.id, { onDelete: "set null" }),
receiptRegisteredBy: uuid("receipt_registered_by").references(() => users.id, { onDelete: "set null" }),
cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
rhApprovedBy: uuid("rh_approved_by").references(() => users.id, { onDelete: "set null" }),
managerApprovedBy: uuid("manager_approved_by").references(() => users.id, { onDelete: "set null" }),
```

Depois: `npm run db:generate` para gerar a migration e `npm run db:migrate` para aplicar.

---

## Bug 6 — `advance13th` sem checagem de unicidade anual

**Severidade:** MÉDIO (pode ser feature intencional)
**Arquivo:** `src/server/vacations.ts:53-98` (função `createVacationRequest`)

### O código atual

`createVacationRequest` aceita `advance13th: boolean` sem verificar se o colaborador já pediu antecipação do 13º em outra solicitação aprovada no mesmo ano-calendário. `buildVacationFacts` também não valida.

### Por que é potencialmente bug

Lei 4.749/65, art. 4º: a antecipação da 1ª parcela do 13º pode ser pedida **uma vez por ano-calendário**. Se o colaborador tira férias em janeiro com `advance13th=true` e depois em julho pede `advance13th=true` de novo, o sistema aceita.

### Ambiguidade

Se o RH declarar que "quem controla essa regra é a folha da Senior" (sistema externo integrado), isso vira feature intencional: o painel só registra a intenção, a Senior barra. Nesse caso, adicionar uma warning (não conflict) seria suficiente.

### Correção sugerida (se for bug)

Em `buildVacationFacts`, ao processar `advance13th=true`:

```ts
if (advance13th) {
  const year = startDate.slice(0, 4);
  const previousAdvance = ownRequests.find(
    r => r.status === "approved" && r.advance13th && r.startDate.startsWith(year),
  );
  if (previousAdvance) {
    conflicts.push(
      `Já há antecipação de 13º aprovada em ${year} (início em ${formatBR(previousAdvance.startDate)}). Art. 4º da Lei 4.749/65 permite apenas uma antecipação por ano-calendário.`,
    );
  }
}
```

---

## Observações de baixa severidade

Registradas para transparência — não recomendo corrigir imediatamente.

### 7. `"hoje"` calculado em UTC (baixo)
`src/app/(app)/ferias/controle/page.tsx:30` e `src/app/(app)/calendario/year-calendar.tsx:113` — `new Date().toISOString().slice(0, 10)` gera a data em UTC. No fuso de Brasília, entre 21h e meia-noite (UTC-3), o servidor já considera o dia seguinte. Janela curta, sem consequência jurídica; o cálculo estrutural de prazos legais em `vacation-deadlines.ts` já usa a data como parâmetro externo.

### 8. `normalizePhone` confunde DDI 55 com DDD 55 (baixo)
`src/server/zaia.ts:54` — números começando com "55" são assumidos como já tendo DDI. Colaboradores com DDD 55 (região de Santa Maria/RS) com telefone `5599999XXXX` (11 dígitos) passam pela checagem `length >= 12` e são rejeitados. Edge case; se a empresa fica em Curitiba, provavelmente nunca atinge.

### 9. Proxy no `db/index.ts` pode quebrar campos privados (baixo, não verificável)
`src/db/index.ts:30-35` — `Reflect.get(client, prop, receiver=proxy)` faz `this` dentro de métodos do Drizzle apontar para o Proxy. Se `NeonHttpDatabase` usa `#privateFields` internamente, isso lança `TypeError`. Como o app roda em produção, presumivelmente não quebra — mas o padrão é frágil.

---

## Auditado sem achados

Os seguintes arquivos/áreas foram revisados manualmente e não têm bugs identificáveis:

- **Auth/segurança:** `auth.ts`, `auth.config.ts`, `proxy.ts`, `lib/dal.ts` — allowlist correta, escopo por role no DAL, comparações timing-safe
- **CLT:** `lib/clt.ts` — aritmética UTC consistente, `easterSunday` (Meeus/Jones/Butcher) correto
- **Parecer da IA:** `server/parecer.ts`, `server/agent.ts` — escopo por role, FIFO de consumo, `clamp()` impede que a IA aprove quando há conflicts
- **Password reset:** `server/password-reset.ts` — resposta uniforme, rate limit, tentativa contada antes da comparação
- **API routes:** `cron/lembretes` valida `CRON_SECRET` + Bearer; `relatorios/*` usa `requireRoleApi("admin")` + escaping de CSV; `cep` sem exposição
- **Forms:** `server/forms.ts` — verificação de audiência no `submitResponse`, `onConflictDoUpdate` evita duplicatas
- **Server actions** em `src/app/(app)/**/actions.ts` — todas usam `requireRH`/`requireManagerOrRH`, identidade sempre da sessão, `revalidatePath` presente
- **Componentes React** (formulários, decision-card, year-calendar, employee-form, providers, app-shell) — sem hooks fora de client, sem exposição de dados sensíveis
- **Seed e migrações:** `db/seed.ts` — ordem de delete respeita FKs declaradas; scripts em `scripts/` sem credenciais hardcoded, `migrate.ts` com trava `assertDatabaseIsOurs`
- **Configs:** `next.config.ts`, `drizzle.config.ts`, `vercel.json`, `eslint.config.mjs`, `tsconfig.json` — sem opções inseguras, sem secrets versionados
- **Utilitários:** `theme.ts`, `fonts.ts`, `brand.ts`, `nav.ts`, `client-state.ts`, `password.ts`, `fake-cpf.ts` — algoritmos corretos, separação client/server respeitada

---

## Resumo

| # | Bug | Severidade | Arquivo |
|---|-----|-----------|---------|
| 1 | Cálculo de férias ignora abonos anteriores | **ALTO** | `src/server/facts.ts:218-225` |
| 2 | Audiência `location` sem valor manda para RMC inteira | MÉDIO | `src/server/audience.ts:43-45` |
| 3 | N+1 no envio de notificações | MÉDIO | `src/server/notifications.ts:247`, `vacation-alerts.ts:82,129` |
| 4 | `maskRg` expõe demais em RGs curtos | MÉDIO | `src/lib/format.ts:63` |
| 5 | FKs faltando no schema | MÉDIO | `src/db/schema.ts:113,225,228,235,242,249` |
| 6 | `advance13th` sem checagem de unicidade anual | MÉDIO (talvez feature) | `src/server/vacations.ts:53-98` |
| 7 | "hoje" em UTC | baixo | `ferias/controle/page.tsx:30`, `year-calendar.tsx:113` |
| 8 | DDI 55 vs DDD 55 | baixo | `src/server/zaia.ts:54` |
| 9 | Proxy pode quebrar campos privados | baixo | `src/db/index.ts:30-35` |

**Total:** 1 alto, 5 médios, 3 baixos. Nenhum crítico. Nenhum bug de tipo/lint (ambos passam limpos).
