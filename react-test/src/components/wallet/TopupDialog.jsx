import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
} from "@mui/material";

import { useState } from "react";

import { topupWallet } from "../../services/walletService";

const TopupDialog = ({
  open,
  onClose,
  fetchWallet,
}) => {
  const [amount, setAmount] =
    useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("card");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const handleTopup =
    async () => {
      try {
        setLoading(true);

        const result =
          await topupWallet({
            amount,
            payment_method:
              paymentMethod,
            description,
          });

        await fetchWallet();

        alert(
          `Topup Successful

Reference: ${result.reference_no}

Amount: ${result.amount} EGP

Fee: ${result.fee} EGP

Net Credited: ${result.net_credited} EGP

New Balance: ${result.new_balance} EGP`
        );

        onClose();

        setAmount("");
        setDescription("");
      } catch (err) {
        alert(
          err.response?.data
            ?.message ||
            "Topup failed"
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Top Up Wallet
      </DialogTitle>

      <DialogContent>
        <Stack
          spacing={2}
          mt={1}
        >
          <TextField
            label="Amount (EGP)"
            type="number"
            value={amount}
            onChange={(e) =>
              setAmount(
                e.target.value
              )
            }
            fullWidth
          />

          <TextField
            select
            label="Payment Method"
            value={
              paymentMethod
            }
            onChange={(e) =>
              setPaymentMethod(
                e.target.value
              )
            }
            fullWidth
          >
            <MenuItem value="card">
              Card
            </MenuItem>

            <MenuItem value="bank_transfer">
              Bank Transfer
            </MenuItem>

            <MenuItem value="agent">
              Agent
            </MenuItem>
          </TextField>

          <TextField
            label="Description"
            value={
              description
            }
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
            fullWidth
            multiline
            rows={3}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={
            handleTopup
          }
          disabled={loading}
        >
          {loading
            ? "Processing..."
            : "Top Up"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TopupDialog;