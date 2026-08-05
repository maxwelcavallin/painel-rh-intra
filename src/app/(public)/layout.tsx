import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * Casca das telas sem sessão (login e recuperação de senha).
 * Fundo `primary.main` — é de onde a cor da marca foi amostrada.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        p: 2,
        // CSS vars do tema (cssVariables: true). Uma função aqui viraria
        // "Functions cannot be passed to Client Components" — este layout é
        // Server Component e o Box é client.
        background:
          "linear-gradient(160deg, var(--mui-palette-primary-main) 0%, var(--mui-palette-primary-dark) 100%)",
      }}
    >
      {children}
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.65)" }}>
        Uso interno · 01 Tecnologia
      </Typography>
    </Box>
  );
}
