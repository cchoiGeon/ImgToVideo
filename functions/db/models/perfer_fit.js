import { Sequelize, DataTypes } from 'sequelize';

export class PreferFit extends Sequelize.Model {
  static initiate(sequelize) {
    PreferFit.init({
      pf_name: {
        type: DataTypes.STRING(10),
        primaryKey: true,
        allowNull: false,
      },
    }, {
      sequelize,
      timestamps: false,
      underscored: false,
      modelName: 'PreferFit',
      tableName: 'prefer_fit',
      paranoid: false,
      charset: 'utf8',
      collate: 'utf8_general_ci',
    });
  }

  static associate(db) {
    this.hasMany(db.UserFit, { foreignKey: 'pf_name' });
  }
}
