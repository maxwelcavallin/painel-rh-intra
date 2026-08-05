import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/dal";
import { resolveAudience } from "@/server/audience";
import { getForm, getResponses } from "@/server/forms";

import { ResponseForm } from "./response-form";

export const metadata: Metadata = { title: "Responder formulário" };

export default async function ResponderFormularioPage({
  params,
}: PageProps<"/formularios/[id]">) {
  const user = await requireSession();
  const { id } = await params;

  const form = await getForm(id);
  if (!form) notFound();

  // Quem não está na audiência não vê o formulário — checado aqui, junto do dado.
  const audience = await resolveAudience({
    type: form.audienceType,
    value: form.audienceValue,
  });
  if (!audience.some((a) => a.id === user.id)) {
    return (
      <Alert severity="warning" sx={{ maxWidth: 700 }}>
        Este formulário não foi direcionado a você.
      </Alert>
    );
  }

  const responses = await getResponses(id);
  const mine = responses.find((r) => r.userId === user.id);

  return (
    <Stack spacing={3} sx={{ maxWidth: 700 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {form.title}
        </Typography>
        {form.description && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {form.description}
          </Typography>
        )}
      </Stack>

      {form.closedAt ? (
        <Alert severity="info">
          Este formulário foi encerrado e não aceita mais respostas.
        </Alert>
      ) : (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <ResponseForm
              formId={form.id}
              questions={form.questions}
              initialAnswers={(mine?.answers as Record<string, unknown>) ?? {}}
              alreadyAnswered={Boolean(mine)}
            />
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
