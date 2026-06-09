import {
  Button,
  CircularProgress,
} from "@mui/material";

import { useState } from "react";

import {
  uploadAvatar,
} from "../../services/userService";

const AvatarUpload = ({
  fetchUser,
}) => {
  const [loading, setLoading] =
    useState(false);

  const handleUpload =
    async (e) => {
      const file =
        e.target.files?.[0];

      if (!file) return;

      try {
        setLoading(true);

        await uploadAvatar(file);

        await fetchUser();
      } catch (err) {
        console.error(err);

        alert(
          err.response?.data
            ?.message ||
            "Upload failed"
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <>
      <input
        hidden
        id="avatar-upload"
        type="file"
        accept="image/*"
        onChange={
          handleUpload
        }
      />

      <label htmlFor="avatar-upload">
        <Button
          component="span"
          variant="outlined"
          disabled={loading}
        >
          {loading ? (
            <CircularProgress
              size={20}
            />
          ) : (
            "Upload Avatar"
          )}
        </Button>
      </label>
    </>
  );
};

export default AvatarUpload;