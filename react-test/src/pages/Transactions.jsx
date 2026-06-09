import { useEffect, useState } from "react";

import {
  Container,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  CircularProgress,
  Pagination,
} from "@mui/material";

import Layout from "../components/layout/Layout";

import { getTransactions } from "../services/walletService";

const Transactions = () => {
  const [loading, setLoading] =
    useState(true);

  const [transactions, setTransactions] =
    useState([]);

  const [page, setPage] =
    useState(1);

  const [totalPages, setTotalPages] =
    useState(1);

  const fetchTransactions =
    async (currentPage = 1) => {
      try {
        setLoading(true);

        const data =
          await getTransactions({
            page: currentPage,
            limit: 10,
          });

        setTransactions(
          data.transactions
        );

        setTotalPages(
          data.total_pages
        );
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchTransactions(page);
  }, [page]);

  return (
    <Layout>
      <Container sx={{ mt: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
        >
          Transactions
        </Typography>

        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Paper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      Reference
                    </TableCell>

                    <TableCell>
                      Type
                    </TableCell>

                    <TableCell>
                      Amount
                    </TableCell>

                    <TableCell>
                      Fee
                    </TableCell>

                    <TableCell>
                      Status
                    </TableCell>

                    <TableCell>
                      Date
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {transactions.map(
                    (tx) => (
                      <TableRow
                        key={tx.id}
                      >
                        <TableCell>
                          {
                            tx.reference_no
                          }
                        </TableCell>

                        <TableCell>
                          {tx.type}
                        </TableCell>

                        <TableCell>
                          {tx.amount} EGP
                        </TableCell>

                        <TableCell>
                          {tx.fee} EGP
                        </TableCell>

                        <TableCell>
                          {tx.status}
                        </TableCell>

                        <TableCell>
                          {new Date(
                            tx.created_at
                          ).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </Paper>

            <Pagination
              sx={{ mt: 3 }}
              page={page}
              count={totalPages}
              onChange={(
                _,
                value
              ) =>
                setPage(value)
              }
            />
          </>
        )}
      </Container>
    </Layout>
  );
};

export default Transactions;