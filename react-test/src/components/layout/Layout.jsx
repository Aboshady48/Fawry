import { Box } from "@mui/material";
import Navbar from "./Navbar";

const Layout = ({ children }) => {
  return (
    <>
      <Navbar />

      <Box sx={{ p: 3 }}>
        {children}
      </Box>
    </>
  );
};

export default Layout;