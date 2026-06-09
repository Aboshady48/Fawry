import { useState } from "react";
import { verifyOtp } from "../api/authApi";

import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
} from "@mui/material";

function VerifyOtp() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    try {
      const res = await verifyOtp({
        phone,
        code,
      });

      setMessage(res.data.message);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4">
          Verify OTP
        </Typography>

        {message && (
          <Alert severity="success">
            {message}
          </Alert>
        )}

        {error && (
          <Alert severity="error">
            {error}
          </Alert>
        )}

        <form onSubmit={submit}>
          <TextField
            fullWidth
            label="Phone"
            margin="normal"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value)
            }
          />

          <TextField
            fullWidth
            label="OTP"
            margin="normal"
            value={code}
            onChange={(e) =>
              setCode(e.target.value)
            }
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            sx={{ mt: 2 }}
          >
            Verify
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default VerifyOtp;   