import api from "../api/axios";

export const getMe = async () => {
  const res = await api.get("/user/me");
  return res.data;
};

export const updateMe = async (data) => {
  const res = await api.put("/user/me", data);
  return res.data;
};

export const requestPhoneChange = async (
  newPhone
) => {
  const res = await api.post(
    "/user/me/change-phone",
    { newPhone }
  );

  return res.data;
};

export const verifyPhoneChange =
  async (otp) => {
    const res = await api.post(
      "/user/me/change-phone/verify",
      { otp }
    );

    return res.data;
  };

export const uploadAvatar =
  async (file) => {
    const formData =
      new FormData();

    formData.append(
      "avatar",
      file
    );

    const response =
      await api.post(
        "/user/me/avatar",
        formData
      );

    return response.data;
  };

