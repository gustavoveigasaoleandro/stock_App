import { ValidResponse } from "../../interface/validResponse";
import { Request, Response } from "express";
import { RabbitMQService } from "../rabbitMQ";
import { v4 as uuidv4 } from "uuid";
import { createTimeoutPromise } from "../createTimeoutPromise";
import { processResponse } from "../processResponse";
import { ResponseStructure } from "../../interface/authorization_responseStructure";
import { ItemService } from "../../services/item";
import { sequelize } from "../../models";
import { TransactionService } from "../../services/transaction";
import dotenv from "dotenv";

dotenv.config();
const rabbitMQService = new RabbitMQService();
export async function validateAndAuthorize(
  req: Request,
  res: Response
): Promise<ValidResponse | Response<any>> {
  const authorizationHeader = req.headers.authorization;
  const correlationId = uuidv4();
  type ResponseType = ResponseStructure | { error: string };

  try {
    await rabbitMQService.publishToExchange(
      "authorization.ex",
      "",
      "authorization.stock",
      {
        token: authorizationHeader,
      },
      correlationId,
      "authorization.response_ex"
    );

    const timeout = parseInt(process.env.TIMEOUT) || 15000;
    const timeoutPromise = createTimeoutPromise<ResponseType>(timeout);
    const isListening = { value: true };

    const response: ResponseType = await Promise.race([
      rabbitMQService
        .listenForResponse(
          "authorization.response_stock",
          correlationId,
          isListening
        )
        .then((result) => {
          isListening.value = false;
          return result;
        }),
      timeoutPromise.then(() => {
        isListening.value = false;
        throw new Error("Timeout: Nenhuma resposta recebida a tempo.");
      }),
    ]);

    console.log(response);

    // Após receber a resposta correta, finalize qualquer operação de timeout imediatamente
    if (isListening.value) {
      isListening.value = false; // Certifique-se de que a escuta é cancelada
    }

    const access: ValidResponse = processResponse(
      response,
      res,
      "ROLE_TECHNICIAN"
    );

    if (!access.valid) {
      return res.status(403).json({ error: "acesso negado" });
    }

    return access;
  } catch (error) {
    console.error("Erro na validação e autorização:", error);
    return res
      .status(500)
      .json({ error: "Erro interno ao validar e autorizar o usuário." });
  }
}

export function isValidResponse(access: any): access is ValidResponse {
  return (access as ValidResponse).valid !== undefined;
}

// Função para verificar se os itens existem e possuem quantidade suficiente
async function validateItems(
  items: any[],
  companie_id: number,
  transaction: any
) {
  for (const item of items) {
    const existingItem = await ItemService.findItem({
      where: { item_id: item.item_id, companie_id },
      transaction,
    });

    if (!existingItem) {
      throw new Error(`Item com o ID '${item.item_id}' não encontrado.`);
    }

    if (existingItem.dataValues.amount < item.amount) {
      throw new Error(`Quantidade insuficiente para o item '${item.item_id}'.`);
    }
  }
}

// Função para devolver os valores dos itens ao estoque, removendo transações antigas
async function restoreStockFromTransactions(
  transactionIds: number[],
  companie_id: number,
  transaction: any
) {
  for (const transactionId of transactionIds) {
    const existingTransaction = await TransactionService.findTransactionById(
      transactionId,
      {
        companie_id,
      }
    );

    if (!existingTransaction.success) {
      throw new Error(existingTransaction.error);
    }

    // Remove a transação
    const deleteResult = await TransactionService.deleteTransactionById(
      transactionId,
      transaction
    );
    if (!deleteResult.success) {
      throw new Error(deleteResult.error);
    }

    // Devolve os valores dos itens ao estoque
    const existingItem = await ItemService.findItem({
      where: {
        item_id: existingTransaction.data.dataValues.item_id,
        companie_id,
      },
      transaction,
    });

    const restoredAmount =
      existingItem.dataValues.amount +
      existingTransaction.data.dataValues.amount;
    await ItemService.updateItem(
      existingItem,
      { amount: restoredAmount },
      transaction
    );
  }
}

// Função para criar novas transações e atualizar os itens
async function createNewTransactions(
  items: any[],
  companie_id: number,
  client_id: number,
  technician_id: number,
  transaction: any
) {
  const transactionIdsArray = [];

  for (const item of items) {
    const existingItem = await ItemService.findItem({
      where: { item_id: item.item_id, companie_id },
      transaction,
    });

    // Subtrai a quantidade do estoque
    const newAmount = existingItem.dataValues.amount - item.amount;
    await ItemService.updateItem(
      existingItem,
      { amount: newAmount },
      transaction
    );

    // Cria a nova transação
    const transactionValue = item.amount * existingItem.dataValues.price;
    const newTransaction = await TransactionService.createTransaction(
      {
        type: true, // true para saída
        amount: item.amount,
        cost: transactionValue,
        item_id: existingItem.dataValues.item_id,
        companie_id,
        date: new Date(),
        client_id,
        technician_id,
      },
      transaction
    );

    if (!newTransaction.success) {
      throw new Error(
        `Falha ao registrar a transação para o item ID ${item.item_id}`
      );
    }

    transactionIdsArray.push(newTransaction.data.dataValues.id); // Adiciona o ID da transação ao array
  }

  return transactionIdsArray;
}

// Função principal que faz a validação da ordem de serviço e gerencia o fluxo geral
export async function handleServiceOrder(msg: any, properties: any) {
  const { client_id, companie_id, technician_id, items, transactionIds } = msg;
  const correlationId = properties.correlationId;
  const replyTo = properties.replyTo;

  const transaction = await sequelize.transaction(); // Inicia a transação

  try {
    // Valida os itens e suas quantidades
    await validateItems(items, companie_id, transaction);

    // Se houver transações anteriores, restaura o estoque
    if (transactionIds && transactionIds.length > 0) {
      await restoreStockFromTransactions(
        transactionIds,
        companie_id,
        transaction
      );
    }

    // Cria novas transações e subtrai o estoque
    const newTransactionIds = await createNewTransactions(
      items,
      companie_id,
      client_id,
      technician_id,
      transaction
    );

    // Commit final para todas as operações
    await transaction.commit();

    // Responde com sucesso
    const successMessage = {
      message: "Itens subtraídos com sucesso e transações registradas.",
      transactionIds: newTransactionIds,
      correlationId,
    };
    await rabbitMQService.publishToExchange(
      replyTo,
      "",
      "",
      successMessage,
      correlationId,
      replyTo
    );
  } catch (error) {
    // Rollback em caso de erro
    await transaction.rollback();
    console.error("Erro ao processar a mensagem:", error);
    const errorMessage = {
      error: "Erro interno ao processar a mensagem.",
      correlationId,
    };
    await rabbitMQService.publishToExchange(
      replyTo,
      "",
      "",
      errorMessage,
      correlationId,
      replyTo
    );
  }
}

export async function startConsumer() {
  const rabbitMQService = new RabbitMQService();

  await rabbitMQService.consume(
    "service_order.stock_request",
    async (msg: any, properties: any) => {
      await handleServiceOrder(msg, properties);
    }
  );
}
