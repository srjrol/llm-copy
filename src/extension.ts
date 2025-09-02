import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

type SectionChoice = 'Tree' | 'Files' | 'Diagnostics';

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  '.DS_Store',
  '.vscode',
  'dist',
  'build',
  'out'
]);

let lastChoices: Set<SectionChoice> | null = null;

export function activate(context: vscode.ExtensionContext) {
  const copyCommand = vscode.commands.registerCommand(
    'copyAsPrompt.copy',
    async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
      try {
        const targets = normalizeTargets(uri, uris);
        if (targets.length === 0) {
          vscode.window.showWarningMessage('Nothing selected.');
          return;
        }

        const include = await askWhichSections();
        if (!include) return;

        const { files, roots } = await collectFiles(targets);
        if (files.length === 0) {
          vscode.window.showWarningMessage('No files found in selection.');
          return;
        }

        const output = await buildOutput(files, roots, include);
        await vscode.env.clipboard.writeText(output);
        vscode.window.showInformationMessage('Copied to clipboard in AI-prompt format.');
      } catch (error) {
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error: ${error.message}`);
        } else {
          vscode.window.showErrorMessage('Unknown error occurred.');
        }
      }
    }
  );

  context.subscriptions.push(copyCommand);
}

export function deactivate() {}

/* ---------- Helpers ---------- */

function normalizeTargets(uri?: vscode.Uri, uris?: vscode.Uri[]): vscode.Uri[] {
  // VS Code passes (uri, uris[]) when multiple items are selected in Explorer.
  if (uris && uris.length > 0) return uris;
  if (uri) return [uri];
  return [];
}

async function askWhichSections(): Promise<Set<SectionChoice> | null> {
  const items: vscode.QuickPickItem[] = [
    { label: '$(list-tree) Tree', picked: lastChoices?.has('Tree') ?? true },
    { label: '$(code) Files', picked: lastChoices?.has('Files') ?? true },
    { label: '$(warning) Diagnostics', picked: lastChoices?.has('Diagnostics') ?? true }
  ];

  const chosen = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: 'Copy As Prompt — choose sections to include',
    ignoreFocusOut: true,
    matchOnDescription: false
  });

  if (!chosen) return null;

  const set = new Set<SectionChoice>();
  for (const c of chosen) {
    if (c.label.includes('Tree')) set.add('Tree');
    if (c.label.includes('Files')) set.add('Files');
    if (c.label.includes('Diagnostics')) set.add('Diagnostics');
  }

  lastChoices = set;
  return set;
}

async function collectFiles(targets: vscode.Uri[]) {
  const roots = targets.map(u => u.fsPath);
  const results: string[] = [];

  for (const u of targets) {
    const stat = await fsp.stat(u.fsPath);
    if (stat.isFile()) {
      results.push(u.fsPath);
    } else if (stat.isDirectory()) {
      const files = await walkDir(u.fsPath);
      results.push(...files);
    }
  }

  // De-duplicate and sort to stable order
  const unique = Array.from(new Set(results)).sort();
  return { files: unique, roots };
}

async function walkDir(dir: string, seen = new Set<string>()): Promise<string[]> {
  const out: string[] = [];
  if (seen.has(dir)) return out;
  seen.add(dir);

  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch {
    return out;
  }

  for (const name of entries) {
    if (DEFAULT_IGNORE.has(name)) continue;

    const full = path.join(dir, name);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(full);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const nested = await walkDir(full, seen);
      out.push(...nested);
    } else if (stat.isFile()) {
      out.push(full);
    }
  }

  return out;
}

async function buildOutput(
  files: string[],
  roots: string[],
  include: Set<SectionChoice>
): Promise<string> {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const rel = (p: string) => (ws ? path.relative(ws, p) || path.basename(p) : p);

  const sections: string[] = [];

  if (include.has('Tree')) {
    sections.push(renderTreeSection(roots));
  }
  if (include.has('Files')) {
    sections.push(await renderFilesSection(files));
  }
  if (include.has('Diagnostics')) {
    sections.push(renderDiagnosticsSection(files, roots));
  }

  // Header with context
  const headerLines = [
    '# Copy for LLM',
    ws ? `Workspace: \`${path.basename(ws)}\`` : undefined,
    roots.length > 1
      ? `Roots: ${roots.map(r => `\`${rel(r)}\``).join(', ')}`
      : `Root: \`${rel(roots[0])}\``
  ].filter(Boolean);

  return [headerLines.join('\n'), '', ...sections].join('\n');
}

