import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireSession } from "@/lib/dal";
import { navFor, ROLE_LABEL } from "@/lib/nav";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function HomePage() {
  const user = await requireSession();
  const shortcuts = navFor(user.role).filter((item) => item.href !== "/");

  return (
    <Stack spacing={3}>
      <Box>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {greeting()}, {user.name.split(" ")[0]}
          </Typography>
          <Chip label={ROLE_LABEL[user.role]} size="small" color="primary" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {user.sector
            ? `Setor: ${user.sector}`
            : "Setor não informado — peça ao RH para completar seu cadastro."}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {shortcuts.map(({ href, label, icon: Icon, section }) => (
          <Grid key={href} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea href={href} sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "mosaic.100",
                        color: "primary.main",
                      }}
                    >
                      <Icon size={20} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {section}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
