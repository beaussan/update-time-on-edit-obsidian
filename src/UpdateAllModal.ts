import { App, ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import UpdateTimeOnSavePlugin from './main';

const createTextSpan = (text: string): HTMLSpanElement => {
  const textSpan = document.createElement('span');
  textSpan.setText(text);
  return textSpan;
};

const createBr = () => document.createElement('br');

export class UpdateAllModal extends Modal {
  plugin: UpdateTimeOnSavePlugin;

  divContainer?: HTMLDivElement;
  runButton?: ButtonComponent;
  cancelButton?: ButtonComponent;
  settingsSection?: Setting;
  isOpened = false;

  constructor(app: App, plugin: UpdateTimeOnSavePlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onRun() {
    if (!this.divContainer) {
      this.close();
      return;
    }
    const allMdFiles = await this.plugin.getAllFilesPossiblyAffected();
    const progress = document.createElement('progress');
    progress.setAttr('max', allMdFiles.length);

    const fileCounter = document.createElement('span');

    const updateCount = (count: number) => {
      progress.setAttr('value', count);
      fileCounter.setText(`${count}/${allMdFiles.length}`);
    };
    updateCount(0);

    const wrapperBar = document.createElement('div');
    wrapperBar.append(progress, fileCounter);
    wrapperBar.addClass('progress-section');

    const header = createTextSpan('Updating files...');

    this.divContainer.replaceChildren(header, wrapperBar);

    if (this.settingsSection) {
      this.contentEl.removeChild(this.settingsSection.settingEl);
    }
    for (let i = 0; i < allMdFiles.length; i++) {
      if (!this.isOpened) {
        new Notice('Bulk update for header stopped.', 2000);
        return;
      }
      updateCount(i + 1);
      await this.plugin.handleFileChange(allMdFiles[i], 'bulk');
    }

    const doneMessage = createTextSpan(
      'Done ! You can safely close this modal.',
    );
    const el = new Setting(this.containerEl).addButton((btn) => {
      btn.setButtonText('Close').onClick(() => {
        this.close();
      });
    }).settingEl;
    this.divContainer.replaceChildren(doneMessage, createBr(), createBr(), el);
  }

  async onOpen() {
    this.isOpened = true;
    let { contentEl } = this;
    const allMdFiles = await this.plugin.getAllFilesPossiblyAffected();

    contentEl.createEl('h2', {
      text: `Update all ${allMdFiles.length} files in the vault`,
    });

    contentEl.addClass('update-time-on-edit--bulk-modal');

    const div = contentEl.createDiv();
    this.divContainer = div;

    div.append(
      div.createSpan({
        text:
          'This will update all created and updated time on files affected by this plugin',
      }),
      createBr(),
      createBr(),
      div.createSpan({
        text: `WARNING: this action will affect ${allMdFiles.length} in your vault. Make sure you tuned the settings correctly, and make a backup.`,
        cls: 'update-time-on-edit--settings--warn',
      }),
      createBr(),
      createBr(),
    );

    this.settingsSection = new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText('Run')
          .setCta()
          .onClick(() => {
            this.onRun();
          });
        this.runButton = btn;
      })
      .addButton((btn) => {
        this.cancelButton = btn;
        btn.setButtonText('Cancel').onClick(() => {
          this.close();
        });
      });
  }
  onClose() {
    let { contentEl } = this;
    contentEl.empty();
    this.isOpened = false;
  }
}
