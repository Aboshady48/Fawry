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
  requestPhoneChange,
} from "../../services/userService";

import VerifyPhoneDialog from "./VerifyPhoneDialog";

const ChangePhoneDialog = ({
  open,
  onClose,
  fetchUser,
}) => {
  const [newPhone, setNewPhone] =
    useState("");

  const [verifyOpen,
    setVerifyOpen] =
    useState(false);

  const handleSendOtp =
    async () => {
      try {
        const res =
          await requestPhoneChange(
            newPhone
          );

        if (res.otp) {
          alert(
            `DEV OTP: ${res.otp}`
          );
        }

        setVerifyOpen(true);
      } catch (err) {
        alert(
          err.response?.data
            ?.message
        );
      }
    };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
      >
        <DialogTitle>
          Change Phone
        </DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="New Phone Number"
            value={newPhone}
            onChange={(e) =>
              setNewPhone(
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
              handleSendOtp
            }
          >
            Send OTP
          </Button>
        </DialogActions>
      </Dialog>

      <VerifyPhoneDialog
        open={verifyOpen}
        onClose={() => {
          setVerifyOpen(false);
          onClose();
        }}
        fetchUser={fetchUser}
      />
    </>
  );
};

export default ChangePhoneDialog;