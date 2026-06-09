import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { forgotPassword } from "../api/authApi";

import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
} from "@mui/material";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      const res = await forgotPassword({
        email: email.trim(),
      });

      console.log("Forgot Password Response:", res.data);

      if (res.data.resetToken) {
        localStorage.setItem(
          "resetToken",
          res.data.resetToken
        );

        console.log(
          "Token Saved:",
          res.data.resetToken
        );
      }

      setMessage(res.data.message);

      setTimeout(() => {
        navigate("/reset-password");
      }, 1500);

    } catch (err) {
      console.log(
        "Forgot Password Error:",
        err.response?.data
      );

      setError(
        err.response?.data?.message ||
        "Something went wrong"
      );
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper
        sx={{
          p: 4,
          mt: 8,
          borderRadius: 4,
        }}
      >
        <Typography
          variant="h4"
          textAlign="center"
          mb={3}
        >
          Forgot Password
        </Typography>

        {message && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={submit}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            margin="normal"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <Button
            fullWidth
            variant="contained"
            type="submit"
            sx={{
              mt: 2,
              py: 1.5,
            }}
          >
            Send Reset Link
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default ForgotPassword;