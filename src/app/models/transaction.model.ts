import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import Item from "./item.model";

@Table({ paranoid: true })
class Transaction extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  declare id: number;

  @ForeignKey(() => Item)
  @Column
  item_id: number;

  @Column
  companie_id: number;

  @AllowNull(false)
  @Column
  type: boolean;

  @AllowNull(false)
  @Column
  amount: number;

  @AllowNull(false)
  @Column
  date: Date;

  @BelongsTo(() => Item, "item_id")
  item: Item;
}

export default Transaction;
