/**
 * InstalledAddon.
 *
 * Represents an existing, installed add-on.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
'use strict';

const API = require('./api');
const Utils = require('./utils');
const page = require('./lib/page');

/**
 * InstalledAddon constructor.
 *
 * @param {Object} metadata InstalledAddon metadata object.
 * @param {Object} installedAddonsMap Handle to the installedAddons map from
 *                 SettingsScreen.
 * @param {Object} availableAddonsMap Handle to the availableAddons map from
 *                 SettingsScreen.
 * @param {String} updateUrl URL for updated add-on package
 * @param {String} updateVersion Version of updated add-on package
 * @param {String} updateChecksum Checksum of the updated add-on package
 */
const InstalledAddon = function(metadata, installedAddonsMap,
                                availableAddonsMap, updateUrl, updateVersion,
                                updateChecksum) {
  this.name = metadata.name;
  this.description = metadata.description;
  this.author = metadata.author;
  this.homepage = metadata.homepage;
  this.version = metadata.version;
  this.enabled = metadata.moziot.enabled;
  this.config = metadata.moziot.config;
  this.schema = metadata.moziot.schema;
  this.updateUrl = updateUrl;
  this.updateVersion = updateVersion;
  this.updateChecksum = updateChecksum;
  this.container = document.getElementById('installed-addons-list');
  this.installedAddonsMap = installedAddonsMap;
  this.availableAddonsMap = availableAddonsMap;
  this.render();
};

/**
 * HTML view for InstalledAddon.
 */
InstalledAddon.prototype.view = function() {
  let toggleButtonText, toggleButtonClass;
  if (this.enabled) {
    toggleButtonText = 'Disable';
    toggleButtonClass = 'addon-settings-disable';
  } else {
    toggleButtonText = 'Enable';
    toggleButtonClass = 'addon-settings-enable';
  }

  const updateButtonClass = this.updateUrl ? '' : 'hidden';
  const configButtonClass = this.schema ? '' : 'hidden';

  return `
    <li id="addon-item-${Utils.escapeHtml(this.name)}" class="addon-item">
      <div class="addon-settings-header">
        <span class="addon-settings-name">
          ${Utils.escapeHtml(this.name)}
        </span>
        <span class="addon-settings-version">
          ${Utils.escapeHtml(this.version)}
        </span>
        <span class="addon-settings-description">
          ${Utils.escapeHtml(this.description)}
        </span>
        <span class="addon-settings-author">
          by <a href="${this.homepage}" target="_blank" rel="noopener">
            ${Utils.escapeHtml(this.author)}
          </a>
        </span>
      </div>
      <div class="addon-settings-controls">
        <button id="addon-config-${Utils.escapeHtml(this.name)}"
          class="text-button addon-settings-config ${configButtonClass}">
          Configure
        </button>
        <button id="addon-update-${Utils.escapeHtml(this.name)}"
          class="text-button addon-settings-update ${updateButtonClass}">
          Update
        </button>
        <span class="addon-settings-spacer"></span>
        <button id="addon-remove-${Utils.escapeHtml(this.name)}"
          class="text-button addon-settings-remove">
          Remove
        </button>
        <button id="addon-toggle-${Utils.escapeHtml(this.name)}"
          class="text-button ${toggleButtonClass}">
          ${toggleButtonText}
        </button>
      </div>
    </li>`;
};

/**
 * Render InstalledAddon view and add to DOM.
 */
InstalledAddon.prototype.render = function() {
  this.container.insertAdjacentHTML('beforeend', this.view());

  const configButton = document.getElementById(
    `addon-config-${Utils.escapeHtml(this.name)}`);
  configButton.addEventListener('click', this.handleConfig.bind(this));

  const updateButton = document.getElementById(
    `addon-update-${Utils.escapeHtml(this.name)}`);
  updateButton.addEventListener('click', this.handleUpdate.bind(this));

  const removeButton = document.getElementById(
    `addon-remove-${Utils.escapeHtml(this.name)}`);
  removeButton.addEventListener('click', this.handleRemove.bind(this));

  const toggleButton = document.getElementById(
    `addon-toggle-${Utils.escapeHtml(this.name)}`);
  toggleButton.addEventListener('click', this.handleToggle.bind(this));
};

/**
 * Handle a click on the config button.
 */
InstalledAddon.prototype.handleConfig = function() {
  page(`/settings/addons/config/${this.name}`);
};

/**
 * Handle a click on the update button.
 */
InstalledAddon.prototype.handleUpdate = function(e) {
  const controlDiv = e.target.parentNode;
  const versionDiv = document.querySelector(
    `#addon-item-${Utils.escapeHtml(this.name)} .addon-settings-version`);
  const updating = document.createElement('span');
  updating.classList.add('addon-updating');
  updating.innerText = 'Updating...';
  controlDiv.replaceChild(updating, e.target);

  API.updateAddon(this.name, this.updateUrl, this.updateChecksum)
    .then(() => {
      versionDiv.innerText = this.updateVersion;
      updating.innerText = 'Updated';
    })
    .catch((err) => {
      console.error(`Failed to update add-on: ${this.name}\n${err}`);
      updating.innerText = 'Failed';
    });
};

/**
 * Handle a click on the remove button.
 */
InstalledAddon.prototype.handleRemove = function() {
  API.uninstallAddon(this.name)
    .then(() => {
      const el = document.getElementById(
        `addon-item-${Utils.escapeHtml(this.name)}`);
      el.parentNode.removeChild(el);
      this.installedAddonsMap.delete(this.name);
      const addon = this.availableAddonsMap.get(this.name);
      if (addon) {
        addon.installed = false;
      }
    })
    .catch((e) => {
      console.error(`Failed to uninstall add-on: ${this.name}\n${e}`);
    });
};

/**
 * Handle a click on the enable/disable button.
 */
InstalledAddon.prototype.handleToggle = function(e) {
  const button = e.target;
  const enabled = !this.enabled;
  API.setAddonSetting(this.name, enabled)
    .then(() => {
      this.enabled = enabled;
      const addon = this.installedAddonsMap.get(this.name);
      addon.moziot.enabled = enabled;
      if (this.enabled) {
        button.innerText = 'Disable';
        button.classList.remove('addon-settings-enable');
        button.classList.add('addon-settings-disable');
      } else {
        button.innerText = 'Enable';
        button.classList.remove('addon-settings-disable');
        button.classList.add('addon-settings-enable');
      }
    })
    .catch((err) => {
      console.error(`Failed to toggle add-on: ${this.name}\n${err}`);
    });
};

module.exports = InstalledAddon;
