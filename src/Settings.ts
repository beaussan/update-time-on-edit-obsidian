import {
  App,
  PluginSettingTab,
  SearchComponent,
  Setting,
  TextComponent,
} from 'obsidian';
import UpdateTimeOnSavePlugin from './main';
import { FolderSuggest } from './suggesters/FolderSuggester';
import { compileRegex, onlyUniqueArray } from './utils';
import { format } from 'date-fns';
import { UpdateAllModal } from './UpdateAllModal';
import { UpdateAllCacheData } from './UpdateAllCacheData';

export interface UpdateTimeOnEditSettings {
  dateFormat: string;
  enableNumberProperties: boolean;
  enableCreateTime: boolean;
  headerUpdated: string;
  headerCreated: string;
  minMinutesBetweenSaves: number;
  // Union because of legacy
  ignoreGlobalFolder?: string | string[];
  ignoreCreatedFolder?: string[];
  ignoreRegexPaths?: string[];

  enableExperimentalHash?: boolean;
  fileHashMap: Record<string, string>;
}

export const DEFAULT_SETTINGS: UpdateTimeOnEditSettings = {
  dateFormat: "yyyy-MM-dd'T'HH:mm",
  enableNumberProperties: false,
  enableCreateTime: true,
  headerUpdated: 'updated',
  headerCreated: 'created',
  minMinutesBetweenSaves: 1,
  ignoreGlobalFolder: [],
  ignoreCreatedFolder: [],
  ignoreRegexPaths: [],
  enableExperimentalHash: false,
  fileHashMap: {},
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
    this.addRegexExclusionsSetting();
    this.addTimeBetweenUpdates();
    this.addDateFormat();
    this.addEnableNumberProperties();

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

    containerEl.createEl('h2', { text: 'Experimental settings' });

    new Setting(this.containerEl)
      .setName('Enable hash matcher')
      .setDesc(
        'Using a hash system to prevent too many updates happening, especially with sync.',
      )
      .addToggle((cb) =>
        cb
          .setValue(this.plugin.settings.enableExperimentalHash ?? false)
          .onChange(async (newValue) => {
            this.plugin.settings.enableExperimentalHash = newValue;
            await this.saveSettings();
          }),
      )
      .addButton((cb) =>
        cb.setButtonText('Fill initial cache').onClick(() => {
          new UpdateAllCacheData(this.app, this.plugin).open();
        }),
      );
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

  addEnableNumberProperties(): void {
    new Setting(this.containerEl)
      .setName('Enable number property type')
      .setDesc(
        'Assigns numbers to date properties (instead of strings) when using numeric formats, like Unix timestamps.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableNumberProperties)
          .onChange(async (newValue) => {
            this.plugin.settings.enableNumberProperties = newValue;
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

  addRegexExclusionsSetting(): void {
    const list = this.plugin.getIgnoreRegexes();
    let input: TextComponent | undefined;
    new Setting(this.containerEl)
      .setName('Regular expressions to exclude of all updates')
      .setDesc(
        'Any file whose full path (e.g. folder/note.md) matches is excluded from updated and created updates. Case-sensitive. Example: (^|/)index\\.md$ excludes every index.md. Invalid patterns are ignored.',
      )
      .addText((cb) => {
        input = cb;
        cb.setPlaceholder('Example: (^|/)index\\.md$');
      })
      .addButton((cb) => {
        cb.setIcon('plus');
        cb.setTooltip('Add regular expression');
        cb.onClick(async () => {
          const pattern = input?.getValue() ?? '';
          if (!pattern) {
            return;
          }
          this.plugin.settings.ignoreRegexPaths = [...list, pattern].filter(
            onlyUniqueArray,
          );
          await this.saveSettings();
          this.display();
        });
      });

    list.forEach((pattern) => {
      const invalid = !compileRegex(pattern);
      const row = new Setting(this.containerEl).setName(pattern);
      if (invalid) {
        row.setDesc('Invalid regular expression: this pattern is ignored.');
        row.descEl.style.color = 'var(--text-error)';
      }
      row.addButton((button) =>
        button.setButtonText('Remove').onClick(async () => {
          this.plugin.settings.ignoreRegexPaths = list.filter(
            (value) => value !== pattern,
          );
          await this.saveSettings();
          this.display();
        }),
      );
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
