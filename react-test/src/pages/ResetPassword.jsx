import { useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { resetPassword } from "../api/authApi";

import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
} from "@mui/material";

function ResetPassword() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const token =
    searchParams.get("token");

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError(
        "Invalid reset link"
      );
      return;
    }

    if (
      !newPassword ||
      !confirmPassword
    ) {
      setError(
        "All fields are required"
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match"
      );
      return;
    }

    try {
      setLoading(true);

      const res =
        await resetPassword({
          token,
          newPassword,
        });

      setSuccess(
        res.data.message
      );

      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Password reset failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Paper
        elevation={10}
        sx={{
          width: "100%",
          p: 4,
          borderRadius: 4,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            textAlign: "center",
            mb: 3,
          }}
        >
          Reset Password
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {success}
          </Alert>
        )}

        <form onSubmit={submit}>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            autoComplete="new-password"
            margin="normal"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(
                e.target.value
              )
            }
          />

          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            margin="normal"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
          />

          <Button
            fullWidth
            variant="contained"
            type="submit"
            disabled={loading}
            sx={{
              mt: 2,
              py: 1.5,
            }}
          >
            {loading
              ? "Resetting..."
              : "Reset Password"}
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default ResetPassword;