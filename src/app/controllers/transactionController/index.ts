import tryCatch from "../../decorators/tryCatch";
import { Request, Response } from "express";
import Joi from "joi";
import AppError from "../../appError";
import { INVALID_FIELDS } from "../../constants/errorCodes";

import { sequelize } from "../../models";
import {
  isValidResponse,
  validateAndAuthorize,
} from "../../utils/validateAndAuthorize";
import { TransactionService } from "../../services/transaction";
import { ItemService } from "../../services/item";

export class TransactionController {
  @tryCatch()
  static async addItem(req: Request, res: Response): Promise<Response<any>> {
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

    // Verifica se o tipo de `access` é `ValidResponse`
    if (isValidResponse(access)) {
      const existingItem = await ItemService.listItems({
        where: { name: req.body.Item.name },
      });
      console.log(existingItem);
      if (existingItem.length > 0) {
        await transaction.rollback();
        throw new AppError(INVALID_FIELDS, "Record already exist", 400);
      }
      console.log(access);
      const newItem = await ItemService.createItem(
        { ...req.body.Item, companie_id: access.companyId },
        transaction
      );

      await TransactionService.createTransaction(
        { ...req.body.Transaction, item_id: newItem.item_id },
        transaction
      );

      await transaction.commit();

      return res.status(201).json({
        message: "Item and Transaction created successfully.",
      });
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
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
      const transactions = await TransactionService.listTransactions();
      return res.status(200).json(transactions);
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
      const items = await ItemService.listItems();
      return res.status(200).json(items);
    } else {
      // Se for uma resposta do tipo HTTP, retorna diretamente
      return access;
    }
  }
}
