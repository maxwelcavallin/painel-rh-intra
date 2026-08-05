# Testes de usabilidade — time interno

**Produto:** Intranet RH 01 Tec
**Ambiente:** https://painel-rh-intra.vercel.app
**Checklist interativo:** abra `docs/checklist-testes.html` no navegador

---

## O que estamos testando (e o que não estamos)

Estamos testando **usabilidade**: se a pessoa consegue fazer o que precisa sem
alguém do lado explicando. Não é caça a bug de código — isso já tem 321
verificações automatizadas rodando. O que os testes automatizados **não**
conseguem ver é: o botão está onde a pessoa procura? A mensagem de erro explica
o que fazer? A tela responde a pergunta que a pessoa tinha ao abrir?

Se você travar em algum ponto, **esse é o achado**. Anote onde travou e o que
você esperava que acontecesse. "Achei feio" também vale, mas diga o que
especificamente atrapalhou.

---

## Antes de começar

**Cada pessoa testa com o próprio acesso.** Não empreste login: metade das
regras depende de quem você é, e testar com o login errado invalida o
resultado.

| Nome | E-mail | Senha | Papel |
| --- | --- | --- | --- |
| Thayla Zappielo Oliveira | thayla.oliveira@01tec.com.br | `Thayla01Tec@26` | Colaborador |
| Rafaela Nascimento | rafaela.nascimento@01tec.com.br | `Rafaela01Tec@26` | Colaborador |
| Kamilly Vitoria Melo Mateus | kamilly.mateus@01tec.com.br | `Kamilly01Tec@26` | Colaborador |
| Kauan Henrique de Jesus Kutzki | kauan.jesus@01tec.com.br | `Kauan01Tec@26` | Colaborador |
| Maxwel Cavallin | maxwel.cavallin@01tec.com.br | `Gestor01Tec@26` | Gestor |
| RH (admin master) | rh@01tec.com.br | `RH01Tec@2026` | RH |

Os quatro colaboradores reportam ao Maxwel. Isso importa: solicitação de férias
precisa passar pelo gestor **e** pelo RH.

**Além de vocês, o banco tem 7 pessoas fictícias** (Bruno, Camila, Tiago,
Larissa, Rodrigo, Patrícia, Helena) com histórico de férias montado. Elas
existem para as telas terem o que mostrar. Não estranhe encontrá-las.

---

## Como reportar

Para cada achado, registre:

1. **Onde** — a tela e o que você tinha acabado de fazer
2. **O que esperava** — em uma frase
3. **O que aconteceu**
4. **Gravidade** — travou de vez / deu para contornar / incomodou
5. **Print**, se ajudar

Um bloco de anotações livre já resolve. O checklist HTML tem campo de
observação em cada item e exporta tudo no final.

---

## Roteiro por papel

Faça o do seu papel. Se sobrar tempo, faça outro — olhar o produto pelos olhos
de outra função costuma render bons achados.

### A. Colaborador (Thayla, Rafaela, Kamilly, Kauan)

**A1. Primeiro acesso.** Entre com seu e-mail e senha. Repare no que a tela
inicial te conta: dá para entender o que fazer aqui sem perguntar?

**A2. Recuperar a senha.** Saia, clique em "Esqueci minha senha" e vá até o
fim. *O código chega por WhatsApp, e seu telefone está em branco no cadastro —*
*então a mensagem não vai chegar.* Isso é esperado. O que interessa: a tela
explica direito o que está acontecendo, ou parece que quebrou?

**A3. Pedir férias.** Vá em Solicitar férias e peça um período qualquer.
Repare no que o sistema responde. Depois **tente de propósito**:

- começar as férias numa **sexta-feira** (a CLT proíbe começar nos 2 dias antes
  do descanso semanal)
- pedir com **menos de 40 dias de antecedência**
- pedir **mais de 30 dias**
- **vender 11 dias** de abono (o teto legal é 10)
- fracionar em um pedaço de **menos de 5 dias**

A recusa explica o motivo de um jeito que você entenderia sem conhecer a CLT?

**A4. Acompanhar.** Vá em Minhas férias e veja o estado da sua solicitação.
Dá para saber em quem ela está parada?

