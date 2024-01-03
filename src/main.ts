import { Notice, Plugin, TAbstractFile, TFile } from 'obsidian';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import {
  DEFAULT_SETTINGS,
  UpdateTimeOnEditSettings,
  UpdateTimeOnEditSettingsTab,
} from './Settings';
import { isTFile } from './utils';
import add from 'date-fns/add';
import isAfter from 'date-fns/isAfter';
import { sha256 } from 'js-sha256';

export default class UpdateTimeOnSavePlugin extends Plugin {
  // @ts-expect-error the settings are hot loaded at init
  settings: UpdateTimeOnEditSettings;

  parseDate(input: number | string): Date | undefined {
    if (typeof input === 'string') {
      try {
        const parsedDate = parse(input, this.settings.dateFormat, new Date());

        if (isNaN(parsedDate.getTime())) {
          this.log('NAN DATE', parsedDate);
          return undefined;
        }

        return parsedDate;
      } catch (e) {
        console.error(e);
        return undefined;
      }
    }
    return new Date(input);
  }

  formatDate(input: Date): string | number {
    const output = format(input, this.settings.dateFormat);
    if (/^\d+$/.test(output) && this.settings.enableNumberProperties) {
      return parseInt(output);
    }
    return output;
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
    return this.settings.ignoreGlobalFolder ?? [];
  }

  hashString(str: string): string {
    return sha256(str);
  }

  async shouldFileBeIgnored(file: TFile): Promise<boolean> {
    if (!file.path) {
      return true;
    }
    if (!file.path.endsWith('.md')) {
      return true;
    }

    const fileContent = (await this.app.vault.read(file)).trim();

    const sha = this.hashString(fileContent);

    if (fileContent.length === 0) {
      return true;
    }

    if (this.settings.enableExperimentalHash) {
      const maybeHash = this.settings.fileHashMap[file.path];
      if (maybeHash) {
        const sha = this.hashString(fileContent);
        if (sha === maybeHash) {
          this.log('Ignoring file because, sha same');
          return true;
        }
      }
    }

    const isExcalidrawFile = this.isExcalidrawFile(file);

    if (isExcalidrawFile) {
      // TODO: maybe add a setting to enable it if users want to have the keys works there
      return true;
    }
    const ignores = this.getIgnoreFolders();
    if (!ignores) {
      return false;
    }

    return ignores.some((ignoreItem) => file.path.startsWith(ignoreItem));
  }

  shouldIgnoreCreated(path: string): boolean {
    if (!this.settings.enableCreateTime) {
      return true;
    }
    return (this.settings.ignoreCreatedFolder || []).some((itemIgnore) =>
      path.startsWith(itemIgnore),
    );
  }

  shouldUpdateValue(currentMtime: Date, updateHeader: Date): boolean {
    const nextUpdate = add(updateHeader, {
      minutes: this.settings.minMinutesBetweenSaves,
    });
    return isAfter(currentMtime, nextUpdate);
  }

  isExcalidrawFile(file: TFile): boolean {
    const ea: any =
      //@ts-expect-error this is comming from global context, injected by Excalidraw
      typeof ExcalidrawAutomate === 'undefined'
        ? undefined
        : //@ts-expect-error this is comming from global context, injected by Excalidraw
          ExcalidrawAutomate; //ea will be undefined if the Excalidraw plugin is not running
    return ea ? ea.isExcalidrawFile(file) : false;
  }

  async getAllFilesPossiblyAffected() {
    const allFiles = this.app.vault.getMarkdownFiles();
    const result = [];

    for (const file of allFiles) {
      if (!(await this.shouldFileBeIgnored(file))) {
        result.push(file);
      }
    }

    return result;
  }

  async populateCacheForFile(file: TFile): Promise<void> {
    const fileContent = (await this.app.vault.read(file)).trim();
    const sha = this.hashString(fileContent);
    this.settings.fileHashMap[file.path] = sha;
    await this.saveSettings();
  }

  async handleFileChange(
    file: TAbstractFile,
    triggerSource: 'modify' | 'bulk',
  ): Promise<
    { status: 'ok' } | { status: 'error'; error: any } | { status: 'ignored' }
  > {
    if (!isTFile(file)) {
      return { status: 'ignored' };
    }

    if (await this.shouldFileBeIgnored(file)) {
      return { status: 'ignored' };
    }

    try {
      await this.app.fileManager.processFrontMatter(
        file,
        (frontmatter) => {
          this.log('current metadata: ', frontmatter);
          this.log('current stat: ', file.stat);
          const updatedKey = this.settings.headerUpdated;
          const createdKey = this.settings.headerCreated;

          const mTime = this.parseDate(file.stat.mtime);
          const cTime = this.parseDate(file.stat.ctime);

          if (!mTime || !cTime) {
            this.log('Something wrong happen, skipping');
            return;
          }

          if (!frontmatter[createdKey]) {
            if (!this.shouldIgnoreCreated(file.path)) {
              frontmatter[createdKey] = this.formatDate(cTime);
            }
          }

          const currentMTimeOnFile = this.parseDate(frontmatter[updatedKey]);

          if (!frontmatter[updatedKey] || !currentMTimeOnFile) {
            this.log('Update updatedKey');
            frontmatter[updatedKey] = this.formatDate(mTime);
            return;
          }

          if (this.shouldUpdateValue(mTime, currentMTimeOnFile)) {
            frontmatter[updatedKey] = this.formatDate(mTime);
            this.log('Update updatedKey');
            return;
          }
          this.log('Skipping updateKey');
        },
        { ctime: file.stat.ctime, mtime: file.stat.mtime },
      );
      await this.populateCacheForFile(file);
    } catch (e: any) {
      if (e?.name === 'YAMLParseError') {
        const errorMessage = `Update time on edit failed
Malformed frontamtter on this file : ${file.path}

${e.message}`;
        new Notice(errorMessage, 4000);
        console.error(errorMessage);
        return {
          status: 'error',
          error: e,
        };
      }
    }
    return {
      status: 'ok',
    };
  }

  setupOnEditHandler() {
    this.log('Setup handler');

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        this.log('TRIGGER FROM MODIFY');
        return this.handleFileChange(file, 'modify');
      }),
    );

    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        const hash = this.settings.fileHashMap[oldPath];
        if (!hash) {
          return;
        }
        this.settings.fileHashMap[file.path] = hash;
        delete this.settings.fileHashMap[oldPath];
        this.saveSettings();
      }),
    );

    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        const sha = this.settings.fileHashMap[file.path];
        if (!sha) {
          return;
        }
        delete this.settings.fileHashMap[file.path];
        this.saveSettings();
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
