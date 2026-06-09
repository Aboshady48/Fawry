import {
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
} from "@mui/material";

import { useUserContext } from "../../context/UserContext";

const WalletInfoCard = () => {
  const { user } = useUserContext();

  return (
    <Card>
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
        >
          Wallet Information
        </Typography>

        <Stack spacing={2}>
          <Typography variant="h4">
            {user?.wallet?.balance ?? 0} EGP
          </Typography>

          <Chip
            label={user?.wallet?.status}
            color={
              user?.wallet?.status === "active"
                ? "success"
                : "error"
            }
          />
        </Stack>
      </CardContent>
    </Card>
  );
};

export default WalletInfoCard;