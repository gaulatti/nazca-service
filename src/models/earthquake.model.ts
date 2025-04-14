import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'earthquakes',
  timestamps: true,
  underscored: true,
})
export class Earthquake extends Model {
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  sourceId: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  timestamp: Date;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  latitude: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  longitude: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  magnitude: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  depth: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  additionalData: Record<string, any>;
}
