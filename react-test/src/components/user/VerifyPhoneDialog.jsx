import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";

import { useState } from "react";

import {
  verifyPhoneChange,
} from "../../services/userService";

const VerifyPhoneDialog = ({
  open,
  onClose,
  fetchUser,
}) => {
  const [otp, setOtp] =
    useState("");

  const handleVerify =
    async () => {
      try {
        await verifyPhoneChange(
          otp
        );

        await fetchUser();

        alert(
          "Phone updated successfully"
        );

        onClose();
      } catch (err) {
        alert(
          err.response?.data
            ?.message
        );
      }
    };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
    >
      <DialogTitle>
        Verify OTP
      </DialogTitle>

      <DialogContent>
        <TextField
          fullWidth
          label="OTP Code"
          margin="normal"
          value={otp}
          onChange={(e) =>
            setOtp(
              e.target.value
            )
          }
        />
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
            handleVerify
          }
        >
          Verify
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerifyPhoneDialog;