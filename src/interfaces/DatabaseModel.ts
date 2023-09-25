import { Model, ModelStatic, Sequelize } from 'sequelize/types';

export interface DatabaseModelInitializer<M extends Model> {
    (sequelize: Sequelize): ModelStatic<M>;
}

export interface DatabaseModel<M extends Model> {
    initializer: DatabaseModelInitializer<M>;
}
