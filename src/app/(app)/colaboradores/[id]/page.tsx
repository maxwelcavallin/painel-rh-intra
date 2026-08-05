import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { requireRH } from "@/lib/dal";
import { getEmployee, listManagerCandidates } from "@/server/employees";
import { formatCpf } from "@/lib/format";

import { EmployeeForm, type EmployeeFormValues } from "../employee-form";

export const metadata: Metadata = { title: "Editar colaborador" };

export default async function EditarColaboradorPage({
  params,
}: PageProps<"/colaboradores/[id]">) {
  await requireRH();

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  // Um gestor não pode ser ele mesmo — a lista já exclui o próprio registro.
  const managers = await listManagerCandidates(id);

  const initial: EmployeeFormValues = {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    isActive: employee.isActive,
    sector: employee.sector ?? "",
    position: employee.position ?? "",
    managerId: employee.managerId ?? "",
    admissionDate: employee.admissionDate ?? "",
    employmentType: employee.employmentType ?? "clt",
    employmentStatus: employee.employmentStatus ?? "ativo",
    phone: employee.phone ?? "",
    discordHandle: employee.discordHandle ?? "",
    personalEmail: employee.personalEmail ?? "",
    zipCode: employee.zipCode ?? "",
    addressStreet: employee.addressStreet ?? "",
    addressNumber: employee.addressNumber ?? "",
    addressComplement: employee.addressComplement ?? "",
    neighborhood: employee.neighborhood ?? "",
    city: employee.city ?? "",
    state: employee.state ?? "",
    birthDate: employee.birthDate ?? "",
    gender: employee.gender ?? "",
    rg: employee.rg ?? "",
    // Formatado só para leitura humana; o servidor volta a guardar só dígitos.
    cpf: employee.cpf ? formatCpf(employee.cpf) : "",
    fatherName: employee.fatherName ?? "",
    motherName: employee.motherName ?? "",
    birthplace: employee.birthplace ?? "",
    educationLevel: employee.educationLevel ?? "",
    courseName: employee.courseName ?? "",
    institution: employee.institution ?? "",
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {employee.name}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Esta é a única tela onde CPF e RG aparecem por extenso.
        </Typography>
      </Stack>

      <EmployeeForm initial={initial} managers={managers} mode="edit" />
    </Stack>
  );
}
