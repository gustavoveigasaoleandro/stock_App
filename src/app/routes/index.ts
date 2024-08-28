import { Application } from "express";
import bodyParser from "body-parser";
import transactionRoute from "./transactionRoute";

const routes = (app: Application): void => {
  app.use(bodyParser.json());
  app.use(transactionRoute);
  app.get("/", (req, res) => res.status(200).send("Hi"));
};

export default routes;
