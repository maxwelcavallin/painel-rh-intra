"use client";

import { useActionState, useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { MessageCircle, Megaphone, Send, Users } from "lucide-react";

import {
  previewAudienceAction,
  sendBroadcastAction,
  type BroadcastState,
} from "./actions";

type AudienceType = "all" | "sector" | "role" | "user" | "location";

export function BroadcastForm({
  sectors,
  people,
}: {
  sectors: string[];
  people: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<BroadcastState, FormData>(
    sendBroadcastAction,
    {},
  );

  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [audienceValue, setAudienceValue] = useState("");
  const [discord, setDiscord] = useState(true);
  const [whatsapp, setWhatsapp] = useState(true);

  const [preview, setPreview] = useState<{ count: number; names: string[] } | null>(
    null,
  );
  const [previewing, startPreview] = useTransition();

  function checkAudience() {
    startPreview(async () => {
      const result = await previewAudienceAction({
        type: audienceType,
        value: audienceType === "all" ? null : audienceValue || null,
      });
      setPreview(result);
    });
  }

  // Trocar a audiência invalida a prévia — não deixar número velho na tela.
  function changeAudienceType(value: AudienceType) {
    setAudienceType(value);
    setAudienceValue(value === "location" ? "rmc" : "");
    setPreview(null);
  }

  if (state.result) {
    const { recipients, sent, failed, skipped } = state.result;
    return (
      <Alert severity={failed > 0 ? "warning" : "success"}>
        <AlertTitle>Aviso enviado</AlertTitle>
        <Stack spacing={0.5}>
          <Typography variant="body2">
            {recipients} destinatário(s) na audiência.
          </Typography>
          <Typography variant="body2">
            {sent} entrega(s) com sucesso
            {failed > 0 && `, ${failed} com falha`}
            {skipped > 0 && `, ${skipped} ignorada(s)`}.
          </Typography>
          {skipped > 0 && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Entregas ignoradas costumam ser gente sem telefone no cadastro, ou
              canal sem webhook configurado. O detalhe está no histórico.
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button href="/avisos" variant="contained" size="small">
            Ver histórico
          </Button>
          <Button href="/avisos/novo" size="small">
            Enviar outro
          </Button>
        </Stack>
      </Alert>
    );
  }

  return (
    <Box component="form" action={action}>
      <input type="hidden" name="audienceValue" value={audienceValue} />

      <Stack spacing={2.5}>
        {state.error && <Alert severity="error">{state.error}</Alert>}

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Typography sx={{ fontWeight: 600 }}>Conteúdo</Typography>
              <Divider />
              <TextField
                name="title"
                label="Título"
                required
                fullWidth
                placeholder="Ex.: Recesso de fim de ano"
              />
              <TextField
                name="body"
                label="Mensagem"
                required
                fullWidth
                multiline
                minRows={5}
                helperText="Vai igual para todos os canais escolhidos."
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Typography sx={{ fontWeight: 600 }}>Audiência</Typography>
              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    name="audienceType"
                    label="Enviar para"
                    select
                    fullWidth
                    value={audienceType}
                    onChange={(e) =>
                      changeAudienceType(e.target.value as AudienceType)
                    }
                  >
                    <MenuItem value="all">Todos os colaboradores</MenuItem>
                    <MenuItem value="sector">Um setor</MenuItem>
                    <MenuItem value="role">Um papel</MenuItem>
                    <MenuItem value="location">Por localização</MenuItem>
                    <MenuItem value="user">Uma pessoa</MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  {audienceType === "sector" && (
                    <TextField
                      label="Setor"
                      select
                      fullWidth
                      value={audienceValue}
                      onChange={(e) => {
                        setAudienceValue(e.target.value);
                        setPreview(null);
                      }}
                    >
                      {sectors.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}

                  {audienceType === "role" && (
                    <TextField
                      label="Papel"
                      select
                      fullWidth
                      value={audienceValue}
                      onChange={(e) => {
                        setAudienceValue(e.target.value);
                        setPreview(null);
                      }}
                    >
                      <MenuItem value="user">Colaboradores</MenuItem>
                      <MenuItem value="gestor">Gestores</MenuItem>
                      <MenuItem value="admin">RH</MenuItem>
                    </TextField>
                  )}

                  {audienceType === "location" && (
                    <TextField
                      label="Localização"
                      select
                      fullWidth
                      value={audienceValue}
                      onChange={(e) => {
                        setAudienceValue(e.target.value);
                        setPreview(null);
                      }}
                      helperText="Usa o cálculo de RMC do cadastro"
                    >
                      <MenuItem value="rmc">
                        Região Metropolitana de Curitiba
                      </MenuItem>
                      <MenuItem value="fora_rmc">Fora da RMC</MenuItem>
                    </TextField>
                  )}

                  {audienceType === "user" && (
                    <TextField
                      label="Pessoa"
                      select
                      fullWidth
                      value={audienceValue}
                      onChange={(e) => {
                        setAudienceValue(e.target.value);
                        setPreview(null);
                      }}
                    >
                      {people.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 2 }}>
                  <Button
                    onClick={checkAudience}
                    disabled={previewing}
                    startIcon={<Users size={16} />}
                    sx={{ mt: 1 }}
                  >
                    {previewing ? "Conferindo…" : "Conferir"}
                  </Button>
                </Grid>
              </Grid>

              {preview && (
                <Alert severity={preview.count === 0 ? "warning" : "info"}>
                  <strong>{preview.count}</strong> colaborador(es) ativo(s) vão
                  receber
                  {preview.names.length > 0 && `: ${preview.names.join(", ")}`}
                  {preview.count > preview.names.length && " e outros…"}
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 600 }}>Canais</Typography>
              <Divider />

              <FormControlLabel
                control={
                  <Checkbox
                    name="channelDiscord"
                    checked={discord}
                    onChange={(e) => setDiscord(e.target.checked)}
                  />
                }
                label={
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Megaphone size={16} />
                    <span>Discord — publica no canal geral</span>
                  </Stack>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="channelWhatsapp"
                    checked={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.checked)}
                  />
                }
                label={
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <MessageCircle size={16} />
                    <span>WhatsApp — um envio por pessoa (via Zaia)</span>
                  </Stack>
                }
              />

              <Alert severity="info" icon={false}>
                A notificação dentro da intranet é sempre criada, independente dos
                canais marcados — ela não depende de serviço externo.
              </Alert>

              {!discord && !whatsapp && (
                <Chip
                  label="Sem canal externo: o aviso só aparecerá dentro da intranet"
                  color="warning"
                  size="small"
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending}
            startIcon={<Send size={18} />}
          >
            {pending ? "Enviando…" : "Enviar aviso"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
