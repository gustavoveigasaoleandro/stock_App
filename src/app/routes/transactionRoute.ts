import { Router } from "express";

import { TransactionController } from "../controllers/transactionController";

const router = Router();

router.post(
  "/transaction/create",
  TransactionController.addItem.bind(TransactionController)
);

router.post(
  "/transaction/update",
  TransactionController.updateItem.bind(TransactionController)
);
~~router.get(
  "/transaction/list",
  TransactionController.listTransactions.bind(TransactionController)
);
router.get(
  "/item/list",
  TransactionController.listItems.bind(TransactionController)
);

export default router;
