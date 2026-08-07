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
import type { Theme } from "@mui/material/styles";
import { Cake, CalendarClock, CalendarDays, Plane } from "lucide-react";

import { todayISOBrazil } from "@/lib/clt";

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
type CalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  sector: string | null;
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Quantas pessoas de férias cabem empilhadas numa célula antes de virar "+N".
 * Três é o que cabe sem a célula esticar demais nem o mês virar rolagem.
 */
const MAX_LANES = 3;

/**
 * Eventos ficam ACIMA das férias e com teto menor.
 *
 * São período da empresa, não de pessoa: quando existem, valem para a célula
 * inteira e precisam ser lidos antes de quem está fora. Dois bastam — inventário
 * e fechamento na mesma semana já é o pior caso real; o que passar disso o RH lê
 * na lista abaixo da grade.
 */
const MAX_EVENT_LANES = 2;

/** Altura fixa da barra. Precisa ser constante ou as faixas desalinham. */
const LANE_H = 19;

/**
 * Cores das faixas, na ordem em que as pistas são preenchidas.
 *
 * Saem da paleta mosaico, que o DS reserva para uso decorativo — nunca para
 * cor de ação. Barra de calendário é informação, não botão, então é o lugar
 * certo dela. Pessoas diferentes ganham tons diferentes só para dar para
 * seguir a faixa com o olho; a cor não carrega significado.
 */
const LANE_COLOR = [
  (t: Theme) => t.palette.primary.main,
  (t: Theme) => t.palette.mosaic[700],
  (t: Theme) => t.palette.secondary.main,
] as const;

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstName(full: string) {
  return full.split(" ")[0];
}

/**
 * Um intervalo qualquer que vira barra na grade. Férias e eventos passam pelo
 * mesmo algoritmo de pistas, cada um na sua faixa de trilhas.
 */
type Faixa = { id: string; start: string; end: string; rotulo: string };

