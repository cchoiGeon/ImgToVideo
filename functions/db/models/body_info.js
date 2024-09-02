import { Sequelize, DataTypes } from 'sequelize';

export class BodyInfo extends Sequelize.Model {
  static initiate(sequelize) {
    BodyInfo.init({
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      uuid: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique:true,
        references: {
          model: 'User',
          key: 'uuid',
        },
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      weight: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      shoulder_width: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      chest_circumference: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      arm_length: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      waist_circumference: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      thigh_circumference: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      hip_circumference: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    }, {
      sequelize,
      timestamps: false,
      underscored: false,
      modelName: 'BodyInfo',
      tableName: 'body_info',
      paranoid: false,
      charset: 'utf8',
      collate: 'utf8_general_ci',
    });
  }

  static associate(db) {
    this.belongsTo(db.User, { foreignKey: 'uuid' });
  }
}
