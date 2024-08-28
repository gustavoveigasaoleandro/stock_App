import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  HasMany,
} from "sequelize-typescript";
import Transaction from "./transaction.model";

@Table({ paranoid: true })
class Item extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  item_id: number;

  @Column
  companie_id: number;

  @Column
  name: string;

  @Column
  description: string;

  @Column
  amount: number;

  @Column
  price: number;

  @HasMany(() => Transaction, "item_id")
  transaction: Transaction[];
}

export default Item;
