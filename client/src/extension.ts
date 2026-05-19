import { workspace, ExtensionContext, commands, window, Uri, EventEmitter } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	TransportKind
} from 'vscode-languageclient/node';

import { execSync } from 'child_process';

let client: LanguageClient;
const supportedFileExtensions = ['scala', 'java', 'mill', 'sbt', 'sc'];

const debugIndexScheme = 'sls-debug-index';
const debugIndexUri = Uri.parse(`${debugIndexScheme}:Debug Index`);
let debugIndexContent = '';
const debugIndexChangeEmitter = new EventEmitter<Uri>();

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverJarPath = context.asAbsolutePath("../sls/out/sls/assembly.dest/out.jar");
	const tracer = process.env.LANGOUSTINE_TRACER;
	if (!tracer) {
		throw new Error('LANGOUSTINE_TRACER is not set — launch VS Code from the project devShell so the shellHook exports it.');
	}
	const command = tracer;

	// log java version from cli
	const javaVersion = execSync('java -version', { encoding: 'utf-8' });
	console.log(`Java Version: ${javaVersion}`)

	const serverOptions = {
		run: {
			command: command,
			args: [
				serverJarPath, 
			],
		},
		debug: {
			command: "java",
			args: [
				// "-agentlib:jdwp=transport=dt_socket,server=y,quiet=y,suspend=n,address=*:6666",
				"-Dotel.service.name=simple-language-server",
				"-Dsls.profiling=true",
				"-Dotel.sdk.disabled=false",
				"-Dcats.effect.trackFiberContext=true",
				"-Dscala.classpath.closeZip=true",
				"-Dsls.trace.lsp.messages=true",
				"-Dsls.trace.csp.messages=true",
				"-jar",
				serverJarPath,
                "org.scala.abusers.sls.SimpleScalaServer"
			], 
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: supportedFileExtensions.map(ext => ({
			scheme: 'file',
			language: ext,
		})),
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	const debugIndexProvider = workspace.registerTextDocumentContentProvider(debugIndexScheme, {
		onDidChange: debugIndexChangeEmitter.event,
		provideTextDocumentContent() {
			return debugIndexContent;
		},
	});

	const debugIndexCommand = commands.registerCommand('sls.debugIndex', async () => {
		if (!client) {
			window.showErrorMessage('Language server is not running.');
			return;
		}

		const query = await window.showInputBox({
			prompt: 'Enter a symbol query (leave empty for stats only)',
			placeHolder: 'symbol name',
		});

		if (query === undefined) {
			return; // user cancelled
		}

		try {
			const result = await client.sendRequest('sls/debugIndex', { query: query || undefined });
			debugIndexContent = JSON.stringify(result, null, 2);
			debugIndexChangeEmitter.fire(debugIndexUri);
			const doc = await workspace.openTextDocument(debugIndexUri);
			await window.showTextDocument(doc, { preview: true });
		} catch (err) {
			window.showErrorMessage(`Debug Index request failed: ${err}`);
		}
	});

	context.subscriptions.push(debugIndexProvider, debugIndexCommand);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
