"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { differenceInCalendarDays, format } from "date-fns";
import { Send } from "lucide-react";

import {
  submitVacationRequestAction,
  type RequestState,
} from "../actions";

function toISO(date: Date | null): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

export function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(
    submitVacationRequestAction,
    {},
  );

  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);

  const days =
    start && end && end >= start ? differenceInCalendarDays(end, start) + 1 : null;

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
      {/* Os pickers são controlados; os hidden carregam o valor em ISO. */}
      <input type="hidden" name="startDate" value={toISO(start)} />
      <input type="hidden" name="endDate" value={toISO(end)} />

      <Stack spacing={2.5}>
        {state.error && <Alert severity="error">{state.error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Início das férias"
              value={start}
              onChange={setStart}
              disablePast
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true, required: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Término das férias"
              value={end}
              onChange={setEnd}
              disablePast
              minDate={start ?? undefined}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true, required: true } }}
            />
          </Grid>
        </Grid>

        {days !== null && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Total: <strong>{days}</strong> dia(s) corridos.
          </Typography>
        )}

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
            disabled={pending || !start || !end}
            startIcon={<Send size={18} />}
          >
            {pending ? "Analisando…" : "Enviar solicitação"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
