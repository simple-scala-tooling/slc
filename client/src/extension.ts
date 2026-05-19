import { workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	TransportKind
} from 'vscode-languageclient/node';

import { execSync } from 'child_process';

let client: LanguageClient;
const supportedFileExtensions = ['scala', 'java', 'mill', 'sbt', 'sc'];

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverJarPath = context.asAbsolutePath("../simple-language-server/out/sls/assembly.dest/out.jar");
	const javaHome = process.env.JAVA_HOME;
	if (!javaHome) {
		throw new Error('JAVA_HOME is not set — launch VS Code from the project devShell so the shellHook exports it.');
	}
	const command = `${javaHome}/bin/java`;

	// log java version from cli
	const javaVersion = execSync('java -version', { encoding: 'utf-8' });
	console.log(`Java Version: ${javaVersion}`);
	
	const serverOptions = {
		run: {
			command: command,
			args: ["-jar", serverJarPath],
			transport: TransportKind.stdio
		},
		debug: {
			command: command,
			args: [
				// '-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:6666',
				"-jar",
				serverJarPath
			],
			transport: TransportKind.stdio
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
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
