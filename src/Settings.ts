import { App, PluginSettingTab, Setting } from 'obsidian';
import UpdateTimeOnSavePlugin from './main';

export interface UpdateTimeOnEditSettings {
  headerUpdated: string;
  headerCreated: string;
  minMinutesBetweenSaves: number;
  ignoreFolder?: string;
}

export const DEFAULT_SETTINGS: UpdateTimeOnEditSettings = {
  headerUpdated: 'updated',
  headerCreated: 'created',
  minMinutesBetweenSaves: 1,
  ignoreFolder: undefined,
};

export class UpdateTimeOnEditSettingsTab extends PluginSettingTab {
  plugin: UpdateTimeOnSavePlugin;

  constructor(app: App, plugin: UpdateTimeOnSavePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('Front matter updated name')
      .setDesc('The key in the front matter yaml for the update time')
      .addText((text) =>
        text
          .setPlaceholder('updated')
          .setValue(this.plugin.settings.headerUpdated ?? '')
          .onChange(async (value) => {
            this.plugin.settings.headerUpdated = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Front matter created name')
      .setDesc('The key in the front matter yaml for the creation time')
      .addText((text) =>
        text
          .setPlaceholder('updated')
          .setValue(this.plugin.settings.headerCreated ?? '')
          .onChange(async (value) => {
            this.plugin.settings.headerCreated = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Min minutes between update')
      .setDesc('The number of minutes before a new update should appends')
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.minMinutesBetweenSaves)
          .onChange(async (value) => {
            this.plugin.settings.minMinutesBetweenSaves = value;
            await this.plugin.saveSettings();
          })
          .setDynamicTooltip(),
      );

    new Setting(containerEl)
      .setName('Folder to exclude')
      .setDesc('File in this folder will not have the front matter updated')
      .addText((text) =>
        text
          .setPlaceholder('templates')
          .setValue(this.plugin.settings.ignoreFolder ?? '')
          .onChange(async (value) => {
            this.plugin.settings.ignoreFolder = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
