import { useEffect } from "react";

import { getMe } from "../services/userService";
import { useUserContext } from "../context/UserContext";

export const useUser = () => {
  const {
    user,
    setUser,
  } = useUserContext();

  const fetchUser =
    async () => {
      try {
        const data =
          await getMe();

        setUser(data);
      } catch (err) {
        console.log(err);
      }
    };

  useEffect(() => {
    fetchUser();
  }, []);

  return {
    user,
    fetchUser,
  };
};