function overlaps(a: Faixa, b: Faixa) {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * Distribui intervalos do mês em pistas horizontais.
 *
 * Sem isso, cada célula empilharia os itens na ordem em que aparecem e o mesmo
 * item pularia de linha ao longo do período — a faixa deixaria de ser legível
 * como um bloco contínuo. Aqui cada intervalo ganha uma pista e fica nela do
 * primeiro ao último dia.
 */
function assignLanes(list: Faixa[]): Map<string, number> {
  const ordered = [...list].sort(
    (a, b) =>
      a.start.localeCompare(b.start) ||
      b.end.localeCompare(a.end) ||
      a.rotulo.localeCompare(b.rotulo),
  );

  const lanes: Faixa[][] = [];
  const result = new Map<string, number>();

  for (const item of ordered) {
    let lane = lanes.findIndex((occupants) => !occupants.some((o) => overlaps(o, item)));
    if (lane === -1) {
      lanes.push([]);
      lane = lanes.length - 1;
    }
    lanes[lane].push(item);
    result.set(item.id, lane);
  }

  return result;
}

export function YearCalendar({
  year,
  vacations,
  holidays,
  birthdays,
  events,
}: {
  year: number;
  vacations: Vacation[];
  holidays: Holiday[];
  birthdays: Birthday[];
  events: CalendarEvent[];
}) {
  const [month, setMonth] = useState(new Date().getMonth());
  const hoje = todayISOBrazil();

  // Índices por data, montados uma vez — evita varrer as listas por célula.
  const { holidayByDate, vacationsByDate, birthdaysByMonthDay, eventsByDate } =
    useMemo(() => {
      const h = new Map<string, Holiday>();
      for (const item of holidays) h.set(item.date, item);

      // Preenche cada dia do intervalo, em UTC para não deslocar por fuso.
      const espalhar = <T,>(
        inicio: string,
        fim: string,
        item: T,
        destino: Map<string, T[]>,
      ) => {
        const [ys, ms, ds] = inicio.split("-").map(Number);
        const [ye, me, de] = fim.split("-").map(Number);
        let cursor = Date.UTC(ys, ms - 1, ds);
        const last = Date.UTC(ye, me - 1, de);
        while (cursor <= last) {
          const key = new Date(cursor).toISOString().slice(0, 10);
          destino.set(key, [...(destino.get(key) ?? []), item]);
          cursor += 86_400_000;
        }
      };

      const v = new Map<string, Vacation[]>();
      for (const item of vacations) espalhar(item.start, item.end, item, v);

      const e = new Map<string, CalendarEvent[]>();
      for (const item of events) espalhar(item.startDate, item.endDate, item, e);

      const b = new Map<string, Birthday[]>();
      for (const item of birthdays) {
        b.set(item.monthDay, [...(b.get(item.monthDay) ?? []), item]);
      }

      return {
        holidayByDate: h,
        vacationsByDate: v,
        birthdaysByMonthDay: b,
        eventsByDate: e,
      };
    }, [vacations, holidays, birthdays, events]);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();

  // Pistas recalculadas por mês: quem não aparece no mês não ocupa espaço.
  const { laneOf, laneCount } = useMemo(() => {
    const primeiro = iso(year, month, 1);
    const ultimo = iso(year, month, daysInMonth);
    const doMes = vacations
      .filter((v) => v.start <= ultimo && v.end >= primeiro)
      .map((v) => ({ id: v.id, start: v.start, end: v.end, rotulo: v.name }));
    const map = assignLanes(doMes);
    return {
      laneOf: map,
      laneCount: Math.min(
        MAX_LANES,
        map.size === 0 ? 0 : Math.max(...map.values()) + 1,
      ),
    };
  }, [vacations, year, month, daysInMonth]);

  const { eventLaneOf, eventLaneCount } = useMemo(() => {
    const primeiro = iso(year, month, 1);
    const ultimo = iso(year, month, daysInMonth);
    const doMes = events
      .filter((e) => e.startDate <= ultimo && e.endDate >= primeiro)
      .map((e) => ({
        id: e.id,
        start: e.startDate,
        end: e.endDate,
        rotulo: e.title,
      }));
    const map = assignLanes(doMes);
    return {
      eventLaneOf: map,
      eventLaneCount: Math.min(
        MAX_EVENT_LANES,
        map.size === 0 ? 0 : Math.max(...map.values()) + 1,
      ),
    };
  }, [events, year, month, daysInMonth]);

  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const primeiroDoMes = iso(year, month, 1);
  const ultimoDoMes = iso(year, month, daysInMonth);

  const monthHolidays = holidays.filter(
    (h) => Number(h.date.slice(5, 7)) === month + 1,
  );
  const monthBirthdays = birthdays.filter(
    (b) => Number(b.monthDay.slice(0, 2)) === month + 1,
  );
  // Um evento pode atravessar meses, então não basta comparar o mês do início:
  // entra se o intervalo encostar em qualquer dia deste mês.
  const monthEvents = events.filter(
    (e) => e.startDate <= ultimoDoMes && e.endDate >= primeiroDoMes,
  );
  const noMes = vacations.filter((v) => laneOf.has(v.id));

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
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "baseline", flexWrap: "wrap" }}
            >
              <Typography sx={{ fontWeight: 600 }}>
                {MONTHS[month]} de {year}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {noMes.length === 0
                  ? "ninguém de férias neste mês"
                  : `${noMes.length} ${noMes.length === 1 ? "pessoa" : "pessoas"} de férias`}
              </Typography>
            </Stack>

            {/*
              A grade tem largura mínima: com sete colunas apertadas o nome não
              cabe e a faixa vira um risco sem sentido. Em tela estreita rola na
              horizontal em vez de espremer.
            */}
            <Box sx={{ overflowX: "auto", mx: { xs: -1, sm: 0 }, px: { xs: 1, sm: 0 } }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 0.5,
                  minWidth: 640,
                }}
              >
                {WEEKDAYS.map((d, i) => (
                  <Typography
                    key={d}
                    variant="caption"
                    sx={{
                      textAlign: "center",
                      fontWeight: 600,
                      color: [0, 6].includes(i) ? "text.disabled" : "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      pb: 0.5,
                    }}
                  >
                    {d}
                  </Typography>
                ))}

                {cells.map((day, index) => {
                  if (day === null) return <Box key={`vazio-${index}`} />;

                  const date = iso(year, month, day);
                  const weekdayIndex = (firstWeekday + day - 1) % 7;
                  const holiday = holidayByDate.get(date);
                  const onVacation = vacationsByDate.get(date) ?? [];
                  const cakes = birthdaysByMonthDay.get(date.slice(5)) ?? [];
                  const noEvento = eventsByDate.get(date) ?? [];
                  const weekend = [0, 6].includes(weekdayIndex);
                  const isToday = date === hoje;

                  // Quem não coube nas pistas visíveis vira contagem no rodapé.
                  const escondidos = onVacation.filter(
                    (v) => (laneOf.get(v.id) ?? 0) >= MAX_LANES,
                  );

                  const detalhe = [
                    noEvento.length > 0 &&
                      `Evento: ${noEvento
                        .map((e) => e.title + (e.sector ? ` (${e.sector})` : ""))
                        .join(", ")}`,
                    holiday && `Feriado ${holiday.scope}: ${holiday.name}`,
                    onVacation.length > 0 &&
                      `De férias: ${onVacation.map((v) => v.name).join(", ")}`,
                    cakes.length > 0 &&
                      `Aniversário: ${cakes.map((c) => c.name).join(", ")}`,
                  ].filter(Boolean) as string[];

                  return (
                    <Tooltip
                      key={date}
                      title={detalhe.join(" · ")}
                      disableHoverListener={detalhe.length === 0}
                      arrow
                    >
                      <Box
                        sx={{
                          minHeight:
                            44 + (laneCount + eventLaneCount) * LANE_H,
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
                          gap: "2px",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            minHeight: 20,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: isToday || holiday ? 700 : 500,
                              lineHeight: "20px",
                              minWidth: 20,
                              textAlign: "center",
                              borderRadius: "50%",
                              color: isToday
                                ? "primary.contrastText"
                                : holiday
                                  ? "error.main"
                                  : weekend
                                    ? "text.disabled"
                                    : "text.primary",
                              bgcolor: isToday ? "primary.main" : "transparent",
                            }}
                          >
                            {day}
                          </Typography>
                        </Box>

                        {/*
                          Eventos institucionais vêm ANTES das férias: o período
                          da empresa é o pano de fundo sobre o qual as férias são
                          lidas. Mesma mecânica de pistas e de emenda entre dias.

                          O que passar de MAX_EVENT_LANES não some calado — está
                          no tooltip da célula e na lista abaixo da grade.
                        */}
                        {Array.from({ length: eventLaneCount }, (_, lane) => {
                          const evento = noEvento.find(
                            (e) => eventLaneOf.get(e.id) === lane,
                          );
                          if (!evento) {
                            return (
                              <Box key={`ev-${lane}`} sx={{ height: LANE_H - 2 }} />
                            );
                          }

                          const comeca = evento.startDate === date;
                          const termina = evento.endDate === date;
                          const mostraNome = comeca || weekdayIndex === 0;

                          return (
                            <Box
                              key={`ev-${lane}`}
                              sx={{
                                height: LANE_H - 2,
                                display: "flex",
                                alignItems: "center",
                                px: mostraNome ? 0.75 : 0,
                                bgcolor: "warning.light",
                                // NÃO usar `warning.contrastText`: o tema define
                                // só `main` e `light`, então o MUI deriva o
                                // contraste do laranja forte e devolve branco —
                                // que sobre o creme do `light` fica invisível.
                                // O laranja como texto também não passa (3,1:1
                                // sobre #FFF3E0); a cor fica na borda e no
                                // preenchimento, e o texto vai de tinta normal.
                                color: "text.primary",
                                borderTop: "1px solid",
                                borderBottom: "1px solid",
                                borderColor: "warning.main",
                                borderTopLeftRadius: comeca ? 4 : 0,
                                borderBottomLeftRadius: comeca ? 4 : 0,
                                borderTopRightRadius: termina ? 4 : 0,
                                borderBottomRightRadius: termina ? 4 : 0,
                                ml: comeca ? 0 : "-5px",
                                mr: termina ? 0 : "-5px",
                                overflow: "hidden",
                              }}
                            >
                              {mostraNome && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    lineHeight: 1,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {evento.title}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {/*
                          Uma faixa por pista, SEMPRE — inclusive vazia. O
                          espaçador é o que mantém a mesma pessoa na mesma
                          altura de um dia para o outro.
                        */}
                        {Array.from({ length: laneCount }, (_, lane) => {
                          const dono = onVacation.find(
                            (v) => laneOf.get(v.id) === lane,
                          );
                          if (!dono) {
                            return <Box key={lane} sx={{ height: LANE_H - 2 }} />;
                          }

                          const comeca = dono.start === date;
                          const termina = dono.end === date;
                          // Repete o nome no começo de cada semana: sem isso,
                          // quem entra de férias no domingo some da linha.
                          const mostraNome = comeca || weekdayIndex === 0;

                          return (
                            <Box
                              key={lane}
                              sx={{
                                height: LANE_H - 2,
                                display: "flex",
                                alignItems: "center",
                                px: mostraNome ? 0.75 : 0,
                                bgcolor: LANE_COLOR[lane % LANE_COLOR.length],
                                color: "primary.contrastText",
                                borderTopLeftRadius: comeca ? 4 : 0,
                                borderBottomLeftRadius: comeca ? 4 : 0,
                                borderTopRightRadius: termina ? 4 : 0,
                                borderBottomRightRadius: termina ? 4 : 0,
                                // Encosta nas bordas para as faixas de dias
                                // vizinhos parecerem uma só.
                                ml: comeca ? 0 : "-5px",
                                mr: termina ? 0 : "-5px",
                                overflow: "hidden",
                              }}
                            >
                              {mostraNome && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    lineHeight: 1,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {firstName(dono.name)}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {escondidos.length > 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: "text.secondary",
                              px: 0.5,
                            }}
                          >
                            +{escondidos.length}
                          </Typography>
                        )}

                        {holiday && (
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: 10.5,
                              lineHeight: 1.25,
                              fontWeight: 500,
                              color: "error.main",
                              px: 0.25,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {holiday.name}
                          </Typography>
                        )}

                        {cakes.map((c) => (
                          <Stack
                            key={c.id}
                            direction="row"
                            sx={{ alignItems: "center", gap: 0.4, px: 0.25 }}
                          >
                            <Cake
                              size={11}
                              style={{ flex: "none" }}
                              color="var(--mui-palette-secondary-main)"
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: 10.5,
                                lineHeight: 1.2,
                                color: "secondary.main",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {firstName(c.name)}
                            </Typography>
                          </Stack>
                        ))}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>

            <Divider />

            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 22,
                    height: 10,
                    borderRadius: 0.5,
                    bgcolor: "primary.main",
                  }}
                />
                <Typography variant="caption">Período de férias</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 22,
                    height: 10,
                    borderRadius: 0.5,
                    bgcolor: "warning.light",
                    border: "1px solid",
                    borderColor: "warning.main",
                  }}
                />
                <Typography variant="caption">Evento institucional</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: 0.5,
                    bgcolor: "error.light",
                    border: "1px solid",
                    borderColor: "error.main",
                  }}
                />
                <Typography variant="caption">Feriado</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Cake size={12} color="var(--mui-palette-secondary-main)" />
                <Typography variant="caption">Aniversário</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                  }}
                />
                <Typography variant="caption">Hoje</Typography>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {(monthHolidays.length > 0 ||
        monthBirthdays.length > 0 ||
        monthEvents.length > 0) && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              {monthEvents.length > 0 && (
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <CalendarClock size={15} />
                    <Typography variant="subtitle2">
                      Eventos institucionais
                    </Typography>
                  </Stack>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    {monthEvents.map((e) => (
                      <Chip
                        key={e.id}
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={
                          `${e.startDate.slice(8)}/${e.startDate.slice(5, 7)}` +
                          (e.endDate === e.startDate
                            ? ""
                            : ` a ${e.endDate.slice(8)}/${e.endDate.slice(5, 7)}`) +
                          ` · ${e.title}` +
                          (e.sector ? ` (${e.sector})` : "")
                        }
                      />
                    ))}
                  </Stack>
                </Box>
              )}

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
              {vacations.map((v) => {
                const lane = laneOf.get(v.id);
                return (
                  <Stack
                    key={v.id}
                    direction="row"
                    spacing={2}
                    sx={{ justifyContent: "space-between", flexWrap: "wrap" }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      {/* Mesma cor da faixa na grade, para achar a pessoa. */}
                      <Box
                        sx={{
                          width: 4,
                          height: 18,
                          borderRadius: 2,
                          flex: "none",
                          bgcolor:
                            lane === undefined
                              ? "divider"
                              : LANE_COLOR[lane % LANE_COLOR.length],
                        }}
                      />
                      <Typography variant="body2">
                        <strong>{v.name}</strong>
                        {v.sector && (
                          <Box component="span" sx={{ color: "text.secondary" }}>
                            {" "}· {v.sector}
                          </Box>
                        )}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {v.start.split("-").reverse().join("/")} a{" "}
                      {v.end.split("-").reverse().join("/")} · {v.days} dias
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
