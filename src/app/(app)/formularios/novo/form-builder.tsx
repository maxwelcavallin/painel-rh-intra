"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { GripVertical, Plus, Save, Trash2 } from "lucide-react";

import type { FormQuestion } from "@/db/schema";

import { createFormAction, type FormState } from "../actions";

type AudienceType = "all" | "sector" | "role" | "user" | "location";

const TYPE_LABEL: Record<FormQuestion["type"], string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  select: "Lista suspensa",
  radio: "Escolha única",
  checkbox: "Múltipla escolha",
  date: "Data",
};

const NEEDS_OPTIONS = new Set(["select", "radio", "checkbox"]);

function newQuestion(): FormQuestion {
  return {
    // `crypto.randomUUID` no cliente é suficiente: o id só precisa ser único
    // dentro deste formulário, é a chave das respostas no JSON.
    id: crypto.randomUUID(),
    label: "",
    type: "text",
    required: true,
  };
}

export function FormBuilder({
  sectors,
  people,
}: {
  sectors: string[];
  people: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createFormAction,
    {},
  );

  const [questions, setQuestions] = useState<FormQuestion[]>([newQuestion()]);
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [audienceValue, setAudienceValue] = useState("");

  const update = (id: string, patch: Partial<FormQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const remove = (id: string) =>
    setQuestions((qs) => (qs.length === 1 ? qs : qs.filter((q) => q.id !== id)));

  return (
    <Box component="form" action={action}>
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      <input type="hidden" name="audienceValue" value={audienceValue} />

      <Stack spacing={2.5}>
        {state.error && <Alert severity="error">{state.error}</Alert>}

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Typography sx={{ fontWeight: 600 }}>Identificação</Typography>
              <Divider />
              <TextField
                name="title"
                label="Título do formulário"
                required
                fullWidth
                placeholder="Ex.: Preferência de data para a confraternização"
              />
              <TextField
                name="description"
                label="Descrição (opcional)"
                fullWidth
                multiline
                minRows={2}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  Perguntas ({questions.length})
                </Typography>
                <Button
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
                >
                  Adicionar
                </Button>
              </Stack>
              <Divider />

              {questions.map((q, index) => (
                <Card key={q.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <GripVertical size={16} opacity={0.4} />
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", flex: 1 }}
                        >
                          Pergunta {index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => remove(q.id)}
                          disabled={questions.length === 1}
                          aria-label="Remover pergunta"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Stack>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 7 }}>
                          <TextField
                            label="Enunciado"
                            fullWidth
                            value={q.label}
                            onChange={(e) => update(q.id, { label: e.target.value })}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                          <TextField
                            label="Tipo"
                            select
                            fullWidth
                            value={q.type}
                            onChange={(e) =>
                              update(q.id, {
                                type: e.target.value as FormQuestion["type"],
                                options: NEEDS_OPTIONS.has(e.target.value)
                                  ? (q.options ?? ["", ""])
                                  : undefined,
                              })
                            }
                          >
                            {Object.entries(TYPE_LABEL).map(([value, label]) => (
                              <MenuItem key={value} value={value}>
                                {label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={q.required}
                                onChange={(e) =>
                                  update(q.id, { required: e.target.checked })
                                }
                              />
                            }
                            label="Obrigatória"
                            sx={{ mt: 1 }}
                          />
                        </Grid>

                        {NEEDS_OPTIONS.has(q.type) && (
                          <Grid size={12}>
                            <TextField
                              label="Opções (uma por linha)"
                              fullWidth
                              multiline
                              minRows={3}
                              value={(q.options ?? []).join("\n")}
                              onChange={(e) =>
                                update(q.id, {
                                  options: e.target.value.split("\n"),
                                })
                              }
                              helperText="Mínimo de 2 opções"
                            />
                          </Grid>
                        )}
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Typography sx={{ fontWeight: 600 }}>Audiência e prazo</Typography>
              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    name="audienceType"
                    label="Enviar para"
                    select
                    fullWidth
                    value={audienceType}
                    onChange={(e) => {
                      const v = e.target.value as AudienceType;
                      setAudienceType(v);
                      setAudienceValue(v === "location" ? "rmc" : "");
                    }}
                  >
                    <MenuItem value="all">Todos os colaboradores</MenuItem>
                    <MenuItem value="sector">Um setor</MenuItem>
                    <MenuItem value="role">Um papel</MenuItem>
                    <MenuItem value="location">Por localização</MenuItem>
                    <MenuItem value="user">Uma pessoa</MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  {audienceType === "sector" && (
                    <TextField
                      label="Setor"
                      select
                      fullWidth
                      value={audienceValue}
                      onChange={(e) => setAudienceValue(e.target.value)}
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
                      onChange={(e) => setAudienceValue(e.target.value)}
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
                      onChange={(e) => setAudienceValue(e.target.value)}
                    >
                      <MenuItem value="rmc">Região Metropolitana de Curitiba</MenuItem>
                      <MenuItem value="fora_rmc">Fora da RMC</MenuItem>
                    </TextField>
                  )}
                  {audienceType === "user" && (
                    <TextField
                      label="Pessoa"
                      select
                      fullWidth
                      value={audienceValue}
                      onChange={(e) => setAudienceValue(e.target.value)}
                    >
                      {people.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    name="reminderAfterHours"
                    label="Cobrar após (horas)"
                    type="number"
                    fullWidth
                    defaultValue={48}
                    slotProps={{ htmlInput: { min: 1 } }}
                    helperText="O gestor recebe um WhatsApp com quem falta"
                  />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending}
            startIcon={<Save size={18} />}
          >
            {pending ? "Publicando…" : "Publicar formulário"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
