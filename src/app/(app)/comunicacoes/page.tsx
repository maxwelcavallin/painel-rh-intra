import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { requireRH } from "@/lib/dal";
import {
  CHANNEL_META,
  CONFIGURABLE_CHANNELS,
  getSettingsMatrix,
  NOTIFICATION_CATALOG,
} from "@/server/notifications";

import { ChannelToggle } from "./channel-toggle";
import { TestButton } from "./test-button";

export const metadata: Metadata = { title: "Comunicações" };

export default async function ComunicacoesPage() {
  // Central de comunicações é do admin master.
  await requireRH();

  const matrix = await getSettingsMatrix();

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Comunicações
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Quais avisos individuais saem da plataforma e por quais canais.
        </Typography>
      </Stack>

      <Alert severity="info">
        A notificação <strong>dentro da intranet</strong> é sempre criada e não
        aparece aqui — ela é o próprio sistema, não depende de serviço externo.
        Esta tela controla apenas o que sai da plataforma. Avisos em grupo têm
        fluxo próprio, em <strong>Avisos</strong>.
      </Alert>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo de comunicação</TableCell>
                <TableCell>Quem recebe</TableCell>
                {CONFIGURABLE_CHANNELS.map((channel) => {
                  const meta = CHANNEL_META[channel];
                  return (
                    <TableCell key={channel} align="center">
                      <Tooltip title={meta.hint} arrow>
                        <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {meta.label}
                          </Typography>
                          {!meta.available && (
                            <Chip
                              label="em breve"
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          )}
                        </Stack>
                      </Tooltip>
                    </TableCell>
                  );
                })}
                <TableCell align="center">Teste</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {NOTIFICATION_CATALOG.map((item) => (
                <TableRow key={item.type} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {item.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{item.audience}</Typography>
                  </TableCell>

                  {CONFIGURABLE_CHANNELS.map((channel) => {
                    const meta = CHANNEL_META[channel];
                    return (
                      <TableCell key={channel} align="center">
                        <ChannelToggle
                          type={item.type}
                          channel={channel}
                          enabled={matrix[`${item.type}:${channel}`] ?? false}
                          disabled={!meta.available}
                          hint={meta.hint}
                          label={`${item.label} por ${meta.label}`}
                        />
                      </TableCell>
                    );
                  })}

                  <TableCell align="center">
                    <TestButton type={item.type} label={item.label} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Alert severity="warning">
        Nesta entrega o <strong>WhatsApp faz o papel do e-mail</strong>, por
        decisão de produto. O canal de e-mail aparece aqui já mapeado, mas ainda
        não entrega — quando for implementado, é só ligar por tipo, sem mexer no
        código. A DM do Discord depende de um bot e também está no roadmap.
      </Alert>
    </Stack>
  );
}
