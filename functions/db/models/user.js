import { Sequelize, DataTypes } from 'sequelize';

export class User extends Sequelize.Model {
  static initiate(sequelize) {
    User.init({
      uuid: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: '해쉬화 된 비밀번호 저장',
      },
    }, {
      sequelize,
      timestamps: false,
      underscored: false,
      modelName: 'User',
      tableName: 'user',
      paranoid: false,
      charset: 'utf8',
      collate: 'utf8_general_ci',
    });
  }

  static associate(db) {
    this.hasOne(db.BodyInfo, { foreignKey: 'uuid' });
    this.hasMany(db.UserFit, { foreignKey: 'uuid' });
    this.hasMany(db.UserStyle, { foreignKey: 'uuid' });
  }
}
