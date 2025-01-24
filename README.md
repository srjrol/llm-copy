To update the `README.md` file for your extension, you'll want to provide clear, concise, and helpful information for users. Here's a basic template you can follow, tailored for your "Copy as AI Prompt" extension:

---

## **Copy as AI Prompt**

### **Description**
The "Copy as AI Prompt" extension for Visual Studio Code allows you to quickly format files or folders into a structured text format suitable for use in AI prompts. This eliminates the need for manual formatting, saving time and effort.

---

### **Features**
- **Right-click to Copy**: Right-click on a file or directory in the Explorer and select **"Copy as AI Prompt"**.
- **Formatted Output**: Automatically formats file content as:
  ```
  relative\path\to\file:
  ```filetype
  <content>
  ```
  ```
- **Supports Directories**: Recursively processes all files in a selected folder.

---

### **How to Use**
1. Install the extension in Visual Studio Code.
2. Right-click on a file or folder in the Explorer sidebar.
3. Select **"Copy as AI Prompt"** from the context menu.
4. The formatted output is copied to your clipboard.
5. Paste it into your AI tool or wherever it's needed.

---

### **Installation**
#### From VSIX:
1. Download the `.vsix` file from your local build.
2. Open Visual Studio Code.
3. Go to the Extensions view (`Ctrl+Shift+X`).
4. Click on the `...` menu (top-right corner) and select **"Install from VSIX..."**.
5. Choose the `.vsix` file and install.

#### From Source:
1. Clone this repository:
   ```bash
   git clone https://github.com/your-repo/copy-as-ai-prompt
   cd copy-as-ai-prompt
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Press `F5` in Visual Studio Code to run a development instance with the extension.

---

### **Examples**
#### Single File
For a file located at `src/app.html`:
```
src\app.html:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <h1>Hello World</h1>
  </body>
</html>
```
```

#### Directory
For a folder with multiple files:
```
src\app.html:
```html
<!doctype html>
...
```

src\style.css:
```css
body {
  background: #fff;
}
```
```

---

### **Development**
To modify the extension:
1. Clone the repository.
2. Open the project in Visual Studio Code.
3. Make changes to the `src/extension.ts` file.
4. Package the extension using `vsce package`.
5. Test the `.vsix` file or use `F5` to launch a development instance.

---

### **License**
This project is licensed under the [MIT License](LICENSE).

---

Feel free to adjust this template to include any additional details specific to your extension. Let me know if you'd like help customizing it further!