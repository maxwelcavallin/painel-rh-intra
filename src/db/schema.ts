import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

/** `admin` é o admin master (RH). Não há 4º nível de permissão. */
export const roleEnum = pgEnum("role", ["user", "gestor", "admin"]);

/**
 * `cancelled` só é usado em `vacationRequests.status` — nunca em `rhApproval`
 * ou `managerApproval`, que continuam sendo o voto de cada parte.
 * Remanejamento é cancelar e abrir nova solicitação, para o histórico não sumir.
 */
export const decisionEnum = pgEnum("decision", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

/**
 * Tipos de comunicação INDIVIDUAL. O RH liga/desliga cada um por canal na
 * tela de Comunicações. Aviso em grupo (broadcast) tem fluxo próprio e não
 * entra aqui.
 */
export const notificationTypeEnum = pgEnum("notification_type", [
  "password_reset",
  "vacation_request",
  "vacation_decision",
  "vacation_expiring",
  "vacation_receipt",
  "vacation_payment",
  "form_new",
  "form_reminder",
]);

/** O que a IA recomendou. `review` = não decidiu sozinha, precisa de humano. */
export const aiRecommendationEnum = pgEnum("ai_recommendation", [
  "approve",
  "reject",
  "review",
]);

/**
 * `location` usa o flag `isCuritibaMetro` (derivado no cadastro) — permite
 * avisar só quem é da Região Metropolitana de Curitiba, ou só quem é de fora.
 */
export const audienceTypeEnum = pgEnum("audience_type", [
  "all",
  "sector",
  "role",
  "user",
  "location",
]);

/** `email` já existe aqui de propósito: v1 não envia, mas o schema não muda quando voltar. */
export const channelEnum = pgEnum("channel", ["discord", "whatsapp", "email"]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "clt",
  "pj",
  "estagio",
  "aprendiz",
  "socio",
]);

export const employmentStatusEnum = pgEnum("employment_status", [
  "ativo",
  "afastado",
  "ferias",
  "desligado",
]);

/* ------------------------------------------------------------------ */
/* users                                                               */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // --- Identidade / acesso ---
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    role: roleEnum("role").notNull().default("user"),
    isActive: boolean("is_active").notNull().default(true),

    // --- Organizacional ---
    sector: text("sector"),
    position: text("position"),
    managerId: uuid("manager_id").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    admissionDate: date("admission_date", { mode: "string" }),
    employmentType: employmentTypeEnum("employment_type"),
    employmentStatus: employmentStatusEnum("employment_status")
      .notNull()
      .default("ativo"),

    // --- Contato (canais de notificação) ---
    phone: text("phone"),
    /** Apenas exibição/referência. A API do Discord não busca usuário por handle. */
    discordHandle: text("discord_handle"),
    /**
     * ID numérico do Discord (snowflake) — é o que a API aceita para abrir DM.
     * Obtém-se com o Modo Desenvolvedor ligado: botão direito no usuário → Copiar ID.
     * Guardado como texto porque snowflake estoura o inteiro seguro do JS.
     */
    discordUserId: text("discord_user_id"),
    personalEmail: text("personal_email"),

    // --- Endereço (ViaCEP preenche a partir do zipCode) ---
    zipCode: text("zip_code"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    state: text("state"),
    /** Calculado no save: `city`+`state` contra a lista fixa da RMC. */
    isCuritibaMetro: boolean("is_curitiba_metro").notNull().default(false),

    // --- Dados pessoais (sensíveis: nunca em log, nunca em query string) ---
    birthDate: date("birth_date", { mode: "string" }),
    gender: text("gender"),
    rg: text("rg"),
    cpf: text("cpf"),
    fatherName: text("father_name"),
    motherName: text("mother_name"),
    birthplace: text("birthplace"),

    // --- Formação ---
    educationLevel: text("education_level"),
    courseName: text("course_name"),
    institution: text("institution"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_manager_idx").on(t.managerId),
    index("users_sector_idx").on(t.sector),
  ],
);

/* ------------------------------------------------------------------ */
/* passwordResetCodes — "esqueci minha senha" via WhatsApp (Zaia)      */
/* ------------------------------------------------------------------ */

export const passwordResetCodes = pgTable(
  "password_reset_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Só o hash do código de 6 dígitos — o código em claro nunca é persistido. */
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("password_reset_user_idx").on(t.userId, t.expiresAt)],
);

/* ------------------------------------------------------------------ */
/* vacationRequests                                                    */
/* ------------------------------------------------------------------ */

