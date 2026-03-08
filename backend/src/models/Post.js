'use strict';

const { DataTypes } = require('sequelize');

/**
 * Define the Post model.
 * @param {import('sequelize').Sequelize} sequelize
 */
function definePost(sequelize) {
  const Post = sequelize.define('Post', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    style: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    postText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imageUrls: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    hashtags: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'published', 'failed'),
      defaultValue: 'draft',
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    threadPostId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    maxPosts: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    followUpEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Video fields
    videoEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    videoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    videoDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Target video duration in seconds (15–90)',
    },
    voiceoverEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    voiceoverStyle: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'TTS voice style: sarcastic_male | sarcastic_female | professional_male | professional_female',
    },
    captionsEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    videoScript: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Grok-generated video script / scene descriptions',
    },
    videoProvider: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'AI video provider used: runway | pika | kling | luma | placeholder',
    },
  }, {
    tableName: 'posts',
    timestamps: true,
  });

  Post.associate = (models) => {
    Post.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Post.hasMany(models.ScheduledJob, { foreignKey: 'postId', as: 'scheduledJobs' });
  };

  return Post;
}

module.exports = { definePost };
