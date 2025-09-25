const express = require("express");
const app = express();
app.use(express.json());

// Routes
app.use("/users", require("./routes/users"));
app.use("/actionsheets", require("./routes/actionsheets"));

const PORT = 4000;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
