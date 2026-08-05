import Chip from "@mui/material/Chip";

import { statusColor, statusLabel } from "@/lib/brand";

/**
 * Chip de status. Sempre pelo mapa `statusColor` do DS — nunca cor "livre".
 * Vale para férias e, na Fase 4, para formulários.
 */
export function StatusChip({
  status,
  size = "small",
}: {
  status: "pending" | "approved" | "rejected";
  size?: "small" | "medium";
}) {
  return (
    <Chip
      label={statusLabel[status]}
      color={statusColor[status]}
      size={size}
      variant="filled"
    />
  );
}
