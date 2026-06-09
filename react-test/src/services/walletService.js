import api from "../api/axios";

export const getBalance = async () => {
  const res = await api.get("/wallet/balance");
  return res.data;
};

export const topupWallet = async (data) => {
  const res = await api.post(
    "/wallet/topup",
    data
  );

  return res.data;
};

export const withdrawWallet = async (
  data
) => {
  const res = await api.post(
    "/wallet/withdraw",
    data
  );

  return res.data;
};

export const getTransactions =
  async (params = {}) => {
    const res = await api.get(
      "/wallet/transactions",
      {
        params,
      }
    );

    return res.data;
  };

export const getStatement = async (
  from,
  to
) => {
  const res = await api.get(
    "/wallet/statement",
    {
      params: {
        from,
        to,
      },
    }
  );

  return res.data;
};

export const downloadStatement =
  async (from, to) => {
    const res = await api.get(
      "/wallet/statement",
      {
        params: {
          from,
          to,
          format: "pdf",
        },
        responseType: "blob",
      }
    );

    return res.data;
  };