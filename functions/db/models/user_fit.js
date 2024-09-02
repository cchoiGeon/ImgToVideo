import { Sequelize, DataTypes } from 'sequelize';

export class UserFit extends Sequelize.Model {
  static initiate(sequelize) {
    UserFit.init({
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      pf_name: {
        type: DataTypes.STRING(10),
        allowNull: false,
        references: {
          model: 'prefer_fit',
          key: 'pf_name',
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
      modelName: 'UserFit',
      tableName: 'user_fit',
      paranoid: false,
      charset: 'utf8',
      collate: 'utf8_general_ci',
    });
  }

  static associate(db) {
    this.belongsTo(db.User, { foreignKey: 'uuid' });
    this.belongsTo(db.PreferFit, { foreignKey: 'pf_name' });
  }
}
