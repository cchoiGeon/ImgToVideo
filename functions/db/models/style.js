import { Sequelize, DataTypes } from 'sequelize';

export class Style extends Sequelize.Model {
  static initiate(sequelize) {
    Style.init({
      style_name: {
        type: DataTypes.STRING(10),
        primaryKey: true,
        allowNull: false,
      },
    }, {
      sequelize,
      timestamps: false,
      underscored: false,
      modelName: 'Style',
      tableName: 'style',
      paranoid: false,
      charset: 'utf8',
      collate: 'utf8_general_ci',
    });
  }

  static associate(db) {
    this.hasMany(db.UserStyle, { foreignKey: 'style_name' });
  }
}
