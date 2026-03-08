'use strict';

const { Sequelize } = require('sequelize');
const config = require('../config');
const { defineUser } = require('./User');
const { definePost } = require('./Post');
const { defineScheduledJob } = require('./ScheduledJob');

let sequelize;

try {
  sequelize = new Sequelize(config.databaseUrl, {
    dialect: 'postgres',
    logging: config.nodeEnv === 'development' ? console.log : false,
  });
} catch (err) {
  console.warn('[Models] Could not initialize Sequelize:', err.message);
}

const models = {};

if (sequelize) {
  models.User = defineUser(sequelize);
  models.Post = definePost(sequelize);
  models.ScheduledJob = defineScheduledJob(sequelize);

  // Run associations
  Object.values(models).forEach(model => {
    if (model.associate) model.associate(models);
  });
}

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
