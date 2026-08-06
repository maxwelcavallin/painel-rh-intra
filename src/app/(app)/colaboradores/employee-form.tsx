"use client";

import { useActionState, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { MapPin, Save } from "lucide-react";

import { isValidCpf, onlyDigits } from "@/lib/format";
import { isCuritibaMetro } from "@/lib/rmc";

import {
  createEmployeeAction,
  updateEmployeeAction,
  type EmployeeState,
} from "./actions";

export type EmployeeFormValues = {
  id?: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  sector: string;
  position: string;
  managerId: string;
  admissionDate: string;
  employmentType: string;
  employmentStatus: string;
  phone: string;
  discordHandle: string;
  personalEmail: string;
  zipCode: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  birthDate: string;
  gender: string;
  rg: string;
  cpf: string;
  fatherName: string;
  motherName: string;
  birthplace: string;
  educationLevel: string;
  courseName: string;
  institution: string;
};

export const EMPTY_EMPLOYEE: EmployeeFormValues = {
  name: "",
  email: "",
  role: "user",
  isActive: true,
  sector: "",
  position: "",
  managerId: "",
  admissionDate: "",
  employmentType: "clt",
  employmentStatus: "ativo",
  phone: "",
  discordHandle: "",
  personalEmail: "",
  zipCode: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  neighborhood: "",
  city: "",
  state: "",
  birthDate: "",
  gender: "",
  rg: "",
  cpf: "",
  fatherName: "",
  motherName: "",
  birthplace: "",
  educationLevel: "",
  courseName: "",
  institution: "",
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
            {hint && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {hint}
              </Typography>
            )}
          </Box>
          <Divider />
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function EmployeeForm({
  initial,
  managers,
  mode,
}: {
  initial: EmployeeFormValues;
  managers: { id: string; name: string; sector: string | null }[];
  mode: "create" | "edit";
}) {
  const action = mode === "create" ? createEmployeeAction : updateEmployeeAction;
  const [state, formAction, pending] = useActionState<EmployeeState, FormData>(
    action,
    {},
  );

  const [values, setValues] = useState(initial);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "notFound">("idle");
  // Sequência do último CEP consultado — ignora respostas fora de ordem.
  const cepSeqRef = useRef(0);

  const set = <K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  // Mesma função pura usada no servidor para gravar o flag — o que a tela
  // mostra e o que vai ao banco não podem divergir.
  const naRmc = isCuritibaMetro(values.city, values.state);

  const cpfDigits = onlyDigits(values.cpf);
  const cpfInvalido = cpfDigits.length === 11 && !isValidCpf(cpfDigits);

  /**
   * Busca o endereço quando o CEP fica completo.
   *
   * Feito no handler do onChange, não num `useEffect` keyed no CEP: isto é
   * reação a um EVENTO (a pessoa digitou), não sincronização com sistema
   * externo. Em effect, o `setState` síncrono dispara renders em cascata — e a
   * regra `react-hooks/set-state-in-effect` reprova, com razão.
   */
  async function handleCepChange(raw: string) {
    set("zipCode", raw);

    const cep = onlyDigits(raw);
    if (cep.length !== 8) {
      // Nova entrada curta invalida qualquer request em voo — evita que uma
      // resposta antiga chegue depois e sobrescreva o endereço.
      cepSeqRef.current++;
      setCepStatus("idle");
      return;
    }

    const seq = ++cepSeqRef.current;
    setCepStatus("loading");
    try {
      const response = await fetch(`/api/cep?cep=${cep}`);
      if (seq !== cepSeqRef.current) return; // resposta obsoleta
      if (!response.ok) throw new Error("cep");
      const address = (await response.json()) as {
        street: string;
        neighborhood: string;
        city: string;
        state: string;
      };
      if (seq !== cepSeqRef.current) return; // outra digitação chegou primeiro

      setCepStatus("idle");
      setValues((v) => ({
        ...v,
        // Não sobrescreve o que já foi digitado à mão.
        addressStreet: v.addressStreet || address.street,
        neighborhood: v.neighborhood || address.neighborhood,
        city: address.city,
        state: address.state,
      }));
    } catch {
      if (seq !== cepSeqRef.current) return;
      setCepStatus("notFound");
    }
  }

  return (
    <Box component="form" action={formAction}>
      {mode === "edit" && <input type="hidden" name="id" value={values.id} />}

      <Stack spacing={2.5}>
        {state.error && <Alert severity="error">{state.error}</Alert>}

        <Section
          title="Acesso"
          hint="O RH define a senha inicial; o colaborador pode trocá-la depois em 'Esqueci minha senha'."
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="name"
                label="Nome completo"
                required
                fullWidth
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="email"
                label="E-mail corporativo (login)"
                type="email"
                required
                fullWidth
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="password"
                label={mode === "create" ? "Senha inicial" : "Nova senha"}
                type="password"
                required={mode === "create"}
                fullWidth
                autoComplete="new-password"
                helperText={
                  mode === "create"
                    ? "Mínimo 8 caracteres"
                    : "Deixe vazio para manter a senha atual"
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="role"
                label="Papel"
                select
                fullWidth
                value={values.role}
                onChange={(e) => set("role", e.target.value)}
                helperText="Define o que a pessoa vê no sistema"
              >
                <MenuItem value="user">Colaborador</MenuItem>
                <MenuItem value="gestor">Gestor</MenuItem>
                <MenuItem value="admin">RH (admin master)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    name="isActive"
                    checked={values.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                  />
                }
                label="Acesso ativo"
                sx={{ mt: 1 }}
              />
            </Grid>
          </Grid>
        </Section>

        <Section title="Organizacional">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="sector"
                label="Setor"
                fullWidth
                value={values.sector}
                onChange={(e) => set("sector", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="position"
                label="Cargo"
                fullWidth
                value={values.position}
                onChange={(e) => set("position", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="managerId"
                label="Gestor direto"
                select
                fullWidth
                value={values.managerId}
                onChange={(e) => set("managerId", e.target.value)}
                helperText="Quem aprova as férias desta pessoa"
              >
                <MenuItem value="">
                  <em>Sem gestor (só o RH aprova)</em>
                </MenuItem>
                {managers.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                    {m.sector ? ` · ${m.sector}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="admissionDate"
                label="Data de admissão"
                type="date"
                fullWidth
                value={values.admissionDate}
                onChange={(e) => set("admissionDate", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Base do período aquisitivo de férias"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="employmentType"
                label="Tipo de contrato"
                select
                fullWidth
                value={values.employmentType}
                onChange={(e) => set("employmentType", e.target.value)}
              >
                <MenuItem value="clt">CLT</MenuItem>
                <MenuItem value="pj">PJ</MenuItem>
                <MenuItem value="estagio">Estágio</MenuItem>
                <MenuItem value="aprendiz">Aprendiz</MenuItem>
                <MenuItem value="socio">Sócio</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="employmentStatus"
                label="Situação"
                select
                fullWidth
                value={values.employmentStatus}
                onChange={(e) => set("employmentStatus", e.target.value)}
              >
                <MenuItem value="ativo">Ativo</MenuItem>
                <MenuItem value="afastado">Afastado</MenuItem>
                <MenuItem value="ferias">Em férias</MenuItem>
                <MenuItem value="desligado">Desligado</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Section>

        <Section
          title="Contato"
          hint="O telefone é o canal do WhatsApp — sem ele a pessoa não recebe aviso de férias nem código de recuperação de senha."
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="phone"
                label="Telefone / WhatsApp"
                fullWidth
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(41) 99999-8888"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="discordHandle"
                label="Discord"
                fullWidth
                value={values.discordHandle}
                onChange={(e) => set("discordHandle", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="personalEmail"
                label="E-mail pessoal"
                type="email"
                fullWidth
                value={values.personalEmail}
                onChange={(e) => set("personalEmail", e.target.value)}
              />
            </Grid>
          </Grid>
        </Section>

        <Section
          title="Endereço"
          hint="Preencha o CEP que o resto vem sozinho (ViaCEP)."
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                name="zipCode"
                label="CEP"
                fullWidth
                value={values.zipCode}
                onChange={(e) => void handleCepChange(e.target.value)}
                error={cepStatus === "notFound"}
                helperText={cepStatus === "notFound" ? "CEP não encontrado" : " "}
                slotProps={{
                  input: {
                    endAdornment: cepStatus === "loading" && (
                      <InputAdornment position="end">
                        <CircularProgress size={16} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <TextField
                name="addressStreet"
                label="Logradouro"
                fullWidth
                value={values.addressStreet}
                onChange={(e) => set("addressStreet", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                name="addressNumber"
                label="Número"
                fullWidth
                value={values.addressNumber}
                onChange={(e) => set("addressNumber", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="addressComplement"
                label="Complemento"
                fullWidth
                value={values.addressComplement}
                onChange={(e) => set("addressComplement", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="neighborhood"
                label="Bairro"
                fullWidth
                value={values.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                name="city"
                label="Cidade"
                fullWidth
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 1 }}>
              <TextField
                name="state"
                label="UF"
                fullWidth
                value={values.state}
                onChange={(e) => set("state", e.target.value.toUpperCase())}
                slotProps={{ htmlInput: { maxLength: 2 } }}
              />
            </Grid>
            <Grid size={12}>
              <Chip
                icon={<MapPin size={14} />}
                label={
                  naRmc
                    ? "Região Metropolitana de Curitiba"
                    : "Fora da Região Metropolitana de Curitiba"
                }
                color={naRmc ? "success" : "default"}
                variant={naRmc ? "filled" : "outlined"}
                size="small"
              />
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
              >
                Calculado a partir da cidade e da UF — não é campo digitável.
              </Typography>
            </Grid>
          </Grid>
        </Section>

        <Section
          title="Dados pessoais"
          hint="CPF e RG aparecem mascarados fora desta tela e nunca são gravados em log."
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="cpf"
                label="CPF"
                fullWidth
                value={values.cpf}
                onChange={(e) => set("cpf", e.target.value)}
                error={cpfInvalido}
                helperText={cpfInvalido ? "CPF inválido — confira os dígitos" : " "}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="rg"
                label="RG"
                fullWidth
                value={values.rg}
                onChange={(e) => set("rg", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="birthDate"
                label="Data de nascimento"
                type="date"
                fullWidth
                value={values.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="gender"
                label="Gênero"
                fullWidth
                value={values.gender}
                onChange={(e) => set("gender", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="birthplace"
                label="Naturalidade"
                fullWidth
                value={values.birthplace}
                onChange={(e) => set("birthplace", e.target.value)}
                placeholder="Curitiba/PR"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="motherName"
                label="Nome da mãe"
                fullWidth
                value={values.motherName}
                onChange={(e) => set("motherName", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="fatherName"
                label="Nome do pai"
                fullWidth
                value={values.fatherName}
                onChange={(e) => set("fatherName", e.target.value)}
              />
            </Grid>
          </Grid>
        </Section>

        <Section title="Formação">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="educationLevel"
                label="Escolaridade"
                fullWidth
                value={values.educationLevel}
                onChange={(e) => set("educationLevel", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="courseName"
                label="Curso"
                fullWidth
                value={values.courseName}
                onChange={(e) => set("courseName", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                name="institution"
                label="Instituição"
                fullWidth
                value={values.institution}
                onChange={(e) => set("institution", e.target.value)}
              />
            </Grid>
          </Grid>
        </Section>

        <Stack direction="row" spacing={1.5}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending || cpfInvalido}
            startIcon={<Save size={18} />}
          >
            {pending ? "Salvando…" : "Salvar colaborador"}
          </Button>
          <Button href="/colaboradores" size="large" disabled={pending}>
            Cancelar
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
