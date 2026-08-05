"use client";

import { useActionState, useState } from "react";
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
import { ChevronDown, ChevronUp, Send, Users } from "lucide-react";

import { COMPANY_NOTICE_DAYS, MAX_ABONO_DAYS, MAX_DAYS_PER_PERIOD } from "@/lib/clt";

import { submitVacationRequestAction, type RequestState } from "../actions";

function toISO(date: Date | null): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

export type TeamVacation = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
};

export function RequestForm({ team }: { team: TeamVacation[] }) {
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

  // Quem da equipe já está fora no período escolhido — mostrado ANTES de enviar,
  // que é quando a informação ainda muda a decisão.
  const conflitos =
    start && end
      ? team.filter((t) => overlaps(toISO(start), toISO(end), t.startDate, t.endDate))
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
              onChange={setStart}
              minDate={minStart}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: `Mínimo de ${COMPANY_NOTICE_DAYS} dias de antecedência`,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Término das férias"
              value={end}
              onChange={setEnd}
              minDate={start ?? minStart}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true, required: true } }}
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
            disabled={pending || !start || !end || excede || (abono && abonoDays < 1)}
            startIcon={<Send size={18} />}
          >
            {pending ? "Analisando…" : "Enviar solicitação"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
