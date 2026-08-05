"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { CalendarClock, Sparkles, TriangleAlert, X } from "lucide-react";

import { gerarParecerAction, type ParecerState } from "./actions";

const RISCO = {
  alto: { label: "Risco alto", color: "error" as const },
  medio: { label: "Risco médio", color: "warning" as const },
  baixo: { label: "Risco baixo", color: "success" as const },
};

export function ParecerButton({
  userId,
  nome,
}: {
  userId: string;
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<ParecerState | null>(null);
  const [pendente, iniciar] = useTransition();

  function abrir() {
    setAberto(true);
    // Só gera na primeira abertura: reabrir para reler não gasta chamada nova.
    if (estado) return;
    iniciar(async () => setEstado(await gerarParecerAction(userId)));
  }

  return (
    <>
      <Button
        size="small"
        variant="text"
        onClick={abrir}
        startIcon={<Sparkles size={15} />}
        sx={{ textTransform: "none", whiteSpace: "nowrap" }}
      >
        Parecer
      </Button>

      <Dialog
        open={aberto}
        onClose={() => setAberto(false)}
        maxWidth="sm"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ pr: 6 }}>
          <Stack spacing={0.5}>
            <Typography component="span" sx={{ fontWeight: 600 }}>
              Parecer de risco e planejamento
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {nome}
            </Typography>
          </Stack>
          <IconButton
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            sx={{ position: "absolute", right: 8, top: 12 }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {pendente && (
            <Stack spacing={1.5} sx={{ alignItems: "center", py: 4 }}>
              <CircularProgress size={26} />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Analisando histórico, saldo e agenda da equipe…
              </Typography>
            </Stack>
          )}

          {!pendente && estado && !estado.ok && (
            <Alert severity="error">{estado.error}</Alert>
          )}

          {!pendente && estado?.ok && (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Chip
                  size="small"
                  color={RISCO[estado.parecer.risco].color}
                  label={RISCO[estado.parecer.risco].label}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${estado.fatos.saldoEmAberto} dia(s) em aberto`}
                />
                {!estado.fatos.deadline.settled && (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<CalendarClock size={13} />}
                    label={`Conceder até ${estado.fatos.deadline.concessiveEnd.split("-").reverse().join("/")}`}
                  />
                )}
              </Stack>

              <Typography variant="body2">{estado.parecer.resumo}</Typography>

              {estado.parecer.riscos.length > 0 && (
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <TriangleAlert size={15} />
                    <Typography variant="subtitle2">O que está em risco</Typography>
                  </Stack>
                  <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                    {estado.parecer.riscos.map((r, i) => (
                      <Typography key={i} component="li" variant="body2">
                        {r}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}

              {estado.parecer.acoes.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    O que fazer
                  </Typography>
                  <Stack spacing={1}>
                    {estado.parecer.acoes.map((a, i) => (
                      <Stack
                        key={i}
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: "flex-start" }}
                      >
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {a.oQue}
                        </Typography>
                        {a.ateQuando && (
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={`até ${a.ateQuando}`}
                            sx={{ flex: "none" }}
                          />
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Admissão em {estado.fatos.admissao.split("-").reverse().join("/")}
                  {estado.fatos.setor && ` · ${estado.fatos.setor}`}
                  {estado.fatos.gestor && ` · gestor: ${estado.fatos.gestor}`}
                  {" · "}
                  {estado.fatos.diasUsufruidos} dia(s) usufruídos em{" "}
                  {estado.fatos.historico.length} solicitação(ões)
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {estado.parecer.fromModel
                    ? "Parecer redigido por IA a partir de números apurados pelo sistema. Os prazos e o saldo são calculados em código, não pelo modelo — confira sempre antes de comunicar."
                    : "IA indisponível no momento: este parecer foi montado direto dos números apurados pelo sistema."}
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
