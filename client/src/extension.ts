/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	workspace as Workspace, window as Window, ExtensionContext, TextDocument, OutputChannel, WorkspaceFolder, Uri
} from 'vscode';

import {
	LanguageClient, LanguageClientOptions, TransportKind
} from 'vscode-languageclient/node';

let defaultClient: LanguageClient;
const clients = new Map<string, LanguageClient>();

let _sortedWorkspaceFolders: string[] | undefined;
function sortedWorkspaceFolders(): string[] {
	if (_sortedWorkspaceFolders === void 0) {
		_sortedWorkspaceFolders = Workspace.workspaceFolders ? Workspace.workspaceFolders.map(folder => {
			let result = folder.uri.toString();
			if (result.charAt(result.length - 1) !== '/') {
				result = result + '/';
			}
			return result;
		}).sort(
			(a, b) => {
				return a.length - b.length;
			}
		) : [];
	}
	return _sortedWorkspaceFolders;
}
Workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined);

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
	const sorted = sortedWorkspaceFolders();
	for (const element of sorted) {
		let uri = folder.uri.toString();
		if (uri.charAt(uri.length - 1) !== '/') {
			uri = uri + '/';
		}
		if (uri.startsWith(element)) {
			return Workspace.getWorkspaceFolder(Uri.parse(element))!;
		}
	}
	return folder;
}

export function activate(context: ExtensionContext) {

	// const module = context.asAbsolutePath(path.join('java', '-jar', '../out/sls/assembly.dest/out.jar'));	
	const outputChannel: OutputChannel = Window.createOutputChannel('Simple Language Server');
	const serverJarPath = context.asAbsolutePath("../simple-language-server/out/sls/assembly.dest/out.jar");
	const serverOptions = {
		run: {
			command: 'java',
			args: ['-jar', serverJarPath],
			transport: TransportKind.stdio
		},
		debug: {
			command: 'java',
			args: [
				// '-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:6666',
				'-jar',
				serverJarPath
			],
			transport: TransportKind.stdio
		}
	};

	// Define supported file extensions
	const supportedFileExtensions = ['scala', 'java', 'mill', 'sbt'];

	function didOpenTextDocument(document: TextDocument): void {
		// We are only interested in language mode text
		console.log(document);
		console.log(document.languageId);
		if (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled') {
			return;
		}

		const uri = document.uri;
		// Untitled files go to a default client.
		if (uri.scheme === 'untitled' && !defaultClient) {
			const clientOptions: LanguageClientOptions = {
				documentSelector: supportedFileExtensions.map(ext => ({ scheme: 'untitled', language: ext })),
				diagnosticCollectionName: 'Simple Language Server',
				outputChannel: outputChannel
			};
			defaultClient = new LanguageClient('Scala Language Client', 'Scala Language Server', serverOptions, clientOptions);
			defaultClient.start();
			return;
		}
		let folder = Workspace.getWorkspaceFolder(uri);
		// Files outside a folder can't be handled. This might depend on the language.
		// Single file languages like JSON might handle files outside the workspace folders.
		if (!folder) {
			return;
		}
		// If we have nested workspace folders we only start a server on the outermost workspace folder.
		folder = getOuterMostWorkspaceFolder(folder);

		if (!clients.has(folder.uri.toString())) {
			const clientOptions: LanguageClientOptions = {
				documentSelector: supportedFileExtensions.map(ext => ({
					scheme: 'file',
					language: ext,
					pattern: `${folder.uri.fsPath}/**/*`
				})),
				diagnosticCollectionName: 'Simple Language Server',
				workspaceFolder: folder,
				outputChannel: outputChannel
			};
			const client = new LanguageClient('Scala Language Client', 'Scala Language Server', serverOptions, clientOptions);
			client.start();
			clients.set(folder.uri.toString(), client);
		}
	}

	Workspace.onDidOpenTextDocument(didOpenTextDocument);
	Workspace.textDocuments.forEach(didOpenTextDocument);
	Workspace.onDidChangeWorkspaceFolders((event) => {
		for (const folder of event.removed) {
			const client = clients.get(folder.uri.toString());
			if (client) {
				clients.delete(folder.uri.toString());
				client.stop();
			}
		}
	});
}

export function deactivate(): Thenable<void> {
	const promises: Thenable<void>[] = [];
	if (defaultClient) {
		promises.push(defaultClient.stop());
	}
	for (const client of clients.values()) {
		promises.push(client.stop());
	}
	return Promise.all(promises).then(() => undefined);
}
