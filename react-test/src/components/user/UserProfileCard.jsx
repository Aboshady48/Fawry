import {
  Card,
  CardContent,
  Typography,
  Avatar,
  Stack,
  Button,
} from "@mui/material";

import { useState } from "react";

import { useUser } from "../../hooks/useUser";

import AvatarUpload from "./AvatarUpload";
import EditProfileDialog from "./EditProfileDialog";

const UserProfileCard = ({
  openPhoneDialog,
}) => {
  const {
    user,
    fetchUser,
  } = useUser();

  const [openEdit, setOpenEdit] =
    useState(false);

  if (!user) return null;

  return (
    <>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Avatar
              src={
                user.avatar_url ||
                ""
              }
              alt={user.name}
              sx={{
                width: 120,
                height: 120,
              }}
            />

            <AvatarUpload
              fetchUser={
                fetchUser
              }
            />

            <Typography variant="h5">
              {user.name}
            </Typography>

            <Typography>
              Email:
              {" "}
              {user.email}
            </Typography>

            <Typography>
              Phone:
              {" "}
              {user.phone}
            </Typography>

            <Typography>
              Role:
              {" "}
              {user.role}
            </Typography>

            <Typography>
              Status:
              {" "}
              {user.status}
            </Typography>

            <Button
              variant="contained"
              onClick={() =>
                setOpenEdit(
                  true
                )
              }
            >
              Edit Profile
            </Button>

            <Button
              variant="outlined"
              onClick={
                openPhoneDialog
              }
            >
              Change Phone
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <EditProfileDialog
        open={openEdit}
        onClose={() =>
          setOpenEdit(
            false
          )
        }
        user={user}
        fetchUser={fetchUser}
      />
    </>
  );
};

export default UserProfileCard;