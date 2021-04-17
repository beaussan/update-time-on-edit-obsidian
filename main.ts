import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import matter from 'gray-matter';
import { add, formatRFC3339, isAfter } from 'date-fns';

interface UpdateTimeOnEditSettings {
  headerUpdated: string;
  headerCreated: string;
  minMinutesBetweenSaves: number;
  ignoreFolder?: string;
}

const DEFAULT_SETTINGS: UpdateTimeOnEditSettings = {
  headerUpdated: 'updated',
  headerCreated: 'created',
  minMinutesBetweenSaves: 1,
  ignoreFolder: undefined,
};

export default class UpdateTimeOnSavePlugin extends Plugin {
  settings: UpdateTimeOnEditSettings;

  parseDate(input: string | Date): Date {
    if (input instanceof Date) {
      return input;
    }
    return new Date(input);
  }

  async onload() {
    this.log('loading plugin');

    await this.loadSettings();

    this.setupOnEditHandler();

    this.addSettingTab(new UpdateTimeOnEditSettingsTab(this.app, this));
  }

  shouldFileBeIgnored(path: string): boolean {
    if (!this.settings.ignoreFolder) {
      return false;
    }
    return path.startsWith(this.settings.ignoreFolder);
  }

  shouldUpdateValue(date: Date): boolean {
    const nMinutesAgo = add(new Date(), {
      minutes: -this.settings.minMinutesBetweenSaves,
    });
    return isAfter(nMinutesAgo, date);
  }

  setupOnEditHandler() {
    this.log('Setup handler');
    this.app.vault.on('modify', async (file) => {
      this.log('on triggered');
      const oldText = (file as any).unsafeCachedData;
      if (!oldText) {
        this.log('No cashed data');
        return;
      }

      if (this.shouldFileBeIgnored(file.path)) {
        this.log('Ignored file');
        return;
      }

      const { content, data } = matter(oldText);

      const updatedKey = this.settings.headerUpdated;
      const createdKey = this.settings.headerCreated;

      // Set the creation date as now if there is no entry in the front matter
      data[createdKey] = data[createdKey]
        ? this.parseDate(data[createdKey])
        : new Date();

      // Set the update date as epoch if there is no entry in the front matter
      data[updatedKey] = data[updatedKey]
        ? this.parseDate(data[updatedKey])
        : new Date(0);

      if (!this.shouldUpdateValue(data[updatedKey])) {
        this.log('Not soon enough, will update latter');
        return;
      }

      data[createdKey] = formatRFC3339(data[createdKey]);
      data[updatedKey] = formatRFC3339(new Date());

      const newData = matter.stringify(content, data);

      // Get the file for the modify parameter
      const fileToSave = this.app.vault
        .getFiles()
        .find((inFile) => inFile.path === file.path);

      await this.app.vault.modify(fileToSave, newData);
      this.log('Document updated !');
    });
  }

  onunload() {
    this.log('unloading Update time on edit plugin');
  }

  log(payload: string) {
    console.log(`[TIME UPDATER PLUGIN] ${payload}`);
  }

  async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData()),
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class UpdateTimeOnEditSettingsTab extends PluginSettingTab {
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
