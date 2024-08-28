import tryCatch from "../decorators/tryCatch";
import Transaction from "../models/transaction.model";

export class TransactionService {
  private static sequelizeModelTransaction = Transaction;

  @tryCatch()
  public static async createTransaction(
    transactionData: any,
    transaction: any
  ): Promise<void> {
    await this.sequelizeModelTransaction.create(transactionData, {
      transaction,
    });
  }

  public static async listTransactions() {
    return await this.sequelizeModelTransaction.findAll();
  }
}
