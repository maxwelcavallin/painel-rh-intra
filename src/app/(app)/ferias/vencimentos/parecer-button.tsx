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
import { RefreshCw, Sparkles, TriangleAlert, X } from "lucide-react";

import { gerarParecerAction, type ParecerState } from "./actions";

const RISCO = {
  alto: { label: "Risco alto", color: "error" as const },
  medio: { label: "Risco médio", color: "warning" as const },
  baixo: { label: "Risco baixo", color: "success" as const },
};

export function ParecerButton() {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<ParecerState | null>(null);
  const [pendente, iniciar] = useTransition();

  function gerar() {
    iniciar(async () => setEstado(await gerarParecerAction()));
  }

  function abrir() {
    setAberto(true);
    // Só gera na primeira abertura: reabrir para reler não gasta chamada nova.
    if (!estado) gerar();
  }

  return (
    <>
      <Button
        variant="outlined"
        onClick={abrir}
        startIcon={<Sparkles size={17} />}
        sx={{ whiteSpace: "nowrap" }}
      >
        Gerar parecer
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
            {estado?.ok && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {estado.fatos.escopo} · {estado.fatos.totalPessoas} pessoa(s)
              </Typography>
            )}
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
                Cruzando prazos, saldos e a agenda dos próximos meses…
              </Typography>
            </Stack>
          )}

          {!pendente && estado && !estado.ok && (
            <Alert severity="error">{estado.error}</Alert>
          )}

          {!pendente && estado?.ok && (
            <Stack spacing={2.5}>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                <Chip
                  size="small"
                  color={RISCO[estado.parecer.risco].color}
                  label={RISCO[estado.parecer.risco].label}
                />
                {estado.fatos.vencidas > 0 && (
                  <Chip size="small" color="error" variant="outlined" label={`${estado.fatos.vencidas} vencida(s)`} />
                )}
                {estado.fatos.criticas > 0 && (
                  <Chip size="small" color="error" variant="outlined" label={`${estado.fatos.criticas} crítica(s)`} />
                )}
                {estado.fatos.atencao > 0 && (
                  <Chip size="small" color="warning" variant="outlined" label={`${estado.fatos.atencao} em atenção`} />
                )}
                {estado.fatos.diasEmRiscoDeDobra > 0 && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${estado.fatos.diasEmRiscoDeDobra} dia(s) em risco de dobra`}
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
                    Por onde começar
                  </Typography>
                  <Stack spacing={1.5}>
                    {estado.parecer.acoes.map((a, i) => (
                      <Box key={i}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: "flex-start" }}
                        >
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            <Box component="span" sx={{ color: "text.secondary", mr: 0.75 }}>
                              {i + 1}.
                            </Box>
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
                        {a.quem.length > 0 && (
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary", pl: 2.5 }}
                          >
                            {a.quem.join(", ")}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {estado.fatos.concentracaoPorMes.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Agenda dos próximos meses
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    {estado.fatos.concentracaoPorMes.map((m) => (
                      <Chip
                        key={m.mes}
                        size="small"
                        variant="outlined"
                        color={m.pessoas.length >= 3 ? "warning" : "default"}
                        label={`${m.mes}: ${m.pessoas.length}`}
                        title={m.pessoas.join(", ")}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider />

              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary", flex: 1 }}>
                  {estado.parecer.fromModel
                    ? "Parecer redigido por IA a partir de números apurados pelo sistema. Prazos e saldos são calculados em código, não pelo modelo — confira antes de comunicar."
                    : "IA indisponível no momento: este parecer foi montado direto dos números apurados pelo sistema."}
                </Typography>
                <Button
                  size="small"
                  onClick={gerar}
                  startIcon={<RefreshCw size={14} />}
                  sx={{ flex: "none" }}
                >
                  Gerar de novo
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
