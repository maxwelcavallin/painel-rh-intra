import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { MapPin, Pencil, UserPlus } from "lucide-react";

import { requireRH } from "@/lib/dal";
import { formatDateBR, formatPhone } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/nav";
import { listEmployees } from "@/server/employees";

export const metadata: Metadata = { title: "Colaboradores" };

export default async function ColaboradoresPage({
  searchParams,
}: PageProps<"/colaboradores">) {
  // Admin master apenas. Colaborador e gestor caem em /sem-permissao.
  await requireRH();

  const params = await searchParams;
  const employees = await listEmployees();

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Colaboradores
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {employees.length} cadastrado(s)
          </Typography>
        </Box>
        <Button
          href="/colaboradores/novo"
          variant="contained"
          startIcon={<UserPlus size={18} />}
        >
          Novo colaborador
        </Button>
      </Stack>

      {params.salvo === "1" && (
        <Alert severity="success">Cadastro salvo com sucesso.</Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Papel</TableCell>
                <TableCell>Setor / Cargo</TableCell>
                <TableCell>Gestor</TableCell>
                <TableCell>Contato</TableCell>
                <TableCell>Cidade</TableCell>
                <TableCell>Admissão</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {e.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {e.email}
                    </Typography>
                    {!e.isActive && (
                      <Chip
                        label="Acesso inativo"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ROLE_LABEL[e.role]}
                      size="small"
                      color={e.role === "admin" ? "primary" : "default"}
                      variant={e.role === "user" ? "outlined" : "filled"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{e.sector ?? "—"}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {e.position ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{e.managerName ?? "—"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatPhone(e.phone)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ alignItems: "center" }}
                    >
                      <Typography variant="body2">
                        {e.city ? `${e.city}/${e.state ?? ""}` : "—"}
                      </Typography>
                      {e.isCuritibaMetro && (
                        <Chip
                          icon={<MapPin size={12} />}
                          label="RMC"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateBR(e.admissionDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      href={`/colaboradores/${e.id}`}
                      size="small"
                      startIcon={<Pencil size={14} />}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        CPF e RG não aparecem nesta listagem por decisão de segurança — só na
        tela de edição do cadastro.
      </Typography>
    </Stack>
  );
}
