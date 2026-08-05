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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { RefreshCw, Sparkles, TriangleAlert, X } from "lucide-react";

import {
  gerarParecerGeralAction,
  gerarParecerPessoaAction,
  type ParecerGeralState,
  type ParecerPessoaState,
} from "./actions";
import type { Parecer } from "@/server/parecer";

const RISCO = {
  alto: { label: "Risco alto", color: "error" as const },
  medio: { label: "Risco médio", color: "warning" as const },
  baixo: { label: "Risco baixo", color: "success" as const },
};

/** Chips de contexto — variam entre o parecer da carteira e o de uma pessoa. */
type Marcador = { label: string; cor?: "error" | "warning" | "default" };

/**
 * O diálogo é o mesmo para os dois pareceres.
 *
 * O que muda é o cabeçalho, os marcadores e o rodapé — passados de fora. Dois
 * componentes de diálogo quase iguais divergiriam no primeiro ajuste.
 */
function DialogoParecer({
  aberto,
  aoFechar,
  subtitulo,
  pendente,
  erro,
  parecer,
  marcadores,
  rodape,
  regerar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  subtitulo: string | null;
  pendente: boolean;
  erro: string | null;
  parecer: Parecer | null;
  marcadores: Marcador[];
  rodape: React.ReactNode;
  regerar: () => void;
}) {
  return (
    <Dialog open={aberto} onClose={aoFechar} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack spacing={0.5}>
          <Typography component="span" sx={{ fontWeight: 600 }}>
            Parecer de risco e planejamento
          </Typography>
          {subtitulo && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {subtitulo}
            </Typography>
          )}
        </Stack>
        <IconButton
          onClick={aoFechar}
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
              Cruzando histórico, prazos, saldos e a agenda da equipe…
            </Typography>
          </Stack>
        )}

        {!pendente && erro && <Alert severity="error">{erro}</Alert>}

        {!pendente && parecer && (
          <Stack spacing={2.5}>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip
                size="small"
                color={RISCO[parecer.risco].color}
                label={RISCO[parecer.risco].label}
              />
              {marcadores.map((m) => (
                <Chip
                  key={m.label}
                  size="small"
                  variant="outlined"
                  color={m.cor ?? "default"}
                  label={m.label}
                />
              ))}
            </Stack>

            <Typography variant="body2">{parecer.resumo}</Typography>

            {parecer.riscos.length > 0 && (
              <Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                  <TriangleAlert size={15} />
                  <Typography variant="subtitle2">O que está em risco</Typography>
                </Stack>
                <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                  {parecer.riscos.map((r, i) => (
                    <Typography key={i} component="li" variant="body2">
                      {r}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {parecer.acoes.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Por onde começar
                </Typography>
                <Stack spacing={1.5}>
                  {parecer.acoes.map((a, i) => (
                    <Box key={i}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
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
                        <Typography variant="caption" sx={{ color: "text.secondary", pl: 2.5 }}>
                          {a.quem.join(", ")}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {rodape}

            <Divider />

            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary", flex: 1 }}>
                {parecer.fromModel
                  ? "Parecer redigido por IA a partir de números apurados pelo sistema. Prazos e saldos são calculados em código, não pelo modelo — confira antes de comunicar."
                  : "IA indisponível no momento: este parecer foi montado direto dos números apurados pelo sistema."}
              </Typography>
              <Button
                size="small"
                onClick={regerar}
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
  );
}

/** Parecer da carteira inteira — botão no topo da tela. */
export function ParecerGeralButton() {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<ParecerGeralState | null>(null);
  const [pendente, iniciar] = useTransition();

  const gerar = () => iniciar(async () => setEstado(await gerarParecerGeralAction()));

  function abrir() {
    setAberto(true);
    // Só gera na primeira abertura: reabrir para reler não gasta chamada nova.
    if (!estado) gerar();
  }

  const f = estado?.ok ? estado.fatos : null;

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

      <DialogoParecer
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        subtitulo={f ? `${f.escopo} · ${f.totalPessoas} pessoa(s)` : null}
        pendente={pendente}
        erro={estado && !estado.ok ? estado.error : null}
        parecer={estado?.ok ? estado.parecer : null}
        marcadores={
          f
            ? [
                ...(f.vencidas > 0
                  ? [{ label: `${f.vencidas} vencida(s)`, cor: "error" as const }]
                  : []),
                ...(f.criticas > 0
                  ? [{ label: `${f.criticas} crítica(s)`, cor: "error" as const }]
                  : []),
                ...(f.atencao > 0
                  ? [{ label: `${f.atencao} em atenção`, cor: "warning" as const }]
                  : []),
                ...(f.diasEmRiscoDeDobra > 0
                  ? [{ label: `${f.diasEmRiscoDeDobra} dia(s) em risco de dobra` }]
                  : []),
              ]
            : []
        }
        rodape={
          f && f.concentracaoPorMes.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Agenda dos próximos meses
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                {f.concentracaoPorMes.map((m) => (
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
          ) : null
        }
        regerar={gerar}
      />
    </>
  );
}

/** Parecer de uma pessoa — ícone discreto na linha da tabela. */
export function ParecerPessoaButton({
  userId,
  nome,
}: {
  userId: string;
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<ParecerPessoaState | null>(null);
  const [pendente, iniciar] = useTransition();

  const gerar = () =>
    iniciar(async () => setEstado(await gerarParecerPessoaAction(userId)));

  function abrir() {
    setAberto(true);
    if (!estado) gerar();
  }

  const f = estado?.ok ? estado.fatos : null;

  return (
    <>
      <Tooltip title="Gerar parecer individual" arrow>
        <IconButton
          size="small"
          onClick={abrir}
          aria-label={`Gerar parecer individual de ${nome}`}
        >
          <Sparkles size={16} />
        </IconButton>
      </Tooltip>

      <DialogoParecer
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        subtitulo={
          f ? `${f.nome}${f.setor ? ` · ${f.setor}` : ""}` : nome
        }
        pendente={pendente}
        erro={estado && !estado.ok ? estado.error : null}
        parecer={estado?.ok ? estado.parecer : null}
        marcadores={
          f
            ? [
                { label: `${f.saldoEmAberto} dia(s) em aberto` },
                ...(f.ultimaDataParaSolicitar
                  ? [{ label: `Conceder até ${f.prazoDeConcessao}` }]
                  : []),
                ...(f.cancelamentos > 0
                  ? [{ label: `${f.cancelamentos} cancelamento(s)`, cor: "warning" as const }]
                  : []),
              ]
            : []
        }
        rodape={
          f ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Admissão em {f.admissao}
              {f.gestor && ` · gestor: ${f.gestor}`} · {f.diasUsufruidos} dia(s)
              usufruídos em {f.historico.length} solicitação(ões)
            </Typography>
          ) : null
        }
        regerar={gerar}
      />
    </>
  );
}
