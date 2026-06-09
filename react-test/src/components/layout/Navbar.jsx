import { useState } from "react";

import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Menu,
  MenuItem,
} from "@mui/material";

import {
  Link,
  useNavigate,
} from "react-router-dom";

const Navbar = () => {
  const navigate =
    useNavigate();

  const [profileAnchor, setProfileAnchor] =
    useState(null);

  const [walletAnchor, setWalletAnchor] =
    useState(null);

  const handleLogout = () => {
    localStorage.removeItem(
      "accessToken"
    );

    navigate("/login");
  };

  return (
    <AppBar
      position="sticky"
      elevation={1}
    >
      <Toolbar>
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1,
            fontWeight: 700,
            cursor: "pointer",
          }}
          onClick={() =>
            navigate("/dashboard")
          }
        >
          Fawry
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 1,
          }}
        >
          {/* Dashboard */}
          <Button
            color="inherit"
            component={Link}
            to="/dashboard"
          >
            Dashboard
          </Button>

          {/* Profile Menu */}
          <Button
            color="inherit"
            onClick={(e) =>
              setProfileAnchor(
                e.currentTarget
              )
            }
          >
            Profile
          </Button>

          <Menu
            anchorEl={profileAnchor}
            open={Boolean(
              profileAnchor
            )}
            onClose={() =>
              setProfileAnchor(
                null
              )
            }
          >
            <MenuItem
              component={Link}
              to="/profile"
              onClick={() =>
                setProfileAnchor(
                  null
                )
              }
            >
              My Profile
            </MenuItem>

            <MenuItem
              component={Link}
              to="/set-pin"
              onClick={() =>
                setProfileAnchor(
                  null
                )
              }
            >
              Set PIN
            </MenuItem>

            <MenuItem
              component={Link}
              to="/change-pin"
              onClick={() =>
                setProfileAnchor(
                  null
                )
              }
            >
              Change PIN
            </MenuItem>
          </Menu>

          {/* Wallet Menu */}
          <Button
            color="inherit"
            onClick={(e) =>
              setWalletAnchor(
                e.currentTarget
              )
            }
          >
            Wallet
          </Button>

          <Menu
            anchorEl={walletAnchor}
            open={Boolean(
              walletAnchor
            )}
            onClose={() =>
              setWalletAnchor(
                null
              )
            }
          >
            <MenuItem
              component={Link}
              to="/wallet"
              onClick={() =>
                setWalletAnchor(
                  null
                )
              }
            >
              Wallet Overview
            </MenuItem>

            <MenuItem
              component={Link}
              to="/transactions"
              onClick={() =>
                setWalletAnchor(
                  null
                )
              }
            >
              Transactions
            </MenuItem>

            <MenuItem
              component={Link}
              to="/statement"
              onClick={() =>
                setWalletAnchor(
                  null
                )
              }
            >
              Statement
            </MenuItem>
          </Menu>

          {/* Logout */}
          <Button
            color="inherit"
            onClick={
              handleLogout
            }
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;