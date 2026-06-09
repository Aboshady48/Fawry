import { useState } from "react";
import { setPin } from "../api/authApi";

import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
} from "@mui/material";

function SetPin() {
  const [pin, setPinState] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    const res = await setPin({
      pin,
    });

    alert(res.data.message);
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4">
          Set PIN
        </Typography>

        <form onSubmit={submit}>
          <TextField
            fullWidth
            label="PIN"
            margin="normal"
            value={pin}
            onChange={(e) =>
              setPinState(e.target.value)
            }
          />

          <Button
            fullWidth
            variant="contained"
            type="submit"
          >
            Save PIN
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default SetPin;