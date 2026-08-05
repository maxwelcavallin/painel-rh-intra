# Intranet RH — 01 Tec

**Acesso:** https://painel-rh-intra.vercel.app

Este roteiro leva cerca de **15 minutos** e mostra o produto na ordem em que o
problema aparece no dia a dia do RH. Cada passo diz o que clicar e o que
observar. Se preferir explorar por conta própria, os acessos estão no fim.

---

## O problema que este projeto resolve

Férias na CLT têm um relógio que ninguém vê correr. O período **aquisitivo**
fecha a cada 12 meses de trabalho; a partir daí a empresa tem mais 12 meses — o
período **concessivo** — para conceder essas férias. Passou do prazo, o art. 137
manda **pagar em dobro**.

Hoje esse controle vive numa planilha. A planilha não avisa ninguém, não conhece
as regras de fracionamento, não sabe que o pagamento vence 2 dias úteis antes do
início (art. 145) e não impede que alguém marque férias começando numa
sexta-feira (art. 134 §3º). O erro só aparece quando vira custo.

A intranet fecha esse ciclo inteiro: solicitação, análise das regras, dupla
aprovação, prazo de pagamento, recibo, repasse à contabilidade — e avisa antes,
em vez de esperar alguém perguntar.

---

## Roteiro

### 1. A porta está trancada (1 min)

Antes de entrar, cole na barra do navegador:

```
https://painel-rh-intra.vercel.app/ferias/vencimentos
```

Você cai no login. Tente qualquer outro endereço interno — mesmo resultado.

**O que observar:** não existe rota pública. A regra é *negar por padrão*: cada
tela nova nasce protegida, sem precisar que alguém lembre de trancá-la. Só
login e recuperação de senha ficam abertos. A verificação acontece em duas
camadas independentes, e a que vale é a que fica junto do dado — a autorização é
checada de novo na hora de ler ou gravar, nunca só na tela.

### 2. O painel que a planilha não dá (3 min)

Entre como RH:

```
rh@01tec.com.br  /  RH01Tec@2026
```

Vá em **Vencimento de férias**.

**O que observar:** a coluna *Conceder até* é o prazo do art. 137, e a
*Situação* traduz a urgência. Você verá o espectro completo:

- **Larissa Antunes Peixoto** — *vencida*. Entrou em maio de 2024, o primeiro
  período fechou em maio de 2025 e o prazo de concessão passou em maio de 2026.
  Ninguém percebeu. É o caso que custa dinheiro.
- **Bruno Sampaio Rocha** — *crítico*, com o prazo em 14/08/2026.
- **Tiago Moreira Lins** — *atenção*, prazo em 07/10/2026.
- **O restante em dia**, com o histórico já quitado — inclusive quem nunca
  chegou a ter um período fechado.

A conta não é "12 meses após a admissão". O sistema percorre todos os períodos
que já fecharam, consome o que a pessoa já usufruiu na ordem em que a lei manda
consumir, e mostra **o mais antigo ainda em aberto** — que é o que prende. Quem
já quitou tudo sai da lista.

> Esta tela nasceu de um erro real de projeto. A primeira versão olhava sempre o
> período mais recente, cujo prazo está sempre no futuro: a condição "vencido"
> era inalcançável e o painel nunca acusaria ninguém. O teste automatizado
> escrito depois expôs a falha. Hoje são 321 verificações cobrindo esse caminho.

> **Nota para quem for demonstrar:** os prazos correm de verdade. O caso
> *crítico* do Bruno vence em 14/08/2026 — depois dessa data ele aparece como
> *vencido*, e a tela passa a mostrar dois vencidos em vez de um vencido e um
> crítico. O cálculo continua certo; só o roteiro acima é que desatualiza.
> Para recompor o cenário, ajuste as contagens de `historico()` em
> `src/db/seed.ts` e rode `npm run db:seed && npm run db:equipe`.

### 3. As regras da CLT aplicadas na entrada (4 min)

Saia e entre como colaborador:

```
kauan.jesus@01tec.com.br  /  Kauan01Tec@26
```

Vá em **Solicitar férias** e tente, de propósito, o que a lei não permite:

| Tente isto | O que a lei diz |
| --- | --- |
| Começar numa **sexta-feira** | Art. 134 §3º — não pode iniciar nos 2 dias antes do descanso semanal |
| Pedir **mais de 30 dias** | Art. 130 — 30 dias por período aquisitivo |
| Vender **11 dias** de abono | Art. 143 — o teto é um terço, 10 dias |
| Fracionar em pedaço de **menos de 5 dias** | Art. 134 §1º — nenhum trecho abaixo de 5, e um deles com 14 ou mais |
| Pedir com **menos de 40 dias** de antecedência | Art. 135 exige 30; a política da empresa exige 40 |

**O que observar:** a recusa não é um "erro de validação". Ela cita o artigo e
explica em português o que precisa mudar. E há uma distinção deliberada: o que a
**lei** proíbe é bloqueio; o que a **política interna** pede a mais é aviso — o
RH continua podendo decidir.

**Sobre a análise automática:** o sistema usa IA para redigir o parecer, mas
**a IA não decide**. Os impedimentos legais são calculados em código, antes e
depois do modelo responder. Se o parecer discordar do cálculo, o cálculo vence.
Isso também protege contra alguém escrever "ignore as regras acima" no campo de
observações — foi testado exatamente assim.

Agora faça uma solicitação **válida** e envie.

### 4. Dupla aprovação e o relógio do pagamento (3 min)

