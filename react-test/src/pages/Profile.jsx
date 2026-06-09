import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Container,
  Grid,
  Button,
} from "@mui/material";

import UserProfileCard from "../components/user/UserProfileCard";
import WalletInfoCard from "../components/user/WalletInfoCard";
import ChangePhoneDialog from "../components/user/ChangePhoneDialog";
import Layout from "../components/layout/Layout";

import { useUser } from "../hooks/useUser";

const Profile = () => {
  const {
    user,
    fetchUser,
  } = useUser();

  const navigate =
    useNavigate();

  const [
    phoneDialogOpen,
    setPhoneDialogOpen,
  ] = useState(false);

  if (!user) {
    return <h2>Loading...</h2>;
  }

  return (
    <Layout>
      <Container
        maxWidth="lg"
        sx={{ mt: 4 }}
      >
        <Grid
          container
          spacing={3}
        >
          <Grid
            size={{
              xs: 12,
              md: 8,
            }}
          >
            <UserProfileCard
              openPhoneDialog={() =>
                setPhoneDialogOpen(
                  true
                )
              }
            />
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 4,
            }}
          >
            <WalletInfoCard />

            <Button
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() =>
                navigate(
                  "/wallet"
                )
              }
            >
              Open Wallet
            </Button>
          </Grid>
        </Grid>

        <ChangePhoneDialog
          open={phoneDialogOpen}
          onClose={() =>
            setPhoneDialogOpen(
              false
            )
          }
          fetchUser={fetchUser}
        />
      </Container>
    </Layout>
  );
};

export default Profile;