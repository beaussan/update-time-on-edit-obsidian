import { App, PluginSettingTab, Setting } from 'obsidian';
import UpdateTimeOnSavePlugin from './main';
import { FolderSuggest } from './suggesters/FolderSuggester';
import { onlyUniqueArray } from './utils';
import { format } from 'date-fns';

export interface UpdateTimeOnEditSettings {
  dateFormat: string;
  useDifferentReadFormat: boolean;
  readDateFormat: string;
  enableCreateTime: boolean;
  headerUpdated: string;
  headerCreated: string;
  minMinutesBetweenSaves: number;
  // Union because of legacy
  ignoreGlobalFolder?: string | string[];
  ignoreCreatedFolder?: string[];
}

export const DEFAULT_SETTINGS: UpdateTimeOnEditSettings = {
  dateFormat: "yyyy-MM-dd'T'HH:mm:ssxxx",
  readDateFormat: "yyyy-MM-dd'T'HH:mm:ssxxx",
  useDifferentReadFormat: false,
  enableCreateTime: true,
  headerUpdated: 'updated',
  headerCreated: 'created',
  minMinutesBetweenSaves: 1,
  ignoreGlobalFolder: [],
  ignoreCreatedFolder: [],
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

    containerEl.createEl('h2', { text: 'Global settings' });

    this.addExcludedFoldersSetting();
    this.addTimeBetweenUpdates();
    this.addDateFormat();

    // TODO enable different format from read and write

    this.addDiffFormatForWriteAndRead();
    this.addDateReadFormat();

    containerEl.createEl('h2', { text: 'Created at' });

    this.addEnableCreated();
    this.addFrontMatterCreated();
    this.addExcludedCreatedFoldersSetting();

    containerEl.createEl('h2', { text: 'Updated at' });

    this.addFrontMatterUpdated();
  }

  async saveSettings() {
    await this.plugin.saveSettings();
  }

  addDiffFormatForWriteAndRead(): void {
    new Setting(this.containerEl)
      .setName('Enable a different read format from the write one')
      .setDesc('For advance use')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useDifferentReadFormat)
          .onChange(async (newValue) => {
            this.plugin.settings.useDifferentReadFormat = newValue;
            await this.saveSettings();
            this.display();
          }),
      );
  }

  addDateFormat(): void {
    this.createDateFormatEditor({
      getValue: () => this.plugin.settings.dateFormat,
      name: 'Date format',
      description: this.plugin.settings.useDifferentReadFormat
        ? 'The date format for read only'
        : 'The date format for read and write',
      setValue: (newValue) => (this.plugin.settings.dateFormat = newValue),
    });
  }

  addDateReadFormat(): void {
    if (!this.plugin.settings.useDifferentReadFormat) {
      return;
    }
    this.createDateFormatEditor({
      getValue: () => this.plugin.settings.readDateFormat,
      name: 'Read date format',
      description: 'The read date format, useful for migrations',
      setValue: (newValue) => (this.plugin.settings.readDateFormat = newValue),
    });
  }

  createDateFormatEditor({
    description,
    name,
    getValue,
    setValue,
  }: DateFormatArgs) {
    const createDoc = () => {
      const descr = document.createDocumentFragment();
      descr.append(
        description,
        descr.createEl('br'),
        'Check ',
        descr.createEl('a', {
          href: 'https://date-fns.org/v2.25.0/docs/format',
          text: 'date-fns documentation',
        }),
        descr.createEl('br'),
        `Currently: ${format(new Date(), getValue())}`,
      );
      return descr;
    };
    let dformat = new Setting(this.containerEl)
      .setName(name)
      .setDesc(createDoc())
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dateFormat)
          .setValue(getValue())
          .onChange(async (value) => {
            setValue(value);
            dformat.setDesc(createDoc());
            await this.saveSettings();
          }),
      );
  }

  addTimeBetweenUpdates(): void {
    new Setting(this.containerEl)
      .setName('Minimum number of minutes between update')
      .setDesc('If you have files updated too ofter, increase this.')
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.minMinutesBetweenSaves)
          .onChange(async (value) => {
            this.plugin.settings.minMinutesBetweenSaves = value;
            await this.saveSettings();
          })
          .setDynamicTooltip(),
      );
  }

  addEnableCreated(): void {
    new Setting(this.containerEl)
      .setName('Enable the created front matter key update')
      .setDesc('Currently, it is set to now if not present')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCreateTime)
          .onChange(async (newValue) => {
            this.plugin.settings.enableCreateTime = newValue;
            await this.saveSettings();
            this.display();
          }),
      );
  }

  addFrontMatterUpdated(): void {
    new Setting(this.containerEl)
      .setName('Front matter updated name')
      .setDesc(
        'The key in the front matter yaml for the update time. The time **must** be present.',
      )
      .addText((text) =>
        text
          .setPlaceholder('updated')
          .setValue(this.plugin.settings.headerUpdated ?? '')
          .onChange(async (value) => {
            this.plugin.settings.headerUpdated = value;
            await this.saveSettings();
          }),
      );
  }

  addFrontMatterCreated(): void {
    if (!this.plugin.settings.enableCreateTime) {
      return;
    }
    new Setting(this.containerEl)
      .setName('Front matter created name')
      .setDesc('The key in the front matter yaml for the creation time')
      .addText((text) =>
        text
          .setPlaceholder('updated')
          .setValue(this.plugin.settings.headerCreated ?? '')
          .onChange(async (value) => {
            this.plugin.settings.headerCreated = value;
            await this.saveSettings();
          }),
      );
  }

  addExcludedCreatedFoldersSetting(): void {
    if (!this.plugin.settings.enableCreateTime) {
      return;
    }

    this.doSearchAndRemoveList({
      currentList: this.plugin.settings.ignoreCreatedFolder,
      setValue: async (newValue) => {
        this.plugin.settings.ignoreCreatedFolder = newValue;
      },
      name: 'Folder to exclude of only created updates',
      description:
        'Any file udpate in this folder will not trigger a created update.',
    });
  }

  addExcludedFoldersSetting(): void {
    this.doSearchAndRemoveList({
      currentList: this.plugin.getIgnoreFolders(),
      setValue: async (newValue) => {
        this.plugin.settings.ignoreGlobalFolder = newValue;
      },
      name: 'Folder to exclude of all updates',
      description:
        'Any file udpate in this folder will not trigger a updated and created update.',
    });
  }

  doSearchAndRemoveList({
    currentList,
    setValue,
    description,
    name,
  }: ArgsSearchAndRemove) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addSearch((cb) => {
        new FolderSuggest(this.app, cb.inputEl);
        cb.setPlaceholder('Example: folder1/folder2').onChange(
          async (newFolder) => {
            await setValue([...currentList, newFolder].filter(onlyUniqueArray));
            await this.saveSettings();
            cb.setValue('');
            this.display();
          },
        );
        // @ts-ignore
        cb.containerEl.addClass('time_search');
      });

    currentList.forEach((ignoreFolder) =>
      new Setting(this.containerEl).setName(ignoreFolder).addButton((button) =>
        button.setButtonText('Remove').onClick(async () => {
          await setValue(currentList.filter((value) => value !== ignoreFolder));
          await this.saveSettings();
          this.display();
        }),
      ),
    );
  }
}

type DateFormatArgs = {
  getValue: () => string;
  setValue: (newValue: string) => void;
  name: string;
  description: string;
};

type ArgsSearchAndRemove = {
  name: string;
  description: string;
  currentList: string[];
  setValue: (newValue: string[]) => Promise<void>;
};
