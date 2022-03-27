import { Plugin, TAbstractFile, TFile } from 'obsidian';
import matter from 'gray-matter';
import { add, format, isAfter, parse } from 'date-fns';
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
import { updateKeyInFrontMatter } from './updateKeyInFrontMatter';

export default class UpdateTimeOnSavePlugin extends Plugin {
  settings: UpdateTimeOnEditSettings;

  fileUpdates$ = new Subject<string>();

  parseDate(input: string | Date): Date {
    console.log('What in for parseDate : ', input, typeof input);
    if (input instanceof Date) {
      return input;
    }
    return parse(input, this.settings.dateFormat, new Date());
  }

  formatDate(input: Date): string {
    console.log('Format date : ', input);
    let s = format(input, this.settings.dateFormat);
    console.log('Formated date : ', s);
    return s;
  }

  async onload() {
    this.log('loading plugin IN DEV');

    await this.loadSettings();

    this.setupOnEditHandler();

    this.listenOnNewUpdates();

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
      .subscribe(async (file) => {
        try {
          await this.updateHeaderIfNeeded(file);
        } catch (e) {
          console.error(e);
        }
      });
  }

  async updateHeaderIfNeeded(file: TFile): Promise<void> {
    const oldContent = await this.app.vault.read(file);

    const { data } = matter(oldContent);

    const updatedKey = this.settings.headerUpdated;
    const createdKey = this.settings.headerCreated;

    // Set the update date as epoch if there is no entry in the front matter
    data[updatedKey] = data[updatedKey]
      ? this.parseDate(data[updatedKey])
      : new Date(0);

    if (!this.shouldUpdateValue(data[updatedKey])) {
      this.log('Not soon enough, will update latter', file);
      return;
    }

    let newFile = `${oldContent}`;

    if (!this.shouldIgnoreCreated(file.path)) {
      // Set the creation date as now if there is no entry in the front matter
      data[createdKey] = data[createdKey]
        ? this.parseDate(data[createdKey])
        : new Date();

      newFile = updateKeyInFrontMatter(
        newFile,
        createdKey,
        this.formatDate(data[createdKey]),
      );
    }

    newFile = updateKeyInFrontMatter(
      newFile,
      updatedKey,
      this.formatDate(new Date()),
    );

    // Get the file for the modify parameter

    await this.app.vault.modify(file, newFile);

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
