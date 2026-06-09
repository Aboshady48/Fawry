import { useState } from "react";

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

import { withdrawWallet } from "../../services/walletService";

const WithdrawDialog = ({
  open,
  onClose,
  refreshBalance,
}) => {
  const [amount, setAmount] =
    useState("");

  const [method, setMethod] =
    useState("agent");

  const [
    bankAccountId,
    setBankAccountId,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const handleSubmit =
    async () => {
      try {
        setLoading(true);

        const response =
          await withdrawWallet({
            amount: Number(
              amount
            ),
            method,
            bank_account_id:
              method ===
              "bank_transfer"
                ? bankAccountId
                : null,
          });

        console.log(
          "WITHDRAW SUCCESS:",
          response
        );

        alert(
          response.message ||
            "Withdrawal successful"
        );

        if (refreshBalance) {
          await refreshBalance();
        }

        setAmount("");
        setBankAccountId("");

        onClose();
      } catch (err) {
        console.error(
          "WITHDRAW ERROR:",
          err
        );

        console.error(
          "SERVER RESPONSE:",
          err.response?.data
        );

        const errorMessage =
          err.response?.data
            ?.message ||
          "Withdrawal failed";

        alert(errorMessage);
      } finally {
        setLoading(false);
      }
    };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
    >
      <DialogTitle>
        Withdraw Funds
      </DialogTitle>

      <DialogContent>
        <Stack
          spacing={2}
          mt={2}
        >
          <TextField
            label="Amount"
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
            label="Method"
            value={method}
            onChange={(e) =>
              setMethod(
                e.target.value
              )
            }
            fullWidth
          >
            <MenuItem value="agent">
              Agent
            </MenuItem>

            <MenuItem value="bank_transfer">
              Bank Transfer
            </MenuItem>
          </TextField>

          {method ===
            "bank_transfer" && (
            <TextField
              label="Bank Account ID"
              value={bankAccountId}
              onChange={(e) =>
                setBankAccountId(
                  e.target.value
                )
              }
              fullWidth
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={
            handleSubmit
          }
          disabled={loading}
        >
          {loading
            ? "Processing..."
            : "Withdraw"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WithdrawDialog;