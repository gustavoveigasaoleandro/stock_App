import "reflect-metadata";

import { Sequelize } from "sequelize-typescript";

import dotenv from "dotenv";
import Item from "./item.model";
import Transaction from "./transaction.model";

dotenv.config();

const connectionInfo = {
  database: "tecmed-inventory",
  username: "root",
  password: process.env.DB_PASSWORD,
  dialectOptions: {
    host: "localhost",
    port: "3306",
  },
};

export const sequelize = new Sequelize({
  dialect: "mysql",
  ...connectionInfo,
  models: [Item, Transaction],
  benchmark: false,
  // for logging slow queries
  logQueryParameters: true,
  logging: (sql, timing) => {
    if (timing && timing > 200) {
      console.log(sql, timing);
    }
  },
});

export function syncModels() {
  const alter = true;

  sequelize
    .sync({
      alter,
      //disable log when Syncing
      logging: false,
      //logging: console.log
    })
    .then(() => {
      console.log("Synced db.");
    })
    .catch((err) => {
      console.log("Failed to sync db: " + err.message);
    });
}
