"use client";

import { useActionState, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { CalendarClock, ChevronDown, ChevronUp, PartyPopper, Send, Users } from "lucide-react";

import {
  COMPANY_NOTICE_DAYS,
  MAX_ABONO_DAYS,
  MAX_DAYS_PER_PERIOD,
  MIN_ANY_FRACTION,
  vacationStartBlock,
} from "@/lib/clt";
import type { InstitutionalEvent } from "@/db/schema";
import type { Holiday } from "@/server/holidays";

import { submitVacationRequestAction, type RequestState } from "../actions";

function toISO(date: Date | null): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

function formatBR(iso: string) {
  return iso.split("-").reverse().join("/");
}

export type TeamVacation = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
};

export function RequestForm({
  team,
  eventos,
  feriados,
}: {
  team: TeamVacation[];
  eventos: InstitutionalEvent[];
  feriados: Holiday[];
}) {
  const [state, action, pending] = useActionState<RequestState, FormData>(
    submitVacationRequestAction,
    {},
  );

  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [abono, setAbono] = useState(false);
  const [abonoDays, setAbonoDays] = useState(0);
  const [advance13th, setAdvance13th] = useState(false);
  const [maisOpcoes, setMaisOpcoes] = useState(false);

  const days =
    start && end && end >= start ? differenceInCalendarDays(end, start) + 1 : null;

  // A política interna pede 40 dias; a data mínima do seletor já reflete isso.
  const minStart = addDays(new Date(), COMPANY_NOTICE_DAYS);

  const datasDeFeriado = useMemo(
    () => new Set(feriados.map((f) => f.date)),
    [feriados],
  );

  /**
   * Trava do calendário: o mesmo predicado que o servidor usa para reprovar
   * (`vacationStartBlock`) decide aqui quais dias sequer aparecem clicáveis.
   *
   * Antes o formulário deixava escolher qualquer dia e a reprovação vinha
   * depois do envio — a pessoa descobria a regra errando. Vindo da mesma
   * função, calendário e análise não têm como divergir.
   */
  const inicioBloqueado = (date: Date) =>
    vacationStartBlock(format(date, "yyyy-MM-dd"), datasDeFeriado) !== null;

  /**
   * O término é derivado do início: nunca menos que a fração mínima da CLT,
   * nunca mais que os 30 dias do período aquisitivo. Não existe férias de 1 dia,
   * então o seletor não oferece essa data.
   */
  const minEnd = start ? addDays(start, MIN_ANY_FRACTION - 1) : minStart;
  const maxEnd = start ? addDays(start, MAX_DAYS_PER_PERIOD - 1) : undefined;

  // Mexer no início pode invalidar um término já escolhido. Limpar é melhor do
  // que deixar na tela uma data que o seletor já não aceitaria.
  function escolherInicio(date: Date | null) {
    setStart(date);
    if (!date || !end) return;
    const novoMin = addDays(date, MIN_ANY_FRACTION - 1);
    const novoMax = addDays(date, MAX_DAYS_PER_PERIOD - 1);
    if (end < novoMin || end > novoMax) setEnd(null);
  }

  // Feriados dentro do período escolhido. Não impedem nada e não esticam as
  // férias — os dias são corridos —, mas é a informação que faz a pessoa
  // reconsiderar a data enquanto ela ainda pode mudar.
  const feriadosNoPeriodo =
    start && end
      ? feriados.filter((f) => f.date >= toISO(start) && f.date <= toISO(end))
      : [];

  // Quem da equipe já está fora no período escolhido — mostrado ANTES de enviar,
  // que é quando a informação ainda muda a decisão.
  const conflitos =
    start && end
      ? team.filter((t) => overlaps(toISO(start), toISO(end), t.startDate, t.endDate))
      : [];

  // Períodos que a empresa marcou como críticos. Mesma lógica de sobreposição
  // da equipe, e mesmo efeito: informa, não trava o envio.
  const eventosNoPeriodo =
    start && end
      ? eventos.filter((e) => overlaps(toISO(start), toISO(end), e.startDate, e.endDate))
      : [];

  const total = (days ?? 0) + (abono ? abonoDays : 0);
  const excede = total > MAX_DAYS_PER_PERIOD;

  /**
   * O erro de abono mora dentro do bloco recolhido. Se ele fechasse com o erro
   * lá dentro, o botão de enviar ficaria desabilitado sem nada na tela
   * explicando por quê — dá para chegar nesse estado marcando o abono, fechando
   * o bloco e depois esticando as datas.
   */
  const painelAberto = maisOpcoes || excede;

  if (state.success) {
    const rejected = state.success.status === "rejected";
    return (
      <Alert severity={rejected ? "error" : "success"}>
        <AlertTitle>
          {rejected
            ? "Solicitação reprovada automaticamente"
            : "Solicitação enviada"}
        </AlertTitle>
        {state.success.reasoning}
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" size="small" href="/ferias/minhas">
            Ver minhas solicitações
          </Button>
        </Box>
      </Alert>
    );
  }

  return (
    <Box component="form" action={action}>
      <input type="hidden" name="startDate" value={toISO(start)} />
      <input type="hidden" name="endDate" value={toISO(end)} />
      <input type="hidden" name="abonoDays" value={abono ? abonoDays : 0} />

      <Stack spacing={2.5}>
        {state.error && <Alert severity="error">{state.error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Início das férias"
              value={start}
              onChange={escolherInicio}
              minDate={minStart}
              shouldDisableDate={inicioBloqueado}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: `A partir de ${COMPANY_NOTICE_DAYS} dias, em dia útil`,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Término das férias"
              value={end}
              onChange={setEnd}
              minDate={minEnd}
              maxDate={maxEnd}
              disabled={!start}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: start
                    ? `De ${MIN_ANY_FRACTION} a ${MAX_DAYS_PER_PERIOD} dias corridos`
                    : "Escolha o início primeiro",
                },
              }}
            />
          </Grid>
        </Grid>

        {days !== null && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Gozo: <strong>{days}</strong> dia(s) corridos
            {abono && abonoDays > 0 && (
              <>
                {" "}
                · Abono: <strong>{abonoDays}</strong> · Total do período:{" "}
                <strong>{total}</strong> de {MAX_DAYS_PER_PERIOD}
              </>
            )}
          </Typography>
        )}

        {feriadosNoPeriodo.length > 0 && (
          <Alert severity="info" icon={<PartyPopper size={18} />}>
            <AlertTitle>
              {feriadosNoPeriodo.length === 1
                ? "Cai 1 feriado dentro do período"
                : `Caem ${feriadosNoPeriodo.length} feriados dentro do período`}
            </AlertTitle>
            <Stack spacing={0.5}>
              {feriadosNoPeriodo.map((f) => (
                <Typography key={f.date} variant="body2">
                  {formatBR(f.date)} — {f.name} ({f.scope}
                  {f.optional ? ", ponto facultativo" : ""})
                </Typography>
              ))}
            </Stack>
            <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
              Férias são contadas em dias corridos, então o feriado não estende o
              período nem devolve dias. Se quiser aproveitá-lo como folga, vale
              escolher outra data.
            </Typography>
          </Alert>
        )}

        {eventosNoPeriodo.length > 0 && (
          <Alert severity="warning" icon={<CalendarClock size={18} />}>
            <AlertTitle>
              {eventosNoPeriodo.length === 1
                ? "Esse período tem um evento da empresa"
                : "Esse período tem eventos da empresa"}
            </AlertTitle>
            <Stack spacing={0.5}>
              {eventosNoPeriodo.map((e) => (
                <Typography key={e.id} variant="body2">
                  {e.title} — {e.startDate.split("-").reverse().join("/")} a{" "}
                  {e.endDate.split("-").reverse().join("/")}
                  {e.sector && ` (${e.sector})`}
                </Typography>
              ))}
            </Stack>
            <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
              Não impede o pedido — mas é um período em que a empresa costuma
              precisar de todo mundo, então a aprovação pode demorar mais ou vir
              com contraproposta de data.
            </Typography>
          </Alert>
        )}

        {conflitos.length > 0 && (
          <Alert severity="warning" icon={<Users size={18} />}>
            <AlertTitle>Sua equipe nesse período</AlertTitle>
            <Stack spacing={0.5}>
              {conflitos.map((c) => (
                <Typography key={c.id} variant="body2">
                  {c.name} — {c.startDate.split("-").reverse().join("/")} a{" "}
                  {c.endDate.split("-").reverse().join("/")}
                  {c.status === "pending" && " (ainda pendente)"}
                </Typography>
              ))}
            </Stack>
            <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
              Não impede o pedido — é só para você e seu gestor avaliarem o
              impacto na operação.
            </Typography>
          </Alert>
        )}

        <Divider />

        {/*
          Abono e antecipação do 13º ficam recolhidos: a maioria das
          solicitações é só "quero tirar férias nestas datas", e duas caixas de
          marcar com parágrafo de lei cada uma faziam o formulário parecer mais
          burocrático do que é. Quem precisa, abre.
        */}
        <Box>
          <Button
            type="button"
            size="small"
            color="inherit"
            onClick={() => setMaisOpcoes(!painelAberto)}
            endIcon={painelAberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            sx={{ textTransform: "none", color: "text.secondary", px: 1, ml: -1 }}
            aria-expanded={painelAberto}
            aria-controls="mais-opcoes"
          >
            Mais opções
          </Button>

          {/* Quem já marcou algo precisa ver isso mesmo com o bloco fechado. */}
          {!painelAberto && (abono || advance13th) && (
            <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: "wrap", gap: 0.75 }}>
              {abono && (
                <Chip size="small" color="primary" variant="outlined" label={`Abono: ${abonoDays} dia(s)`} />
              )}
              {advance13th && (
                <Chip size="small" color="primary" variant="outlined" label="Antecipa o 13º" />
              )}
            </Stack>
          )}

          {/* `unmountOnExit` fica falso de propósito: o checkbox do 13º é
              lido do FormData pelo nome, e desmontado ele sumiria do envio. */}
          <Collapse in={painelAberto} unmountOnExit={false} id="mais-opcoes">
            <Stack spacing={2.5} sx={{ mt: 2 }}>
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={abono}
                      onChange={(e) => {
                        setAbono(e.target.checked);
                        if (!e.target.checked) setAbonoDays(0);
                        else if (abonoDays === 0) setAbonoDays(10);
                      }}
                    />
                  }
                  label="Quero converter parte das férias em abono pecuniário"
                />
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 4 }}>
                  Art. 143 da CLT: até {MAX_ABONO_DAYS} dias (um terço do período) podem
                  ser vendidos. Os dias vendidos saem do mesmo saldo do gozo.
                </Typography>

                {abono && (
                  <Box sx={{ ml: 4, mt: 1.5, maxWidth: 220 }}>
                    <TextField
                      label="Dias de abono"
                      type="number"
                      size="small"
                      fullWidth
                      value={abonoDays}
                      onChange={(e) => setAbonoDays(Number(e.target.value))}
                      slotProps={{ htmlInput: { min: 1, max: MAX_ABONO_DAYS } }}
                      error={abonoDays > MAX_ABONO_DAYS || excede}
                      helperText={
                        abonoDays > MAX_ABONO_DAYS
                          ? `Máximo de ${MAX_ABONO_DAYS} dias`
                          : excede
                            ? `Gozo + abono somam ${total} e passam de ${MAX_DAYS_PER_PERIOD}`
                            : " "
                      }
                    />
                  </Box>
                )}
              </Box>

              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="advance13th"
                      checked={advance13th}
                      onChange={(e) => setAdvance13th(e.target.checked)}
                    />
                  }
                  label="Quero antecipar a 1ª parcela do 13º junto com as férias"
                />
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 4 }}>
                  Precisa ser pedido junto com as férias — depois não dá para incluir
                  nesta folha.
                </Typography>
              </Box>
            </Stack>
          </Collapse>
        </Box>

        <TextField
          name="notes"
          label="Observações (opcional)"
          multiline
          minRows={3}
          fullWidth
          disabled={pending}
          helperText="Contexto que ajude o RH e seu gestor a avaliar."
        />

        <Box>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={
              pending ||
              !start ||
              !end ||
              // O seletor já impede, mas a trava não pode depender só dele.
              (days ?? 0) < MIN_ANY_FRACTION ||
              excede ||
              (abono && abonoDays < 1)
            }
            startIcon={<Send size={18} />}
          >
            {pending ? "Analisando…" : "Enviar solicitação"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
