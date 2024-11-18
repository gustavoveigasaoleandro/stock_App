import tryCatch from "../../decorators/tryCatch";
import { Request, Response } from "express";
import Joi from "joi";
import AppError from "../../appError";
import {
  INVALID_FIELDS,
  LIMIT_EXCEEDED,
  NOT_FOUND,
} from "../../constants/errorCodes";

import { sequelize } from "../../models";
import {
  isValidResponse,
  validateAndAuthorize,
} from "../../utils/validateAndAuthorize";
import { TransactionService } from "../../services/transaction";
import { ItemService } from "../../services/item";
import { Op } from "sequelize";

export class TransactionController {
  @tryCatch()
  static async createItem(req: Request, res: Response): Promise<Response<any>> {
    const schema = Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),

      price: Joi.number().precision(2).required(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      throw new AppError(INVALID_FIELDS, "invalid item structure", 400);
    }

    const transaction = await sequelize.transaction();

    const access = await validateAndAuthorize(req, res);

    // Verifica se o tipo de `access` é `ValidResponse`
    if (isValidResponse(access)) {
      const existingItem = await ItemService.listItems({
        where: { name: req.body.name, companie_id: access.companyId },
      });

      if (existingItem.length > 0) {
        await transaction.rollback();
        throw new AppError(INVALID_FIELDS, "Record already exists", 400);
      }

      await ItemService.createItem(
        { ...req.body, companie_id: access.companyId, amount: 0 },
        transaction
      );

      await transaction.commit();

      return res.status(201).json({
        message: "Item created successfully.",
      });
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
      return access;
    }
  }

  @tryCatch()
  static async addItem(req: Request, res: Response): Promise<Response<any>> {
    const schema = Joi.object({
      item_id: Joi.number().integer().required(),
      amount: Joi.number().integer().positive().required(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      throw new AppError(INVALID_FIELDS, "invalid item structure", 400);
    }

    const transaction = await sequelize.transaction();

    const access = await validateAndAuthorize(req, res);

    if (isValidResponse(access)) {
      const existingItem = await ItemService.findItem({
        where: { item_id: req.body.item_id, companie_id: access.companyId },
      });

      if (!existingItem) {
        await transaction.rollback();
        throw new AppError(
          INVALID_FIELDS,
          `Item com o ID '${req.body.item_id}' não existe.`,
          404
        );
      }
      const newamount = existingItem.dataValues.amount + req.body.amount;
      await ItemService.updateItem(
        existingItem,
        { amount: newamount },
        transaction
      );

      const transactionValue = req.body.amount * existingItem.dataValues.price;

      await TransactionService.createTransaction(
        {
          companie_id: access.companyId,
          amount: req.body.amount,
          cost: transactionValue,
          type: false,
          item_id: existingItem.dataValues.item_id,
          date: new Date(),
        },
        transaction
      );

      await transaction.commit();
      return res.status(200).json({
        message: "Item adicionado com sucesso e transação registrada.",
      });
    } else {
      return access;
    }
  }

  @tryCatch()
  static async subtractItem(
    req: Request,
    res: Response
  ): Promise<Response<any>> {
    const schema = Joi.object({
      item_id: Joi.number().integer().required(),
      amount: Joi.number().integer().positive().required(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      throw new AppError(INVALID_FIELDS, "invalid item structure", 400);
    }

    const transaction = await sequelize.transaction();

    const access = await validateAndAuthorize(req, res);

    if (isValidResponse(access)) {
      const existingItem = await ItemService.findItem({
        where: { item_id: req.body.item_id, companie_id: access.companyId },
      });

      if (!existingItem) {
        await transaction.rollback();
        throw new AppError(
          INVALID_FIELDS,
          `Item com o ID '${req.body.item_id}' não existe.`,
          404
        );
      }

      if (existingItem.dataValues.amount === 0) {
        await transaction.rollback();
        throw new AppError(
          LIMIT_EXCEEDED,
          `Não há itens em estoque para subtrair.`,
          400
        );
      }

      if (existingItem.dataValues.amount < req.body.amount) {
        await transaction.rollback();
        throw new AppError(
          LIMIT_EXCEEDED,
          `Quantidade insuficiente no estoque.`,
          400
        );
      }

      const newamount = existingItem.dataValues.amount - req.body.amount;
      await ItemService.updateItem(
        existingItem,
        { amount: newamount },
        transaction
      );

      const transactionValue = req.body.amount * existingItem.dataValues.price;

      await TransactionService.createTransaction(
        {
          companie_id: access.companyId,
          type: true, // true para saída
          amount: req.body.amount,
          cost: transactionValue,
          item_id: existingItem.dataValues.item_id,
          date: new Date(),
        },
        transaction
      );

      await transaction.commit();
      return res.status(200).json({
        message: "Item subtraído com sucesso e transação registrada.",
      });
    } else {
      return access;
    }
  }

  // Método auxiliar para verificar se `access` é `ValidResponse`

  @tryCatch()
  static async updateItem(req: Request, res: Response): Promise<Response<any>> {
    const schema = Joi.object({
      Transaction: {
        type: Joi.boolean().required(),
        amount: Joi.number().precision(2).required(),
        date: Joi.date().iso().required(),
      },
      Item: {
        name: Joi.string().required(),
        description: Joi.string().optional(),
        amount: Joi.number().integer().required(),
        price: Joi.number().precision(2).required(),
      },
    });

    const { error } = schema.validate(req.body);
    if (error) {
      throw new AppError(INVALID_FIELDS, "invalid transaction structure", 400);
    }

    const transaction = await sequelize.transaction();

    const access = await validateAndAuthorize(req, res);

    if (isValidResponse(access)) {
      const existingItem = await ItemService.findItem({
        where: { name: req.body.Item.name, companie_id: access.companyId },
      });

      if (!existingItem) {
        await transaction.rollback();
        throw new AppError(
          INVALID_FIELDS,
          `Item com o nome '${req.body.Item.name}' não existe.`,
          404
        );
      }

      await ItemService.updateItem(
        existingItem,
        { ...req.body.Item, companie_id: access.companyId },
        transaction
      );

      await TransactionService.createTransaction(
        { ...req.body.Transaction, item_id: existingItem.item_id },
        transaction
      );

      await transaction.commit();
      return res.status(200).json({
        message: "Item and Transaction updated successfully.",
      });
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
      return access;
    }
  }

  @tryCatch()
  static async listTransactions(
    req: Request,
    res: Response
  ): Promise<Response<any>> {
    // Valida e autoriza o usuário antes de listar as transações
    const access = await validateAndAuthorize(req, res);

    // Verifica se o tipo de `access` é `ValidResponse`
    if (isValidResponse(access)) {
      // Captura os parâmetros opcionais da requisição
      const { startDate, endDate, itemId, type } = req.query;

      // Cria a condição de filtro base para a consulta
      const whereCondition: any = {};

      // Filtra por intervalo de datas, se fornecido
      if (startDate && endDate) {
        whereCondition.date = {
          [Op.between]: [
            new Date(startDate as string).toISOString(),
            new Date(endDate as string).toISOString(),
          ],
        };
      } else if (startDate) {
        whereCondition.date = {
          [Op.gte]: new Date(startDate as string).toISOString(),
        };
      } else if (endDate) {
        whereCondition.date = {
          [Op.lte]: new Date(endDate as string).toISOString(),
        };
      }

      // Filtra pelo itemId, se fornecido
      if (itemId) {
        whereCondition.item_id = parseInt(itemId as string, 10);
      }

      // Filtra pelo tipo, se fornecido (supondo que `type` seja um boolean ou string)
      if (type) {
        whereCondition.type = type === "true"; // Converte para booleano
      }
      whereCondition.companie_id = access.companyId;
      // Executa a consulta filtrada
      const transactions = await TransactionService.listTransactions({
        where: whereCondition,
      });

      return res.status(200).json(transactions);
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
      return access;
    }
  }

  @tryCatch()
  static async getTransactionById(
    req: Request,
    res: Response
  ): Promise<Response<any>> {
    // Valida e autoriza o usuário antes de listar a transação
    const access = await validateAndAuthorize(req, res);

    if (isValidResponse(access)) {
      // Validação do parâmetro ID da query string
      const schema = Joi.object({
        transactionId: Joi.string().required(), // Aceita string que será convertida
      });

      const { error } = schema.validate(req.query);
      if (error) {
        throw new AppError(
          INVALID_FIELDS,
          "Invalid transaction ID format",
          400
        );
      }

      const transactionId = parseInt(req.query.transactionId as string, 10); // Transforma de string para número

      if (isNaN(transactionId)) {
        throw new AppError(
          INVALID_FIELDS,
          "Transaction ID must be a number",
          400
        );
      }

      // Busca a transação pelo ID
      const transaction = await TransactionService.findTransactionById(
        transactionId,
        {}
      );

      if (!transaction) {
        throw new AppError(
          NOT_FOUND,
          `Transaction with ID ${transactionId} not found`,
          404
        );
      }

      return res.status(200).json(transaction);
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
      return access;
    }
  }

  @tryCatch()
  static async listItems(req: Request, res: Response): Promise<Response<any>> {
    // Valida e autoriza o usuário antes de listar os itens
    const access = await validateAndAuthorize(req, res);

    // Verifica se o tipo de `access` é `ValidResponse`
    if (isValidResponse(access)) {
      const items = await ItemService.listItems({
        where: { companie_id: access.companyId },
      });
      return res.status(200).json(items);
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
      return access;
    }
  }

  @tryCatch()
  static async getItemById(
    req: Request,
    res: Response
  ): Promise<Response<any>> {
    // Valida e autoriza o usuário antes de listar o item
    const access = await validateAndAuthorize(req, res);

    if (isValidResponse(access)) {
      // Validação do parâmetro ID da query string
      const schema = Joi.object({
        itemId: Joi.string().required(), // Aceita string que será convertida
      });

      const { error } = schema.validate(req.query);
      if (error) {
        throw new AppError(INVALID_FIELDS, "Invalid item ID format", 400);
      }

      const itemId = parseInt(req.query.itemId as string, 10); // Transforma de string para número

      if (isNaN(itemId)) {
        throw new AppError(INVALID_FIELDS, "Item ID must be a number", 400);
      }

      // Busca o item pelo ID
      const item = await ItemService.findItem({
        where: { item_id: itemId, companie_id: access.companyId },
      });

      if (!item) {
        throw new AppError(NOT_FOUND, `Item with ID ${itemId} not found`, 404);
      }

      return res.status(200).json(item);
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
      return access;
    }
  }
}
