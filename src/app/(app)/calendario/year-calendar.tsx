"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { Cake, CalendarDays, Plane } from "lucide-react";

type Vacation = {
  id: string;
  name: string;
  sector: string | null;
  start: string;
  end: string;
  days: number;
};
type Holiday = { date: string; name: string; scope: string };
type Birthday = { id: string; name: string; monthDay: string };

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function YearCalendar({
  year,
  vacations,
  holidays,
  birthdays,
}: {
  year: number;
  vacations: Vacation[];
  holidays: Holiday[];
  birthdays: Birthday[];
}) {
  const [month, setMonth] = useState(new Date().getMonth());

  // Índices por data, montados uma vez — evita varrer as listas por célula.
  const { holidayByDate, vacationsByDate, birthdaysByMonthDay } = useMemo(() => {
    const h = new Map<string, Holiday>();
    for (const item of holidays) h.set(item.date, item);

    const v = new Map<string, Vacation[]>();
    for (const item of vacations) {
      // Preenche cada dia do intervalo, em UTC para não deslocar por fuso.
      const [ys, ms, ds] = item.start.split("-").map(Number);
      const [ye, me, de] = item.end.split("-").map(Number);
      let cursor = Date.UTC(ys, ms - 1, ds);
      const last = Date.UTC(ye, me - 1, de);
      while (cursor <= last) {
        const key = new Date(cursor).toISOString().slice(0, 10);
        v.set(key, [...(v.get(key) ?? []), item]);
        cursor += 86_400_000;
      }
    }

    const b = new Map<string, Birthday[]>();
    for (const item of birthdays) {
      b.set(item.monthDay, [...(b.get(item.monthDay) ?? []), item]);
    }

    return { holidayByDate: h, vacationsByDate: v, birthdaysByMonthDay: b };
  }, [vacations, holidays, birthdays]);

  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthHolidays = holidays.filter(
    (h) => Number(h.date.slice(5, 7)) === month + 1,
  );
  const monthBirthdays = birthdays.filter(
    (b) => Number(b.monthDay.slice(0, 2)) === month + 1,
  );

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        value={month}
        exclusive
        size="small"
        onChange={(_, v) => v !== null && setMonth(v)}
        sx={{ flexWrap: "wrap" }}
      >
        {MONTHS.map((m, i) => (
          <ToggleButton key={m} value={i} sx={{ px: 1.5, textTransform: "none" }}>
            {m.slice(0, 3)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 600 }}>
              {MONTHS[month]} de {year}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 0.75,
              }}
            >
              {WEEKDAYS.map((d, i) => (
                <Typography
                  key={i}
                  variant="caption"
                  sx={{
                    textAlign: "center",
                    fontWeight: 600,
                    color: "text.secondary",
                  }}
                >
                  {d}
                </Typography>
              ))}

              {cells.map((day, index) => {
                if (day === null) return <Box key={`v${index}`} />;

                const date = iso(year, month, day);
                const holiday = holidayByDate.get(date);
                const onVacation = vacationsByDate.get(date) ?? [];
                const cakes = birthdaysByMonthDay.get(date.slice(5)) ?? [];
                const weekend = [0, 6].includes(
                  new Date(Date.UTC(year, month, day)).getUTCDay(),
                );

                const parts = [
                  holiday && `Feriado ${holiday.scope}: ${holiday.name}`,
                  onVacation.length > 0 &&
                    `De férias: ${onVacation.map((v) => v.name).join(", ")}`,
                  cakes.length > 0 &&
                    `Aniversário: ${cakes.map((c) => c.name).join(", ")}`,
                ].filter(Boolean) as string[];

                return (
                  <Tooltip
                    key={date}
                    title={parts.join(" · ")}
                    disableHoverListener={parts.length === 0}
                    arrow
                  >
                    <Box
                      sx={{
                        aspectRatio: "1",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: holiday ? "error.main" : "divider",
                        bgcolor: holiday
                          ? "error.light"
                          : weekend
                            ? "action.hover"
                            : "background.paper",
                        p: 0.5,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        cursor: parts.length > 0 ? "help" : "default",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: holiday ? 700 : 400, lineHeight: 1.2 }}
                      >
                        {day}
                      </Typography>
                      <Stack
                        direction="row"
                        sx={{ gap: 0.25, mt: 0.25, flexWrap: "wrap", justifyContent: "center" }}
                      >
                        {onVacation.slice(0, 3).map((v) => (
                          <Box
                            key={v.id}
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              bgcolor: "primary.main",
                            }}
                          />
                        ))}
                        {cakes.length > 0 && (
                          <Cake size={9} color="var(--mui-palette-secondary-main)" />
                        )}
                      </Stack>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>

            <Divider />

            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
                <Typography variant="caption">Colaborador de férias</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "error.light", border: "1px solid", borderColor: "error.main" }} />
                <Typography variant="caption">Feriado</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Cake size={12} />
                <Typography variant="caption">Aniversário</Typography>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {(monthHolidays.length > 0 || monthBirthdays.length > 0) && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              {monthHolidays.length > 0 && (
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <CalendarDays size={15} />
                    <Typography variant="subtitle2">Feriados do mês</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    {monthHolidays.map((h) => (
                      <Chip
                        key={h.date}
                        size="small"
                        color="error"
                        variant="outlined"
                        label={`${h.date.slice(8)}/${h.date.slice(5, 7)} · ${h.name} (${h.scope})`}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {monthBirthdays.length > 0 && (
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <Cake size={15} />
                    <Typography variant="subtitle2">Aniversariantes</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    {monthBirthdays
                      .sort((a, b) => a.monthDay.localeCompare(b.monthDay))
                      .map((b) => (
                        <Chip
                          key={b.id}
                          size="small"
                          variant="outlined"
                          label={`${b.monthDay.slice(3)} · ${b.name}`}
                        />
                      ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {vacations.length > 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Plane size={16} />
                <Typography sx={{ fontWeight: 600 }}>
                  Férias aprovadas em {year}
                </Typography>
              </Stack>
              <Divider />
              {vacations.map((v) => (
                <Stack
                  key={v.id}
                  direction="row"
                  spacing={2}
                  sx={{ justifyContent: "space-between", flexWrap: "wrap" }}
                >
                  <Typography variant="body2">
                    <strong>{v.name}</strong>
                    {v.sector && (
                      <Box component="span" sx={{ color: "text.secondary" }}>
                        {" "}· {v.sector}
                      </Box>
                    )}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {v.start.split("-").reverse().join("/")} a{" "}
                    {v.end.split("-").reverse().join("/")} · {v.days} dias
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
