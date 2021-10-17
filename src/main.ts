import { Plugin, TAbstractFile, TFile, moment } from 'obsidian';
import matter from 'gray-matter';
import { add, formatRFC3339, isAfter } from 'date-fns';
import { Subject } from 'rxjs';
import {
  debounceTime,
  filter,
  groupBy,
  map,
  mergeMap,
  tap,
} from 'rxjs/operators';
import {
  DEFAULT_SETTINGS,
  UpdateTimeOnEditSettings,
  UpdateTimeOnEditSettingsTab,
} from './Settings';
import { log } from './log';

export default class UpdateTimeOnSavePlugin extends Plugin {
  settings: UpdateTimeOnEditSettings;

  fileUpdates$ = new Subject<string>();

  parseDate(input: string | Date): Date {
    if (input instanceof Date) {
      return input;
    }
    return new Date(input);
  }

  async onload() {
    this.log('loading plugin IN DEV');

    await this.loadSettings();

    this.setupOnEditHandler();

    this.listenOnNewUpdates();

    this.addSettingTab(new UpdateTimeOnEditSettingsTab(this.app, this));
  }

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

  shouldUpdateValue(date: Date): boolean {
    const nMinutesAgo = add(new Date(), {
      minutes: -this.settings.minMinutesBetweenSaves,
    });
    return isAfter(nMinutesAgo, date);
  }

  listenOnNewUpdates() {
    this.fileUpdates$
      .asObservable()
      .pipe(
        filter((path) => !!path),
        filter((path) => path.endsWith('.md')),
        filter((path) => !this.shouldFileBeIgnored(path)),
        log('on triggered'),
        groupBy((value) => value),
        mergeMap((group) => group.pipe(debounceTime(30 * 1000))),
        map((path) =>
          this.app.vault.getFiles().find((inFile) => inFile.path === path),
        ),
        filter((file) => !!file),
        tap((file) => {
          this.log(`Triggered`, file);
        }),
      )
      .subscribe((file) => this.updateHeaderIfNeeded(file));
  }

  async updateHeaderIfNeeded(file: TFile): Promise<void> {
    const oldContent = await this.app.vault.read(file);
    if (!oldContent) {
      this.log('No content', file);
      return;
    }

    const { content, data } = matter(oldContent);

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
      this.log('Not soon enough, will update latter', file);
      return;
    }

    data[createdKey] = formatRFC3339(data[createdKey]);
    data[updatedKey] = formatRFC3339(new Date());

    const newData = matter.stringify(content, data);

    // Get the file for the modify parameter

    await this.app.vault.modify(file, newData);

    this.log('Document updated !', file);
  }

  setupOnEditHandler() {
    this.log('Setup handler');
    this.app.vault.on('modify', async (file) => {
      this.fileUpdates$.next(file.path);
    });
  }

  onunload() {
    this.log('unloading Update time on edit plugin');
  }

  log(payload: string, file?: TAbstractFile) {
    console.log(
      `[TIME UPDATER PLUGIN] ${file ? `[${file.path}] ` : ''}${payload}`,
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
