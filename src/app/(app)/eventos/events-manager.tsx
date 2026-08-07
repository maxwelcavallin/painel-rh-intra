"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";

import { formatBR, todayISOBrazil } from "@/lib/clt";
import type { InstitutionalEvent } from "@/db/schema";

import {
  createEventAction,
  deleteEventAction,
  updateEventAction,
  type EventState,
} from "./actions";

/** Já passou, está rolando agora, ou ainda vem. */
function situacao(e: InstitutionalEvent, hoje: string) {
  if (e.endDate < hoje) return { label: "Encerrado", cor: "default" as const };
  if (e.startDate <= hoje) return { label: "Em curso", cor: "warning" as const };
  return { label: "A caminho", cor: "primary" as const };
}

function periodo(e: InstitutionalEvent) {
  return e.startDate === e.endDate
    ? formatBR(e.startDate)
    : `${formatBR(e.startDate)} a ${formatBR(e.endDate)}`;
}

export function EventsManager({
  eventos,
  setores,
}: {
  eventos: InstitutionalEvent[];
  setores: string[];
}) {
  const [editando, setEditando] = useState<InstitutionalEvent | null>(null);
  const [criando, setCriando] = useState(false);
  const [aExcluir, setAExcluir] = useState<InstitutionalEvent | null>(null);
  const [excluindo, iniciarExclusao] = useTransition();
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  // `todayISOBrazil` fixa o fuso em São Paulo, então servidor e cliente chegam
  // à mesma data e a hidratação não diverge — o mesmo motivo pelo qual o
  // calendário usa este helper em vez de `new Date()`.
  const hoje = todayISOBrazil();

  function excluir() {
    if (!aExcluir) return;
    const id = aExcluir.id;
    iniciarExclusao(async () => {
      const r = await deleteEventAction(id);
      if (r.error) setErroExclusao(r.error);
      else setAExcluir(null);
    });
  }

  return (
    <>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {eventos.length} evento(s) cadastrado(s)
        </Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => setCriando(true)}
        >
          Novo evento
        </Button>
      </Stack>

      {eventos.length === 0 && (
        <Alert severity="info" icon={<CalendarClock size={18} />}>
          Nenhum evento cadastrado. Inventário, fechamento contábil, auditoria e
          eventos de cliente são os casos típicos.
        </Alert>
      )}

      <Stack spacing={1.5}>
        {eventos.map((e) => {
          const s = situacao(e, hoje);
          return (
            <Card key={e.id} variant="outlined">
              <CardContent
                sx={{
                  p: 2,
                  "&:last-child": { pb: 2 },
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography sx={{ fontWeight: 600 }}>{e.title}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {periodo(e)}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={e.sector ?? "Empresa inteira"}
                  />
                  <Chip size="small" color={s.cor} label={s.label} />
                </Stack>

                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Editar" arrow>
                    <IconButton
                      size="small"
                      onClick={() => setEditando(e)}
                      aria-label={`Editar ${e.title}`}
                    >
                      <Pencil size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir" arrow>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setErroExclusao(null);
                        setAExcluir(e);
                      }}
                      aria-label={`Excluir ${e.title}`}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {criando && (
        <EventoDialog
          setores={setores}
          aoFechar={() => setCriando(false)}
        />
      )}

      {editando && (
        <EventoDialog
          evento={editando}
          setores={setores}
          aoFechar={() => setEditando(null)}
        />
      )}

      <Dialog open={Boolean(aExcluir)} onClose={() => setAExcluir(null)}>
        <DialogTitle>Excluir evento</DialogTitle>
        <DialogContent>
          {erroExclusao && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroExclusao}
            </Alert>
          )}
          <Typography variant="body2">
            Excluir <strong>{aExcluir?.title}</strong>? Quem for pedir férias
            nesse período deixa de ser avisado.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAExcluir(null)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button color="error" onClick={excluir} disabled={excluindo}>
            {excluindo ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Mesmo diálogo para criar e editar — o que muda é a action e o título. */
function EventoDialog({
  evento,
  setores,
  aoFechar,
}: {
  evento?: InstitutionalEvent;
  setores: string[];
  aoFechar: () => void;
}) {
  const edicao = Boolean(evento);
  const [state, action, pending] = useActionState<EventState, FormData>(
    edicao ? updateEventAction : createEventAction,
    {},
  );

  const [title, setTitle] = useState(evento?.title ?? "");
  const [startDate, setStartDate] = useState(evento?.startDate ?? "");
  const [endDate, setEndDate] = useState(evento?.endDate ?? "");
  const [sector, setSector] = useState(evento?.sector ?? "");

  // Fecha só quando a action confirma — fechar no clique esconderia o erro.
  useEffect(() => {
    if (state.ok) aoFechar();
  }, [state.ok, aoFechar]);

  return (
    <Dialog open onClose={aoFechar} maxWidth="sm" fullWidth>
      <Box component="form" action={action}>
        {edicao && <input type="hidden" name="id" value={evento!.id} />}

        <DialogTitle>{edicao ? "Editar evento" : "Novo evento"}</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            {state.error && <Alert severity="error">{state.error}</Alert>}

            <TextField
              name="title"
              label="Nome do evento"
              required
              fullWidth
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Inventário anual"
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  name="startDate"
                  label="Início"
                  type="date"
                  required
                  fullWidth
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  name="endDate"
                  label="Término"
                  type="date"
                  required
                  fullWidth
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="Mesmo dia do início para evento de um dia só"
                />
              </Grid>
            </Grid>

            <TextField
              name="sector"
              label="Abrangência"
              select
              fullWidth
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              helperText="Quem é avisado ao pedir férias nesse período"
            >
              <MenuItem value="">Empresa inteira</MenuItem>
              {setores.map((s) => (
                <MenuItem key={s} value={s}>
                  Somente {s}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={aoFechar} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
