import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireSession } from "@/lib/dal";
import { getCalendarData } from "@/server/calendar";

import { YearCalendar } from "./year-calendar";

export const metadata: Metadata = { title: "Calendário" };

export default async function CalendarioPage() {
  // Qualquer colaborador logado — é informação de convivência.
  await requireSession();

  const year = new Date().getFullYear();
  const { vacations, holidays, birthdays, events } = await getCalendarData(year);

  return (
    // Mais largo que as outras telas: as faixas de férias precisam de coluna
    // suficiente para o nome caber sem virar reticências.
    <Stack spacing={3} sx={{ maxWidth: 1080 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Calendário
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Férias aprovadas, feriados nacionais/PR/Curitiba, aniversários e
          eventos institucionais.
        </Typography>
      </Stack>

      {vacations.length === 0 && (
        <Alert severity="info">
          Nenhuma férias aprovada em {year} ainda. Feriados e aniversários já
          aparecem abaixo.
        </Alert>
      )}

      <YearCalendar
        year={year}
        vacations={vacations}
        holidays={holidays}
        birthdays={birthdays}
        events={events}
      />
    </Stack>
  );
}
