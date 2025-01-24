import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const copyCommand = vscode.commands.registerCommand('copyAsPrompt.copy', async (uri: vscode.Uri) => {
        try {
            const output = await processFileOrDirectory(uri.fsPath);
            await vscode.env.clipboard.writeText(output);
            vscode.window.showInformationMessage('Files copied in AI prompt format!');
        } catch (error) {
            // Ensure the error is an object and has a 'message' property
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Unknown error occurred.`);
            }
        }
    });

    context.subscriptions.push(copyCommand);
}

async function processFileOrDirectory(filePath: string): Promise<string> {
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
        return formatFileContent(filePath);
    } else if (stats.isDirectory()) {
        return formatDirectoryContent(filePath);
    } else {
        throw new Error('Selected item is neither a file nor a directory.');
    }
}

function formatFileContent(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = vscode.workspace.asRelativePath(filePath);
    const extension = path.extname(filePath).replace('.', '');

    return `${relativePath}:\n\`\`\`${extension}\n${content}\n\`\`\`\n`;
}

async function formatDirectoryContent(dirPath: string): Promise<string> {
    const files = fs.readdirSync(dirPath);
    const results = await Promise.all(
        files.map(async (file) => {
            const fullPath = path.join(dirPath, file);
            const stats = fs.statSync(fullPath);

            if (stats.isFile()) {
                return formatFileContent(fullPath);
            } else if (stats.isDirectory()) {
                return formatDirectoryContent(fullPath);
            } else {
                return '';
            }
        })
    );
    return results.join('\n');
}

export function deactivate() {}
