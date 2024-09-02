import { Sequelize } from 'sequelize';
import Config from './config/config.json' assert { type: 'json' };
import { User } from './models/user.js';
import { BodyInfo } from './models/body_info.js';
import { PreferFit } from './models/perfer_fit.js';
import { UserFit } from './models/user_fit.js';
import { Style } from './models/style.js';
import { UserStyle } from './models/user_style.js';

const env = process.env.NODE_ENV || 'development';
const config = Config[env];
const sequelize = new Sequelize(config.database, config.username, config.password, config);

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

User.initiate(sequelize);
BodyInfo.initiate(sequelize);
PreferFit.initiate(sequelize);
UserFit.initiate(sequelize);
Style.initiate(sequelize);
UserStyle.initiate(sequelize);

db.User = User;
db.BodyInfo = BodyInfo;
db.PreferFit = PreferFit;
db.UserFit = UserFit;
db.Style = Style;
db.UserStyle = UserStyle;


User.associate(db);
BodyInfo.associate(db);
PreferFit.associate(db);
UserFit.associate(db);
Style.associate(db);
UserStyle.associate(db);


export const init = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('데이터베이스 연결이 성공적으로 이루어졌습니다.');
    // 동기화 순서 지정
    await PreferFit.sync();
    await User.sync();
    await Style.sync();
    await BodyInfo.sync();
    await UserStyle.sync();
    await UserFit.sync();
    console.log('데이터베이스 동기화가 완료되었습니다.');
  } catch (error) {
    console.error('데이터베이스 연결에 실패했습니다:', error);
  }
};

export default db;
