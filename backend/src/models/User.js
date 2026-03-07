'use strict';

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const config = require('../config');

// Encrypt/decrypt access tokens using AES-256-CBC
function getEncryptionKey() {
  const key = config.encryptionKey;
  if (!key || key.length < 32) {
    if (config.nodeEnv === 'production') {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
    // In dev/test, pad to 32 bytes (insecure but acceptable for local use)
    return Buffer.from((key || '').padEnd(32).slice(0, 32));
  }
  return Buffer.from(key.slice(0, 32));
}

function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(encryptedText) {
  const [ivHex, encHex] = encryptedText.split(':');
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Define the User model.
 * @param {import('sequelize').Sequelize} sequelize
 */
function defineUser(sequelize) {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    threadsUserId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // Stored encrypted
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const raw = this.getDataValue('accessToken');
        if (!raw) return null;
        try {
          return decrypt(raw);
        } catch (err) {
          console.error('[User] Failed to decrypt accessToken — possible key mismatch or data corruption:', err.message);
          return null;
        }
      },
      set(value) {
        if (!value) {
          this.setDataValue('accessToken', null);
          return;
        }
        this.setDataValue('accessToken', encrypt(value));
      },
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profilePic: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'users',
    timestamps: true,
  });

  User.associate = (models) => {
    User.hasMany(models.Post, { foreignKey: 'userId', as: 'posts' });
  };

  return User;
}

module.exports = { defineUser, encrypt, decrypt };
