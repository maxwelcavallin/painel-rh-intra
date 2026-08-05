import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireRH } from "@/lib/dal";
import { listManagerCandidates } from "@/server/employees";

import { EmployeeForm, EMPTY_EMPLOYEE } from "../employee-form";

export const metadata: Metadata = { title: "Novo colaborador" };

export default async function NovoColaboradorPage() {
  await requireRH();

  const managers = await listManagerCandidates();

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Novo colaborador
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Nome, e-mail e senha inicial bastam para a pessoa já conseguir entrar.
          O resto pode ser completado depois.
        </Typography>
      </Stack>

      <EmployeeForm initial={EMPTY_EMPLOYEE} managers={managers} mode="create" />
    </Stack>
  );
}
