import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import matter from 'gray-matter';
import { add, parse, formatRFC3339, isAfter, parseISO } from 'date-fns';

interface MyPluginSettings {
	header: string;
	minMinutesBetweenSaves: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	header: 'updated',
	minMinutesBetweenSaves: 1,
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	parseDate(input: string | Date | undefined): Date {
		if (!input) {
			return new Date(0);
		}
		if (input instanceof Date) {
			return input;
		}
		const oldFormat = 'yyyy-MM-dd HH:mm-ssxxx';
		if (input.contains('T')) {
			return new Date(input)
		}
		return parse(input, oldFormat, new Date());
	}

	async onload() {
		console.log('loading Update time on edit plugin');

		await this.loadSettings();

		this.app.vault.on('modify', async (file) => {
			const oldText =  (file as any).unsafeCachedData;
			if (!oldText) {
				return;
			}
			const { content, data } = matter(oldText);
			data.updated = this.parseDate(data.updated);
			data.created = data.created ? this.parseDate(data.created) : new Date();


			const nMinutesAgo = add(new Date(), { minutes: -this.settings.minMinutesBetweenSaves });
			const shouldEdit = isAfter(nMinutesAgo, data.updated)
			
			if (!shouldEdit) {
				console.log('Not soon enouth, will update latter');
				return;
			}

			data.created = formatRFC3339(data.created);
			data.updated = formatRFC3339(new Date());


			const newData = matter.stringify(content, data);

			console.log(newData);

			const fileToSave = this.app.vault.getFiles().find(inFile => inFile.path === file.path);
			
			console.log(fileToSave);
			console.log(file.path);

			await this.app.vault.modify(fileToSave, newData);
			console.log('Updated !');
		})

		

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Front matter name')
			.addText(text => text
				.setPlaceholder('updated')
				.setValue(this.plugin.settings.header ?? '')
				.onChange(async (value) => {
					this.plugin.settings.header = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Excluded folder')
			.addSearch(search => search)

		new Setting(containerEl)
			.setName('Min minutes between update')
			.addSlider(slider => slider
				.setLimits(1, 30, 1)
				.setValue(this.plugin.settings.minMinutesBetweenSaves)
				.onChange(async value => {
					this.plugin.settings.minMinutesBetweenSaves = value;
					await this.plugin.saveSettings();
				}).setDynamicTooltip()
				)
				;
	}
}
