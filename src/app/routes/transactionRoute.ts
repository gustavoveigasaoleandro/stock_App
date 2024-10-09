import { Router } from "express";

import { TransactionController } from "../controllers/transactionController";

const router = Router();

router.post(
  "/transaction/create",
  TransactionController.createItem.bind(TransactionController)
);

router.post(
  "/transaction/update",
  TransactionController.updateItem.bind(TransactionController)
);
router.post(
  "/transaction/add",
  TransactionController.addItem.bind(TransactionController)
);
router.post(
  "/transaction/remove",
  TransactionController.subtractItem.bind(TransactionController)
);
router.get(
  "/transaction/list",
  TransactionController.listTransactions.bind(TransactionController)
);
router.get(
  "/item/list",
  TransactionController.listItems.bind(TransactionController)
);

router.get(
  "/transaction/findById",
  TransactionController.getTransactionById.bind(TransactionController)
);

router.get(
  "/item/findById",
  TransactionController.getItemById.bind(TransactionController)
);

export default router;
