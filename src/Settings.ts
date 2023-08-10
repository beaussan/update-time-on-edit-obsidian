import { App, PluginSettingTab, SearchComponent, Setting } from 'obsidian';
import UpdateTimeOnSavePlugin from './main';
import { FolderSuggest } from './suggesters/FolderSuggester';
import { onlyUniqueArray } from './utils';
import { format } from 'date-fns';
import { UpdateAllModal } from './UpdateAllModal';

export interface UpdateTimeOnEditSettings {
  dateFormat: string;
  enableCreateTime: boolean;
  headerUpdated: string;
  headerCreated: string;
  minMinutesBetweenSaves: number;
  // Union because of legacy
  ignoreGlobalFolder?: string | string[];
  ignoreCreatedFolder?: string[];
}

export const DEFAULT_SETTINGS: UpdateTimeOnEditSettings = {
  dateFormat: "yyyy-MM-dd'T'HH:mm",
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

    new Setting(this.containerEl)
      .setName('Update all files')
      .setDesc(
        'This plugin will only work on new files, but if you want to update all files in your vault at once, you can do it here.',
      )
      .addButton((cb) => {
        cb.setButtonText('Update all files').onClick(() => {
          new UpdateAllModal(this.app, this.plugin).open();
        });
      });

    containerEl.createEl('h2', { text: 'Updated at' });

    this.addFrontMatterUpdated();

    containerEl.createEl('h2', { text: 'Created at' });

    this.addEnableCreated();
    this.addFrontMatterCreated();
    this.addExcludedCreatedFoldersSetting();
  }

  async saveSettings() {
    await this.plugin.saveSettings();
  }

  addDateFormat(): void {
    this.createDateFormatEditor({
      getValue: () => this.plugin.settings.dateFormat,
      name: 'Date format',
      description: 'The date format for read and write',
      setValue: (newValue) => (this.plugin.settings.dateFormat = newValue),
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
        descr.createEl('br'),
        `Obsidian default format for date properties: yyyy-MM-dd'T'HH:mm`,
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
      .setDesc('If your files are updating too often, increase this.')
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
      .setDesc('The key in the front matter yaml for the update time.')
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
      currentList: this.plugin.settings.ignoreCreatedFolder ?? [],
      setValue: async (newValue) => {
        this.plugin.settings.ignoreCreatedFolder = newValue;
      },
      name: 'Folder(s) to exclude for updating the created property',
      description:
        'Any file updated in this folder will not trigger a created update.',
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
        'Any file updated in this folder will not trigger an updated and created update.',
    });
  }

  doSearchAndRemoveList({
    currentList,
    setValue,
    description,
    name,
  }: ArgsSearchAndRemove) {
    let searchInput: SearchComponent | undefined;
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addSearch((cb) => {
        searchInput = cb;
        new FolderSuggest(this.app, cb.inputEl);
        cb.setPlaceholder('Example: folder1/folder2');
        // @ts-ignore
        cb.containerEl.addClass('time_search');
      })
      .addButton((cb) => {
        cb.setIcon('plus');
        cb.setTooltip('Add folder');
        cb.onClick(async () => {
          if (!searchInput) {
            return;
          }
          const newFolder = searchInput.getValue();

          await setValue([...currentList, newFolder].filter(onlyUniqueArray));
          await this.saveSettings();
          searchInput.setValue('');
          this.display();
        });
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