Entre como gestor:

```
maxwel.cavallin@01tec.com.br  /  Gestor01Tec@26
```

Em **Aprovações**, você vê apenas quem reporta a você — o recorte é feito na
consulta ao banco, não escondendo elementos da tela. Aprove a solicitação.

**O que observar:** ela **não** fica aprovada. Falta o RH. Volte como RH e
aprove. Só agora o status muda — e aparece uma data nova: **Pagar até**.

Essa data é o art. 145: pagamento até 2 dias **úteis** antes do início. Se as
férias começam numa segunda, o prazo recua para a quinta anterior, porque fim de
semana não conta. Feriado empurra mais um dia. É a data que gera multa, e ela
passa a existir sozinha no momento da aprovação.

### 5. O que a Thamires faz todo mês (3 min)

Ainda como RH, vá em **Controle de férias**.

**O que observar:** é a fila de trabalho do mês, com cada linha num estágio
diferente — uma completa, uma esperando pagamento, uma esperando tudo. Recibo,
pagamento e repasse à contabilidade viram registro com data e autor, não
memória de quem cuidou.

Clique em **CSV do lote pendente**. O arquivo abre direto no Excel em português
e é o que vai para a contabilidade nos dias 10 e 20.

> O acesso direto da contabilidade ao sistema ficou no roadmap. O relatório
> resolve a necessidade agora, sem dar controle operacional a quem só precisa
> consultar.

### 6. Comunicação sob controle do RH (2 min)

Vá em **Comunicações**.

**O que observar:** cada tipo de aviso pode ser ligado ou desligado por canal,
sem mexer em código. Duas decisões visíveis aqui:

- **O WhatsApp faz o papel do e-mail nesta entrega.** O canal de e-mail aparece
  mapeado e marcado como "em breve" — quando for implementado, é só ligar.
- **A notificação dentro da intranet não está na matriz, de propósito.** Ela é o
  próprio sistema. Desligar o WhatsApp não pode apagar o sino.

Canal que ainda não entrega fica marcado como indisponível em vez de fingir que
enviou.

---

## Como cada ponto levantado pelo RH foi tratado

| Pedido da reunião | Estado |
| --- | --- |
| Controle de vencimento de férias | Entregue — tela, alertas e passada diária |
| Abono pecuniário e antecipação do 13º | Entregue, com o teto do art. 143 aplicado |
| Prazo de pagamento e recibo | Entregue, com data calculada em dias úteis |
| Repasse à contabilidade | Entregue como relatório CSV |
| Aviso individual em vez de canal geral | Entregue — cada aviso vai a quem interessa |
| Central para ligar e desligar comunicações | Entregue |
| Acesso da contabilidade ao sistema | Roadmap — o CSV cobre a necessidade agora |
| Comunicação por e-mail | Roadmap — WhatsApp faz o papel nesta entrega |
| DM pelo Discord | Roadmap — depende de um bot |

---

## O que ainda não faz

Dito na frente, porque um produto que esconde os próprios limites é pior que um
produto incompleto:

- **E-mail não envia.** Decisão de produto: nesta entrega o WhatsApp cobre o
  papel. O canal está mapeado, sem entregar.
- **Discord entrega em canal, não em DM.** A mensagem privada depende de um bot.
- **Lembretes rodam uma vez por dia.** Limite do plano gratuito de hospedagem.
  As telas têm botão de disparo manual para quando não dá para esperar.
- **A contabilidade não tem acesso próprio.** Só o relatório.

---

## Sobre os dados

O ambiente tem dois grupos de pessoas, e a distinção importa:

**Os sete do cenário de demonstração** — Bruno, Camila, Tiago, Larissa, Rodrigo,
Patrícia e Helena — são **inteiramente fictícios**. Nomes, CPFs, RGs, endereços
e filiação foram gerados para a demonstração e não correspondem a pessoa alguma.
Os CPFs têm dígito verificador válido apenas para o formulário aceitá-los.

**As contas da equipe da 01 Tec**, usadas para testar o produto, têm nome e
e-mail reais. Todo o resto — CPF, RG, nascimento, endereço, filiação e data de
admissão — é preenchimento, pelo mesmo motivo: são contas de teste, não
cadastro de RH. O telefone fica deliberadamente em branco, para que nenhum
número inventado receba mensagem de verdade.

Dados sensíveis nunca aparecem em log nem em endereço de página, e são exibidos
mascarados fora da tela de edição.

---

## Acessos

| Papel | E-mail | Senha |
| --- | --- | --- |
| RH (admin master) | rh@01tec.com.br | `RH01Tec@2026` |
| Gestor | maxwel.cavallin@01tec.com.br | `Gestor01Tec@26` |
| Colaborador | kauan.jesus@01tec.com.br | `Kauan01Tec@26` |

---

## Ficha técnica

Next.js 16 com App Router e TypeScript · PostgreSQL no Neon com Drizzle ·
Auth.js com sessões JWT · MUI v9 sobre design system próprio da 01 Tec ·
API da Anthropic para o parecer das solicitações · Zaia para WhatsApp ·
hospedagem na Vercel.

**Segurança:** negação por padrão em duas camadas, autorização verificada junto
do dado, regras legais aplicadas em código independentemente da IA.

**Testes:** 321 verificações automatizadas em 11 suítes, cobrindo as regras da
CLT, o cálculo de vencimento, o fluxo operacional de ponta a ponta, o cadastro,
os formulários, os avisos e a central de comunicações.
