'use strict';

const { DataTypes } = require('sequelize');

/**
 * Define the ScheduledJob model.
 * @param {import('sequelize').Sequelize} sequelize
 */
function defineScheduledJob(sequelize) {
  const ScheduledJob = sequelize.define('ScheduledJob', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'posts', key: 'id' },
    },
    bullmqJobId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    queueName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'posts',
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending',
    },
  }, {
    tableName: 'scheduled_jobs',
    timestamps: true,
  });

  ScheduledJob.associate = (models) => {
    ScheduledJob.belongsTo(models.Post, { foreignKey: 'postId', as: 'post' });
  };

  return ScheduledJob;
}

module.exports = { defineScheduledJob };