**A5. Cancelar.** Cancele a solicitação que você criou. O caminho é óbvio?

**A6. Calendário.** Veja quem mais da equipe está de férias no período.

**A7. Formulários.** Se houver algum aberto, responda. Tente enviar com uma
pergunta obrigatória em branco.

**A8. Onde você NÃO deveria entrar.** Tente abrir estes endereços digitando na
barra do navegador:
`/aprovacoes`, `/ferias/controle`, `/colaboradores`, `/comunicacoes`.
Todos devem barrar. Se algum abrir, **avise imediatamente** — é o requisito
número um do projeto.

### B. Gestor (Maxwel)

Faça todo o roteiro A primeiro (gestor também tira férias), depois:

**B1. Fila de aprovação.** Vá em Aprovações. Você deve ver só as solicitações
de quem reporta a você. A análise automática aparece junto? Ela ajuda a decidir
ou só ocupa espaço?

**B2. Decidir.** Aprove uma e reprove outra, com justificativa. Depois de
aprovar, confira se apareceu prazo de pagamento.

**B3. Vencimento de férias.** Abra Vencimento de férias. Essa tela responde
"quem eu preciso mandar tirar férias antes que vire prejuízo?". Responde
mesmo? A ordem das linhas faz sentido?

**B4. Painel de formulários.** Veja o placar de respostas da sua equipe.

**B5. Barreiras.** Tente abrir `/comunicacoes`, `/ferias/controle` e
`/colaboradores`. Devem barrar — gestor não é RH.

### C. RH (admin master)

Faça A e B primeiro, depois:

**C1. Cadastro.** Cadastre uma pessoa nova em Colaboradores. Teste o CEP (deve
preencher o endereço sozinho), um CPF inválido, e a marcação de região
metropolitana de Curitiba.

**C2. Dados sensíveis.** Fora da tela de edição, CPF e RG devem aparecer
mascarados. Confira em listagens, no calendário e no CSV.

**C3. Controle de férias.** Abra Controle de férias. Registre um recibo, um
pagamento e marque um lote como repassado à Senior. Baixe os dois CSVs e abra
no Excel — acentuação e colunas saíram certas?

**C4. Comunicações.** Abra Comunicações. Desligue o WhatsApp de um tipo, use o
botão "testar" e confira que nada saiu. Ligue de novo. A tela deixa claro que a
notificação **dentro** da intranet nunca é desligada?

**C5. Avisos.** Publique um aviso para um setor específico e confira que só
quem devia recebeu.

**C6. Formulários.** Crie um formulário, escolha a audiência e acompanhe o
placar.

**C7. Aprovação em duas mãos.** Aprove como RH uma solicitação que o gestor
ainda não aprovou. Ela **não** pode ficar aprovada só com a sua assinatura.

---

## Limitações conhecidas — não reporte como bug

Estas são decisões de produto, não falhas:

- **E-mail não envia.** Nesta entrega o WhatsApp faz o papel do e-mail. O canal
  de e-mail aparece mapeado em Comunicações, marcado como "em breve".
- **DM do Discord não envia.** Depende de um bot; ficou no roadmap.
- **WhatsApp só sai com telefone cadastrado.** Os telefones de vocês estão em
  branco de propósito — número inventado que por acaso exista receberia
  mensagem de verdade. O RH preenche pela tela de Colaboradores quando for
  testar.
- **Recibo de férias não tem webhook.** Foi deixado de fora nesta rodada.
- **Acesso da Senior (contabilidade) não existe.** O que entrega valor agora é
  o CSV que o RH baixa em Controle de férias.
- **Uma passada de lembretes por dia.** Limite do plano gratuito da Vercel. As
  telas têm botões de disparo manual.
- **Todo mundo é fictício menos vocês.** Nomes, CPFs, endereços e filiação do
  seed são inventados. Os dados de vocês, tirando nome e e-mail, também são
  preenchimento.

---

## Aviso importante

**Não rode `npm run test:all` enquanto o time estiver testando.** O comando
termina recriando o banco de demonstração e apaga a tabela de usuários — as
senhas voltam para as da tabela acima e o que vocês criaram some. Se acontecer,
`npm run db:equipe` recadastra os seis acessos.
