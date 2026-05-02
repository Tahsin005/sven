import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import conversationsRouter from "./routes/conversations";
import messagesRouter from "./routes/messages";
import askRouter from "./routes/ask";

const app = express();

app.use(cors({
    origin: "http://localhost:3000"
}));
app.use(express.json());

app.use("/conversations", conversationsRouter);
app.use("/messages", messagesRouter);
app.use("/sven_ask", askRouter);

app.listen(5000, () => console.log("Server is running on port 5000"));