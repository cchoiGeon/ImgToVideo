import { Sequelize, DataTypes } from 'sequelize';

export class UserStyle extends Sequelize.Model {
  static initiate(sequelize) {
    UserStyle.init({
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      style_name: {
        type: DataTypes.STRING(10),
        allowNull: false,
        references: {
          model: 'Style',
          key: 'style_name',
        },
      },
      uuid: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'User',
          key: 'uuid',
        },
      },
    }, {
      sequelize,
      timestamps: false,
      underscored: false,
      modelName: 'UserStyle',
      tableName: 'user_style',
      paranoid: false,
      charset: 'utf8',
      collate: 'utf8_general_ci',
    });
  }

  static associate(db) {
    this.belongsTo(db.User, { foreignKey: 'uuid' });
    this.belongsTo(db.Style, { foreignKey: 'style_name' });
  }
}
