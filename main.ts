import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, requestUrl, RequestUrlParam, RequestUrlResponse, Setting, TAbstractFile, TextComponent } from 'obsidian';

const DEFAULT_PROMPT = `# Goal
用户提供文件名，你为文件生成只含有英文、连字符-、数字的slug

# Example
输入 linux中移除sshkey的密码
输出 remove-ssh-key-passphrase

# Attention
- 牢记 你只是在帮助用户编写 slug
- 只生成slug
- 不要生成完整的文件名
- slug要详尽而具体
`

interface GenerateSlugPluginSettings {
	openai_completion_url: string;
	openai_api_key: string;
	openai_model: string;
	prompt: string;
}

const DEFAULT_SETTINGS: GenerateSlugPluginSettings = {
	openai_completion_url: 'https://api.deepseek.com/chat/completions',
	openai_model: 'deepseek-chat',
	openai_api_key: '',
	prompt: DEFAULT_PROMPT,
}

class GeneratingModal extends Modal {
	file: TAbstractFile;
	settings: GenerateSlugPluginSettings;
	error: string;

	constructor(app: App, settings: GenerateSlugPluginSettings, file: TAbstractFile) {
		super(app);
		this.settings = settings;
		this.file = file;
	}

	async generateSlug(content: string): Promise<string> {
		const url = this.settings.openai_completion_url;
		const model = this.settings.openai_model;
		const prompt = this.settings.prompt;
		if (!url) {
			new Notice('[Generate Slug] OpenAI Completion URL not set!');
			return '';
		}

		if (!this.settings.openai_api_key) {
			new Notice('[Generate Slug] OpenAI API Key not set!');
			return '';
		}

		if (!model) {
			new Notice('[Generate Slug] OpenAI Model not set!');
			return '';
		}

		if (!prompt) {
			new Notice('[Generate Slug] Prompt not set!');
			return '';
		}

		const options: RequestUrlParam = {
		    url: url,
		    method: 'POST',
		    headers: {
		        'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.openai_api_key}`
		    },
		    body: JSON.stringify({
						model: model,
						messages: [
							{ role: 'system', content: prompt },
							{ role: 'user', content: content }
						],
						stream: false
					})
		}
		var response: RequestUrlResponse;

		try
		{
			response = await requestUrl(options);
		    return response.json.choices[0].message.content;
		}
		catch (e) {
			this.error = JSON.stringify(e);
		}
		return '';
	}
	
	updateSlugValue(slugValue: string) {
		const slug_property_name = 'slug';
		const vault = this.app.vault;
		const f = this.file.vault.getFileByPath(this.file.path)
		if (!f) {
			new Notice('File not found!');
			return;
		}
		vault.read(f).then(async (content) => {
			// find properties, using regex
			const properties = content.match(new RegExp(`^---\n([\\s\\S]*?)\n---`));
			if (!properties) {
				// add properties if not found
				const newProperties = `---\n${slug_property_name}: ${slugValue}\n---`;
				const newContent = newProperties + content;
				await vault.modify(f, newContent);
				return;
			}
			
			// find slug property
			const slug_property = properties[1].match(new RegExp(`^${slug_property_name}: (.*)`, 'm'));
			if (!slug_property) {
				// add slug property
				const newProperties = properties[1] + `\n${slug_property_name}: ${slugValue}`;
				const newContent = content.replace(properties[1], newProperties);
				await vault.modify(f, newContent);
				return;
			} else {
				const newProperties = properties[1].replace(new RegExp(`^${slug_property_name}: (.*)`, 'm'), `${slug_property_name}: ${slugValue}`);
				const newContent = content.replace(properties[1], newProperties);
				await vault.modify(f, newContent);
			}
			new Notice('Slug generated!');
			this.close();
		})
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Generating slug...');
		const file = this.file;
		const f = this.file.vault.getFileByPath(this.file.path)
		if (!f) {
			new Notice('File not found!');
			return;
		}

		const filename = file.name;
		new Notice(`Generating slug for ${filename}`);
		this.generateSlug(filename).then((slugValue) => {
			if (this.error) {
				contentEl.setText('Generate ERROR!\n' + this.error);
				return;
			} else {
				this.updateSlugValue(slugValue);
			}
		}).catch((e) => {
			this.error = JSON.stringify(e);
			contentEl.setText('Generate ERROR!\n' + this.error);
		})
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
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
							new GeneratingModal(this.app, this.settings, file).open();
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

		const urlSetting = new Setting(containerEl)
			.setName('OpenAI Completion URL')
			.setDesc('The URL for the OpenAI Completion API, e.g. https://api.openai.com/v1/engines/davinci/completions')
			.addText(text => {
				text.inputEl.addClass('plugin-generate-slug-settings-input');
				return text
					.setValue(this.plugin.settings.openai_completion_url)
					.onChange(async (value) => {
						this.plugin.settings.openai_completion_url = value;
						await this.plugin.saveSettings();
					});
			});
		
		// urlSetting.controlEl.addClass('generate-slug-setting');
		
		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('The API key for the OpenAI API')
			.addText(text => {
				text.inputEl.addClass('plugin-generate-slug-settings-input');
				return text
					.setValue(this.plugin.settings.openai_api_key)
					.onChange(async (value) => {
						this.plugin.settings.openai_api_key = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('OpenAI Model')
			.setDesc('The OpenAI model to use, e.g. deepseek-chat')
			.addText(text => {
				text.inputEl.addClass('plugin-generate-slug-settings-input');
				return text
					.setValue(this.plugin.settings.openai_model)
					.onChange(async (value) => {
						this.plugin.settings.openai_model = value;
						await this.plugin.saveSettings();
					});
			});
		
		new Setting(containerEl)
			.setName('Prompt')
			.setDesc('The prompt for the OpenAI API')
			.addTextArea(text => {
				text.inputEl.addClass('plugin-generate-slug-settings-textarea');
				return text
					.setValue(this.plugin.settings.prompt)
					.onChange(async (value) => {
						this.plugin.settings.prompt = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
