import {
  useEffect,
} from "react";

import {
  getBalance,
} from "../services/walletService";

import {
  useWalletContext,
} from "../context/WalletContext";

export const useWallet = () => {
  const {
    wallet,
    setWallet,
  } = useWalletContext();

  const fetchWallet =
    async () => {
      try {
        const data =
          await getBalance();

        setWallet(data);
      } catch (err) {
        console.log(err);
      }
    };

  useEffect(() => {
    fetchWallet();
  }, []);

  return {
    wallet,
    fetchWallet,
  };
};