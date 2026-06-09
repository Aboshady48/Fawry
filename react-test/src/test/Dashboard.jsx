import {
  Box,
  Typography,
  Button,
  Paper,
} from "@mui/material";

import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";

function Dashboard() {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <Layout>
    <Box
      sx={{
        minHeight: "100vh",
        background: "#f4f6f8",
        p: 4,
      }}
    >
      <Paper
        sx={{
          p: 4,
          borderRadius: 4,
        }}
      >
        <Typography variant="h4">
          Welcome {user?.name}
        </Typography>

        <Typography mt={2}>
          Email: {user?.email}
        </Typography>

        <Typography>
          Role: {user?.role}
        </Typography>

        <Typography>
          Phone: {user?.phone}
        </Typography>

        <Button
          variant="contained"
          color="error"
          sx={{ mt: 3 }}
          onClick={logout}
        >
          Logout
        </Button>
      </Paper>
    </Box>
    </Layout>
  );
}

export default Dashboard;