import { useState } from "react";

import {
  Container,
  Stack,
  Button,
} from "@mui/material";

import Layout from "../components/layout/Layout";

import WalletBalanceCard from "../components/wallet/WalletBalanceCard";
import TopupDialog from "../components/wallet/TopupDialog";
import WithdrawDialog from "../components/wallet/WithdrawDialog";

const Wallet = () => {
  const [
    openTopup,
    setOpenTopup,
  ] = useState(false);

  const [
    openWithdraw,
    setOpenWithdraw,
  ] = useState(false);

  return (
    <Layout>
      <Container
        maxWidth="md"
        sx={{ mt: 4 }}
      >
        <WalletBalanceCard />

        <Stack
          direction="row"
          spacing={2}
          sx={{ mt: 3 }}
        >
          <Button
            variant="contained"
            onClick={() =>
              setOpenTopup(
                true
              )
            }
          >
            Top Up
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={() =>
              setOpenWithdraw(
                true
              )
            }
          >
            Withdraw
          </Button>
        </Stack>

        <TopupDialog
          open={openTopup}
          onClose={() =>
            setOpenTopup(
              false
            )
          }
        />

        <WithdrawDialog
          open={openWithdraw}
          onClose={() =>
            setOpenWithdraw(
              false
            )
          }
        />
      </Container>
    </Layout>
  );
};

export default Wallet;