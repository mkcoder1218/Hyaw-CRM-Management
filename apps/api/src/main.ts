import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { healthRouter } from "./routes/health";
import { leadsRouter } from "./routes/leads";
import { sopsRouter } from "./routes/sops";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { workspaceRouter } from "./routes/workspace";
import { aiLeadsRouter } from "./routes/ai-leads";
import { startLeadFetcherWorker } from "./workers/lead-fetcher";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/health", healthRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/sops", sopsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/workspace", workspaceRouter);
app.use("/api/ai-leads", aiLeadsRouter);

app.use((req, res) =>
  res.status(404).json({ message: "Route not found", path: req.path }),
);

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API request failed", req.method, req.path, error);
  if (res.headersSent) return;
  res.status(500).json({ message: "Internal server error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Hyaw CRM API listening on http://localhost:${port}`);
  startLeadFetcherWorker();
});
