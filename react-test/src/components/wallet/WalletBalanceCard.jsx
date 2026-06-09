import {
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
} from "@mui/material";

import { useState } from "react";

import { useWallet } from "../../hooks/useWallet";

import TopupDialog from "./TopupDialog";

const WalletBalanceCard = () => {
  const {
    wallet,
    fetchWallet,
  } = useWallet();

  const [open, setOpen] =
    useState(false);

  if (!wallet) {
    return (
      <Typography>
        Loading...
      </Typography>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography
              variant="h5"
            >
              Wallet Balance
            </Typography>

            <Typography
              variant="h3"
            >
              {wallet.balance}
              {" "}
              {wallet.currency}
            </Typography>

            <Typography>
              Status:
              {" "}
              {wallet.status}
            </Typography>

            <Button
              variant="contained"
              onClick={() =>
                setOpen(true)
              }
            >
              Top Up Wallet
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <TopupDialog
        open={open}
        onClose={() =>
          setOpen(false)
        }
        fetchWallet={
          fetchWallet
        }
      />
    </>
  );
};

export default WalletBalanceCard;