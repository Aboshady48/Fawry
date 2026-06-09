import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link as MuiLink,
} from "@mui/material";

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setError("");

    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!form.email || !form.password) {
      setError("Email and password are required");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
        "/auth/login",
        form
      );

      const {
        accessToken,
        refreshToken,
        user,
      } = response.data;

      localStorage.setItem(
        "accessToken",
        accessToken
      );

      localStorage.setItem(
        "refreshToken",
        refreshToken
      );

      localStorage.setItem(
        "user",
        JSON.stringify(user)
      );

      navigate("/dashboard");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)",
        p: 2,
      }}
    >
      <Paper
        elevation={20}
        sx={{
          width: "100%",
          maxWidth: 450,
          p: 5,
          borderRadius: 5,
        }}
      >
        <Typography
          variant="h4"
          fontWeight="bold"
          textAlign="center"
          gutterBottom
        >
          Welcome Back
        </Typography>

        <Typography
          textAlign="center"
          color="text.secondary"
          mb={4}
        >
          Login to your wallet account
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
        >
          <TextField
            label="Email Address"
            name="email"
            type="email"
            fullWidth
            margin="normal"
            value={form.email}
            onChange={handleChange}
          />

          <TextField
            label="Password"
            name="password"
            type="password"
            fullWidth
            margin="normal"
            value={form.password}
            onChange={handleChange}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{
              mt: 3,
              py: 1.5,
              borderRadius: 3,
            }}
          >
            {loading ? (
              <CircularProgress
                size={24}
                color="inherit"
              />
            ) : (
              "Login"
            )}
          </Button>

          <Box
            sx={{
              display: "flex",
              justifyContent:
                "space-between",
              mt: 3,
            }}
          >
            <MuiLink
              component={Link}
              to="/forgot-password"
              underline="hover"
            >
              Forgot Password?
            </MuiLink>

            <MuiLink
              component={Link}
              to="/"
              underline="hover"
            >
              Create Account
            </MuiLink>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;