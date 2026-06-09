// ✅ dotenv MUST be first before anything else
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const { connectDB } = require("./config/db");
const indexRouter = require("./router/index.route");

// At the very top, after creating the app
const cors = require('cors');

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Or simply allow everything during development (quick & dirty)

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