import { useState } from "react";

import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
} from "@mui/material";

import Layout from "../components/layout/Layout";

import {
  getStatement,
  downloadStatement,
} from "../services/walletService";

const Statement = () => {
  const [from, setFrom] =
    useState("");

  const [to, setTo] =
    useState("");

  const [statement, setStatement] =
    useState(null);

  const handleGenerate =
    async () => {
      try {
        const data =
          await getStatement(
            from,
            to
          );

        setStatement(
          data.statement
        );
      } catch (err) {
        alert(
          err.response?.data
            ?.message
        );
      }
    };

  const handleDownload =
    async () => {
      try {
        const pdf =
          await downloadStatement(
            from,
            to
          );

        const url =
          window.URL.createObjectURL(
            new Blob([pdf])
          );

        const link =
          document.createElement(
            "a"
          );

        link.href = url;

        link.setAttribute(
          "download",
          `statement-${from}-to-${to}.pdf`
        );

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();
      } catch (err) {
        console.log(err);
      }
    };

  return (
    <Layout>
      <Container sx={{ mt: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
        >
          Wallet Statement
        </Typography>

        <Stack
          direction="row"
          spacing={2}
          mb={3}
        >
          <TextField
            type="date"
            label="From"
            InputLabelProps={{
              shrink: true,
            }}
            value={from}
            onChange={(e) =>
              setFrom(
                e.target.value
              )
            }
          />

          <TextField
            type="date"
            label="To"
            InputLabelProps={{
              shrink: true,
            }}
            value={to}
            onChange={(e) =>
              setTo(
                e.target.value
              )
            }
          />

          <Button
            variant="contained"
            onClick={
              handleGenerate
            }
          >
            Generate
          </Button>

          <Button
            variant="outlined"
            onClick={
              handleDownload
            }
          >
            Download PDF
          </Button>
        </Stack>

        {statement && (
          <Card>
            <CardContent>
              <Typography variant="h6">
                Summary
              </Typography>

              <Typography>
                Credits:
                {
                  statement
                    .summary
                    .total_credits
                }{" "}
                EGP
              </Typography>

              <Typography>
                Debits:
                {
                  statement
                    .summary
                    .total_debits
                }{" "}
                EGP
              </Typography>

              <Typography>
                Fees:
                {
                  statement
                    .summary
                    .total_fees
                }{" "}
                EGP
              </Typography>

              <Typography>
                Net Change:
                {
                  statement
                    .summary
                    .net_change
                }{" "}
                EGP
              </Typography>
            </CardContent>
          </Card>
        )}
      </Container>
    </Layout>
  );
};

export default Statement;