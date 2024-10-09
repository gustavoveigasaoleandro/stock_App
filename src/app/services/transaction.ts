import Transaction from "../models/transaction.model";

export class TransactionService {
  private static sequelizeModelTransaction = Transaction;

  public static async createTransaction(
    transactionData: any,
    transaction: any
  ): Promise<any> {
    try {
      const newTransaction = await this.sequelizeModelTransaction.create(
        transactionData,
        {
          transaction,
        }
      );
      return { success: true, data: newTransaction }; // Retorna um objeto com status de sucesso
    } catch (error) {
      console.log(error);
      return { success: false, error }; // Retorna o erro com detalhes
    }
  }

  public static async listTransactions(conditions: any) {
    return await this.sequelizeModelTransaction.findAll({
      where: conditions.where,
    });
  }

  // Método para encontrar uma transação pelo ID
  public static async findTransactionById(
    transactionId: number,
    whereCondition: Record<string, any>
  ): Promise<any> {
    try {
      const transaction = await this.sequelizeModelTransaction.findOne({
        where: {
          id: transactionId, // Aqui o ID
          ...whereCondition, // Outras condições que você queira adicionar
        },
      });
      if (!transaction) {
        return { error: `Transaction with ID ${transactionId} not found` };
      }
      return { success: true, data: transaction }; // Retorna um objeto com status de sucesso
    } catch (error) {
      return { success: false, error }; // Retorna o erro com detalhes
    }
  }

  // Método para deletar uma transação pelo ID
  public static async deleteTransactionById(
    transactionId: number,
    transaction: any
  ): Promise<any> {
    try {
      const existingTransaction = await this.sequelizeModelTransaction.findByPk(
        transactionId
      );
      if (!existingTransaction) {
        return { error: `Transaction with ID ${transactionId} not found` };
      }

      await this.sequelizeModelTransaction.destroy({
        where: { id: transactionId },
        transaction,
      });

      return {
        success: true,
        message: `Transaction with ID ${transactionId} deleted successfully`,
      };
    } catch (error) {
      return { success: false, error: error }; // Retorna o erro em caso de falha
    }
  }
}
