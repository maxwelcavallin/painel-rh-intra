import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireSession } from "@/lib/dal";
import {
  addDays,
  COMPANY_NOTICE_DAYS,
  MIN_ANY_FRACTION,
  todayISOBrazil,
} from "@/lib/clt";
import { getHolidaysForRange } from "@/server/holidays";
import { listUpcomingEventsFor } from "@/server/institutional-events";
import { listTeamVacations } from "@/server/vacations";

import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Solicitar férias" };

export default async function SolicitarPage() {
  // Rota autenticada: nome, e-mail e setor vêm da sessão, não de campo digitável.
  const user = await requireSession();

  // A pessoa vê a programação da equipe ANTES de escolher a data — foi um
  // pedido explícito do RH, para a escolha já nascer consciente do impacto.
  // Os eventos institucionais entram pelo mesmo motivo, e com o mesmo peso:
  // avisam, não impedem.
  const hoje = todayISOBrazil();

  const [team, eventos, feriados] = await Promise.all([
    listTeamVacations(user.id),
    listUpcomingEventsFor(user.sector, hoje),
    // Os mesmos feriados que a análise usa vão para o calendário do formulário —
    // é o que faz o seletor bloquear exatamente os dias que o servidor reprova.
    // Dois anos à frente cobrem qualquer data que o seletor deixa alcançar.
    getHolidaysForRange(hoje, addDays(hoje, 730)),
  ]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 760 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Solicitar férias
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Solicitando como <strong>{user.name}</strong>
          {user.sector ? ` · ${user.sector}` : ""}
        </Typography>
      </Stack>

      <Alert severity="info">
        O calendário já vem travado nas regras: só aparecem datas de início
        válidas pelo art. 134, §3º da CLT — nada de começar em feriado, no
        domingo, nem nos dois dias que antecedem um deles. Entram os feriados
        nacionais, o estadual do Paraná e os municipais de Curitiba. O período
        mínimo é de {MIN_ANY_FRACTION} dias corridos (art. 134, §1º) e a política
        interna pede {COMPANY_NOTICE_DAYS} dias de antecedência. Saldo do período
        aquisitivo, abono e sobreposição com a equipe são conferidos no envio.
      </Alert>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <RequestForm team={team} eventos={eventos} feriados={feriados} />
        </CardContent>
      </Card>
    </Stack>
  );
}
