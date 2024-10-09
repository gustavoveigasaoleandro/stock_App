import Item from "../models/item.model";

export class ItemService {
  static async listItems(conditions: any = {}) {
    return await Item.findAll(conditions);
  }

  static async createItem(itemData: any, transaction: any) {
    return await Item.create(itemData, { transaction });
  }

  static async findItem(conditions: any) {
    return await Item.findOne(conditions);
  }

  static async updateItem(existingItem: any, itemData: any, transaction: any) {
    try {
      await existingItem.update(itemData, { transaction });
    } catch (e) {
      console.log(e);
    }
  }
}
