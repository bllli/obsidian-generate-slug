import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';


interface GenerateSlugPluginSettings {
	openai_base_url: string;
	openai_api_key: string;
}

const DEFAULT_SETTINGS: GenerateSlugPluginSettings = {
	openai_base_url: 'https://api.openai.com/v1',
	openai_api_key: ''
}

export default class GenerateSlugPlugin extends Plugin {
	settings: GenerateSlugPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GenerateSlugSettingTab(this.app, this));

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');


		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				menu.addItem((item) => {
					item.setTitle('Generate Slug')
						.onClick(() => {
							new Notice('Menu item clicked!');
						});
				});
			}
		));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class GenerateSlugSettingTab extends PluginSettingTab {
	plugin: GenerateSlugPlugin;

	constructor(app: App, plugin: GenerateSlugPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('OpenAI Base URL')
			.setDesc('The base URL for the OpenAI API. looks like https://api.deepseek.com/v1')
			.addText(text => text
				.setValue(this.plugin.settings.openai_base_url)
				.onChange(async (value) => {
					this.plugin.settings.openai_base_url = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('The API key for the OpenAI API')
			.addText(text => text
				.setValue(this.plugin.settings.openai_api_key)
				.onChange(async (value) => {
					this.plugin.settings.openai_api_key = value;
					await this.plugin.saveSettings();
				}));
	}
}