/* ---------- Tree ---------- */

function renderTreeSection(roots: string[]): string {
  const lines: string[] = ['## Tree', '```text'];
  for (const root of roots) {
    const rootName = path.basename(root);
    lines.push(rootName);
    lines.push(...renderAsciiTree(root, rootName));
  }
  lines.push('```', '');
  return lines.join('\n');
}

function renderAsciiTree(rootPath: string, displayRoot: string): string[] {
  const lines: string[] = [];
  function recur(dir: string, prefix: string) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir).filter(n => !DEFAULT_IGNORE.has(n));
    } catch {
      return;
    }
    entries.sort((a, b) => a.localeCompare(b));
    entries.forEach((name, idx) => {
      const full = path.join(dir, name);
      const isLast = idx === entries.length - 1;
      const branch = isLast ? '└─ ' : '├─ ';
      const nextPrefix = prefix + (isLast ? '   ' : '│  ');
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        return;
      }
      lines.push(prefix + branch + name);
      if (stat.isDirectory()) recur(full, nextPrefix);
    });
  }
  recur(rootPath, '');
  return lines.map(l => (l.startsWith(displayRoot) ? l : '  ' + l));
}

/* ---------- Files ---------- */

async function renderFilesSection(files: string[]): Promise<string> {
  const parts: string[] = ['## Files'];
  for (const filePath of files) {
    parts.push(await formatFileContent(filePath));
  }
  return parts.join('\n');
}

async function formatFileContent(filePath: string): Promise<string> {
  let content = '';
  try {
    content = await fsp.readFile(filePath, 'utf-8');
  } catch (e) {
    content = `<<Unable to read file: ${(e as Error)?.message ?? 'unknown error'}>>`;
  }

  const rel = vscode.workspace.asRelativePath(filePath);
  const ext = path.extname(filePath).replace('.', '') || 'text';

  // Guard for very large files (keep clipboard responsive)
  const MAX_BYTES = 700_000; // ~700 KB
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
    content =
      content.slice(0, MAX_BYTES / 2) +
      '\n\n<<TRUNCATED DUE TO SIZE>>\n\n' +
      content.slice(-MAX_BYTES / 2);
  }

  return `${rel}:\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
}

/* ---------- Diagnostics ---------- */

function renderDiagnosticsSection(files: string[], roots: string[]): string {
  const byFile = collectDiagnostics(files, roots);
  const lines: string[] = ['## Diagnostics'];

  if (byFile.size === 0) {
    lines.push('_No diagnostics for the selected items._', '');
    return lines.join('\n');
  }

  for (const [file, diags] of byFile) {
    const rel = vscode.workspace.asRelativePath(file);
    lines.push(`### ${rel}`);
    for (const d of diags) {
      const pos = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
      const sev = severityLabel(d.severity);
      const code = d.code ? ` [${String(d.code)}]` : '';
      lines.push(`- (${sev}) ${pos}${code} — ${d.message}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function collectDiagnostics(files: string[], roots: string[]) {
  const fileSet = new Set(files.map(f => path.normalize(f)));
  const rootSet = roots.map(r => path.normalize(r));

  const all = vscode.languages.getDiagnostics(); // [Uri, Diagnostic[]][]
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const [uri, diags] of all) {
    const p = path.normalize(uri.fsPath);

    // Include if it's one of the selected files
    // or it is inside any selected folder.
    const insideSelectedFolder = rootSet.some(root => p.startsWith(root + path.sep));
    if (fileSet.has(p) || insideSelectedFolder) {
      if (!byFile.has(p)) byFile.set(p, []);
      byFile.get(p)!.push(...diags);
    }
  }

  // Keep only error/warn/info/hint that exist
  for (const [p, arr] of byFile) {
    const filtered = arr.filter(Boolean);
    if (filtered.length === 0) byFile.delete(p);
    else byFile.set(p, filtered);
  }

  return byFile;
}

function severityLabel(sev: vscode.DiagnosticSeverity): string {
  switch (sev) {
    case vscode.DiagnosticSeverity.Error:
      return 'Error';
    case vscode.DiagnosticSeverity.Warning:
      return 'Warning';
    case vscode.DiagnosticSeverity.Information:
      return 'Info';
    case vscode.DiagnosticSeverity.Hint:
      return 'Hint';
    default:
      return 'Unknown';
  }
}
