"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { Check, Send } from "lucide-react";

import type { FormQuestion } from "@/db/schema";

import { submitResponseAction, type AnswerState } from "../actions";

export function ResponseForm({
  formId,
  questions,
  initialAnswers,
  alreadyAnswered,
}: {
  formId: string;
  questions: FormQuestion[];
  initialAnswers: Record<string, unknown>;
  alreadyAnswered: boolean;
}) {
  const [state, action, pending] = useActionState<AnswerState, FormData>(
    submitResponseAction,
    {},
  );
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);

  const set = (id: string, value: unknown) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  const toggleCheckbox = (id: string, option: string) => {
    const current = Array.isArray(answers[id]) ? (answers[id] as string[]) : [];
    set(
      id,
      current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option],
    );
  };

  if (state.ok) {
    return (
      <Alert severity="success" icon={<Check size={20} />}>
        Resposta registrada. Obrigado!
        <Box sx={{ mt: 2 }}>
          <Button href="/formularios" variant="outlined" size="small">
            Voltar aos formulários
          </Button>
        </Box>
      </Alert>
    );
  }

  return (
    <Box component="form" action={action}>
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      <Stack spacing={3}>
        {state.error && <Alert severity="error">{state.error}</Alert>}

        {alreadyAnswered && (
          <Alert severity="info">
            Você já respondeu este formulário. Enviar de novo substitui a
            resposta anterior.
          </Alert>
        )}

        {questions.map((q, index) => {
          const value = answers[q.id];

          return (
            <Box key={q.id}>
              {q.type === "text" && (
                <TextField
                  label={`${index + 1}. ${q.label}`}
                  required={q.required}
                  fullWidth
                  value={(value as string) ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                />
              )}

              {q.type === "textarea" && (
                <TextField
                  label={`${index + 1}. ${q.label}`}
                  required={q.required}
                  fullWidth
                  multiline
                  minRows={3}
                  value={(value as string) ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                />
              )}

              {q.type === "date" && (
                <TextField
                  label={`${index + 1}. ${q.label}`}
                  type="date"
                  required={q.required}
                  fullWidth
                  value={(value as string) ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}

              {q.type === "select" && (
                <TextField
                  label={`${index + 1}. ${q.label}`}
                  select
                  required={q.required}
                  fullWidth
                  value={(value as string) ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                >
                  {(q.options ?? []).filter(Boolean).map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {q.type === "radio" && (
                <FormControl required={q.required}>
                  <FormLabel>{`${index + 1}. ${q.label}`}</FormLabel>
                  <RadioGroup
                    value={(value as string) ?? ""}
                    onChange={(e) => set(q.id, e.target.value)}
                  >
                    {(q.options ?? []).filter(Boolean).map((o) => (
                      <FormControlLabel
                        key={o}
                        value={o}
                        control={<Radio />}
                        label={o}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )}

              {q.type === "checkbox" && (
                <FormControl required={q.required}>
                  <FormLabel>{`${index + 1}. ${q.label}`}</FormLabel>
                  <FormGroup>
                    {(q.options ?? []).filter(Boolean).map((o) => (
                      <FormControlLabel
                        key={o}
                        control={
                          <Checkbox
                            checked={
                              Array.isArray(value) &&
                              (value as string[]).includes(o)
                            }
                            onChange={() => toggleCheckbox(q.id, o)}
                          />
                        }
                        label={o}
                      />
                    ))}
                  </FormGroup>
                </FormControl>
              )}
            </Box>
          );
        })}

        <Box>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending}
            startIcon={<Send size={18} />}
          >
            {pending ? "Enviando…" : alreadyAnswered ? "Atualizar resposta" : "Enviar resposta"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
