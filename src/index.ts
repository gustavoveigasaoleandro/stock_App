import express from "express";
import { syncModels } from "./app/models/index.js";
import routes from "./app/routes/index.js";
import errorHandler from "./app/middleware/errorHandler.js";
import { startConsumer } from "./app/utils/validateAndAuthorize/index.js";

const app = express();

const port = 3000;

routes(app);

startConsumer().catch(console.error);
app.listen(port, () => {
  console.log(`O server esta rodando na porta ${port}`);
});

app.use(errorHandler);

syncModels();