export const vacationRequests = pgTable(
  "vacation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    days: integer("days").notNull(),
    notes: text("notes"),

    // --- Opções que hoje vão no e-mail e precisam vir no formulário ---
    /** Art. 143 CLT: converter até 1/3 das férias em dinheiro. */
    abonoPecuniario: boolean("abono_pecuniario").notNull().default(false),
    abonoDays: integer("abono_days").notNull().default(0),
    /** Antecipação da 1ª parcela do 13º junto com as férias (art. 2º, Lei 4.749). */
    advance13th: boolean("advance_13th").notNull().default(false),

    // --- Onde a multa realmente acontece ---
    /**
     * Pagamento é devido até 2 dias ANTES do início (art. 145 CLT).
     * Calculado na aprovação, descontando fim de semana e feriado.
     */
    paymentDueDate: date("payment_due_date", { mode: "string" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidBy: uuid("paid_by").references(() => users.id, { onDelete: "set null" }),
    /** Recibo de férias assinado — sem ele a empresa fica exposta. */
    receiptSignedAt: timestamp("receipt_signed_at", { withTimezone: true }),
    receiptRegisteredBy: uuid("receipt_registered_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // --- Repasse à Senior (lotes dos dias 10 e 20) ---
    reportedToSeniorAt: timestamp("reported_to_senior_at", { withTimezone: true }),

    // --- Cancelamento / remanejamento ---
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancelReason: text("cancel_reason"),

    /** Status consolidado, derivado das duas aprovações. */
    status: decisionEnum("status").notNull().default("pending"),

    rhApproval: decisionEnum("rh_approval").notNull().default("pending"),
    rhApprovedBy: uuid("rh_approved_by").references(() => users.id, { onDelete: "set null" }),
    rhApprovedAt: timestamp("rh_approved_at", { withTimezone: true }),
    rhNote: text("rh_note"),

    managerApproval: decisionEnum("manager_approval")
      .notNull()
      .default("pending"),
    managerApprovedBy: uuid("manager_approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    managerApprovedAt: timestamp("manager_approved_at", { withTimezone: true }),
    managerNote: text("manager_note"),

    // --- Parecer da IA ---
    aiRecommendation: aiRecommendationEnum("ai_recommendation"),
    aiReasoning: text("ai_reasoning"),
    /** Bloqueios duros (art. 134 §3º CLT, sobreposição, saldo). */
    aiConflicts: jsonb("ai_conflicts").$type<string[]>().default([]),
    /** Alertas não-bloqueantes. */
    aiWarnings: jsonb("ai_warnings").$type<string[]>().default([]),
    /** Snapshot dos fatos determinísticos que a IA recebeu — auditoria. */
    aiFacts: jsonb("ai_facts"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("vacation_user_idx").on(t.userId),
    index("vacation_status_idx").on(t.status),
    index("vacation_range_idx").on(t.startDate, t.endDate),
  ],
);

/* ------------------------------------------------------------------ */
/* notifications                                                       */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/* ------------------------------------------------------------------ */
/* notificationSettings — a "central de comunicações" do RH            */
/* ------------------------------------------------------------------ */

/**
 * Matriz tipo × canal, ligada/desligada pelo admin master.
 *
 * A notificação DENTRO da intranet não entra aqui: ela é sempre criada, porque
 * é o próprio sistema e não depende de serviço externo. O que se liga e desliga
 * são os canais que saem da plataforma.
 *
 * Uma linha ausente significa desligado — o padrão é não incomodar ninguém.
 */
export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: notificationTypeEnum("type").notNull(),
    channel: channelEnum("channel").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("notification_settings_unique").on(t.type, t.channel)],
);

/* ------------------------------------------------------------------ */
/* broadcasts (avisos do RH)                                           */
/* ------------------------------------------------------------------ */

export const broadcasts = pgTable("broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audienceType: audienceTypeEnum("audience_type").notNull().default("all"),
  /** Valor da audiência: nome do setor, papel ou id de usuário. Null quando `all`. */
  audienceValue: text("audience_value"),
  channels: jsonb("channels").$type<("discord" | "whatsapp" | "email")[]>()
    .notNull()
    .default([]),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const broadcastDeliveries = pgTable(
  "broadcast_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    broadcastId: uuid("broadcast_id")
      .notNull()
      .references(() => broadcasts.id, { onDelete: "cascade" }),
    /**
     * NULL = entrega de CANAL, não de pessoa.
     *
     * O webhook do Discord publica num canal único: existe uma entrega só, para
     * o canal inteiro. Gravar uma linha por destinatário fingiria um envio
     * individual que não aconteceu. WhatsApp, esse sim, é uma linha por pessoa.
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("broadcast_deliveries_broadcast_idx").on(t.broadcastId)],
);

/* ------------------------------------------------------------------ */
/* forms (formulários com confirmação de leitura/resposta)             */
/* ------------------------------------------------------------------ */

export type FormQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "date";
  required: boolean;
  options?: string[];
};

export const forms = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  questions: jsonb("questions").$type<FormQuestion[]>().notNull().default([]),
  audienceType: audienceTypeEnum("audience_type").notNull().default("all"),
  audienceValue: text("audience_value"),
  /** Horas após a criação para o Cron cobrar quem não respondeu. */
  reminderAfterHours: integer("reminder_after_hours").notNull().default(48),
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const formResponses = pgTable(
  "form_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("form_responses_unique").on(t.formId, t.userId)],
);

/* ------------------------------------------------------------------ */
/* Tipos inferidos                                                     */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type VacationRequest = typeof vacationRequests.$inferSelect;
export type NewVacationRequest = typeof vacationRequests.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type Broadcast = typeof broadcasts.$inferSelect;
export type Form = typeof forms.$inferSelect;
export type FormResponse = typeof formResponses.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type Channel = (typeof channelEnum.enumValues)[number];
export type NotificationSetting = typeof notificationSettings.$inferSelect;
