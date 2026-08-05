import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Check, FileText } from "lucide-react";

import { requireSession } from "@/lib/dal";
import { listFormsForUser } from "@/server/forms";

export const metadata: Metadata = { title: "Formulários" };

export default async function FormulariosPage() {
  const user = await requireSession();
  const forms = await listFormsForUser(user.id);

  const pendentes = forms.filter((f) => !f.respondedAt && !f.closedAt);
  const demais = forms.filter((f) => f.respondedAt || f.closedAt);

  return (
    <Stack spacing={3} sx={{ maxWidth: 800 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Formulários
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {pendentes.length === 0
            ? "Nada pendente por aqui."
            : `${pendentes.length} aguardando sua resposta.`}
        </Typography>
      </Stack>

      {forms.length === 0 && (
        <Alert severity="info">
          Nenhum formulário foi direcionado a você até agora.
        </Alert>
      )}

      {pendentes.map((f) => (
        <Card key={f.id}>
          <CardContent sx={{ p: 3 }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
            >
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{f.title}</Typography>
                {f.description && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {f.description}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Publicado em {f.createdAt.toLocaleDateString("pt-BR")}
                </Typography>
              </Box>
              <Button
                href={`/formularios/${f.id}`}
                variant="contained"
                startIcon={<FileText size={18} />}
              >
                Responder
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}

      {demais.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ color: "text.secondary", mt: 2 }}>
            Já respondidos ou encerrados
          </Typography>
          {demais.map((f) => (
            <Card key={f.id} variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {f.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {f.respondedAt
                        ? `Respondido em ${f.respondedAt.toLocaleDateString("pt-BR")}`
                        : "Encerrado sem sua resposta"}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    {f.respondedAt && (
                      <Chip
                        icon={<Check size={13} />}
                        label="Respondido"
                        color="success"
                        size="small"
                      />
                    )}
                    {f.closedAt && (
                      <Chip label="Encerrado" size="small" variant="outlined" />
                    )}
                    {!f.closedAt && (
                      <Button href={`/formularios/${f.id}`} size="small">
                        Ver / alterar
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </Stack>
  );
}
