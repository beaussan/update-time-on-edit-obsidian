import { Plugin, TAbstractFile, TFile, Notice } from 'obsidian';
import format from 'date-fns/format';
import {
  DEFAULT_SETTINGS,
  UpdateTimeOnEditSettings,
  UpdateTimeOnEditSettingsTab,
} from './Settings';
import { isTFile } from './utils';

export default class UpdateTimeOnSavePlugin extends Plugin {
  settings: UpdateTimeOnEditSettings;

  parseDate(input: number): Date {
    return new Date(input);
  }

  formatDate(input: Date): string {
    this.log('Format date : ', input);
    let s = format(input, this.settings.dateFormat);
    this.log('Formated date : ', s);
    return s;
  }

  async onload() {
    this.log('loading plugin IN DEV');

    await this.loadSettings();

    this.setupOnEditHandler();

    this.addSettingTab(new UpdateTimeOnEditSettingsTab(this.app, this));
  }

  // Workaround since the first version of the plugin had a single string for
  // the option
  getIgnoreFolders(): string[] {
    if (typeof this.settings.ignoreGlobalFolder === 'string') {
      return [this.settings.ignoreGlobalFolder];
    }
    return this.settings.ignoreGlobalFolder;
  }

  shouldFileBeIgnored(path: string): boolean {
    const ignores = this.getIgnoreFolders();
    if (!ignores) {
      return false;
    }

    return ignores.some((ignoreItem) => path.startsWith(ignoreItem));
  }

  shouldIgnoreCreated(path: string): boolean {
    if (!this.settings.enableCreateTime) {
      return true;
    }
    return this.settings.ignoreCreatedFolder.some((itemIgnore) =>
      path.startsWith(itemIgnore),
    );
  }

  async handleFileChange(
    file: TAbstractFile,
    triggerSource: 'create' | 'modify',
  ): Promise<void> {
    if (!isTFile(file)) {
      return;
    }

    if (
      !file.path ||
      !file.path.endsWith('.md') ||
      this.shouldFileBeIgnored(file.path)
    ) {
      return;
    }

    //@ts-ignore
    const ea: any = ExcalidrawAutomate; //ea will be undefined if the Excalidraw plugin is not running
    const isExcalidrawFile = ea ? ea.isExcalidrawFile(file) : false;

    if (isExcalidrawFile) {
      // TODO: maybe add a setting to enable it if users want to have the keys works there
      return;
    }

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        this.log('current metadata: ', frontmatter);
        const updatedKey = this.settings.headerUpdated;
        const createdKey = this.settings.headerCreated;

        if (triggerSource === 'create') {
          if (frontmatter[createdKey]) {
            this.log('skipping, this is probably startup create file');
            return;
          }
        }

        frontmatter[updatedKey] = this.formatDate(
          this.parseDate(file.stat.mtime),
        );

        if (!this.shouldIgnoreCreated(file.path)) {
          frontmatter[createdKey] = this.formatDate(
            this.parseDate(file.stat.ctime),
          );
        }
      });
    } catch (e) {
      if (e?.name === 'YAMLParseError') {
        const errorMessage = `Update time on edit failed
Malformed frontamtter on this file : ${file.path}

${e.message}`;
        new Notice(errorMessage, 4000);
        console.error(errorMessage);
      }
    }
  }

  setupOnEditHandler() {
    this.log('Setup handler');

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        this.log('TRIGGER FROM MODIFY');
        return this.handleFileChange(file, 'modify');
      }),
    );
  }

  onunload() {
    this.log('unloading Update time on edit plugin');
  }

  log(...data: any[]) {
    if (!__DEV_MODE__) {
      return;
    }
    console.log('[UTOE]:', ...data);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
