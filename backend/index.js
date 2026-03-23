// ✅ dotenv MUST be first before anything else
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const { connectDB } = require("./config/db");
const indexRouter = require("./router/index.route");

app.use(express.json());
app.use("/api/v1", indexRouter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
});