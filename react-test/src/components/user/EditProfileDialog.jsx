import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
} from "@mui/material";

import {
  useState,
  useEffect,
} from "react";

import { updateMe } from "../../services/userService";

const EditProfileDialog = ({
  open,
  onClose,
  user,
  fetchUser,
}) => {
  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSubmit =
    async () => {
      try {
        setLoading(true);

        await updateMe({
          name,
          email,
        });

        await fetchUser();

        onClose();
      } catch (err) {
        console.error(err);

        alert(
          err.response?.data
            ?.message ||
            "Failed to update profile"
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
        Edit Profile
      </DialogTitle>

      <DialogContent>
        <Stack
          spacing={2}
          sx={{ mt: 1 }}
        >
          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
          />

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
          />
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
            ? "Saving..."
            : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditProfileDialog;