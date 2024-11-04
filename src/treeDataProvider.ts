import * as vscode from "vscode";
import { TreeItem } from "./models/TreeItem";
import { HtmlClassParser } from "./services/HtmlClassParser";

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private changeEmitter = new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    vscode.window.onDidChangeActiveTextEditor(() => this.refreshTree());
    vscode.window.onDidChangeTextEditorSelection(() => this.refreshTree());
    vscode.workspace.onDidChangeTextDocument(() => this.refreshTree());
  }

  private refreshTree(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) {
      return Promise.resolve(element.subItems || []);
    }

    const editor = vscode.window.activeTextEditor;
    if (!this.isValidHtmlEditor(editor)) {
      return Promise.resolve([this.createMessageItem(vscode.l10n.t("message.selectHtmlFile"))]);
    }

    const classValue = HtmlClassParser.findClassAtCursor(
      editor.document,
      editor.selection.active
    );

    if (!classValue) {
      return Promise.resolve([this.createMessageItem(vscode.l10n.t('message.placeCursorInClassAttribute'))]);
    }

    return Promise.resolve(HtmlClassParser.createClassTree(classValue));
  }

  private isValidHtmlEditor(editor?: vscode.TextEditor): boolean {
    return !!editor && editor.document.languageId === "html";
  }

  private createMessageItem(message: string): TreeItem {
    return new TreeItem(
      message,
      vscode.TreeItemCollapsibleState.None,
      ""
    );
  }

  public async addNewClass(className: string): Promise<void> {
    console.log(`Adding new class: ${className}`);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.noActiveEditor"));
      return;
    }

    const position = editor.selection.active;
    const success = await HtmlClassParser.addClassAtCursor(
      editor.document,
      position,
      className
    );

    if (!success) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.addClassFailed"));
      return;
    }

    this.refreshTree();
    console.log(`Class added successfully: ${className}`);
  }

  public async addSubClass(parentItem: TreeItem, subClassName: string): Promise<void> {
    console.log(`Adding subclass: ${subClassName} to parent class: ${parentItem.className}`);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.noActiveEditor"));
      return;
    }

    const position = editor.selection.active;
    const success = await HtmlClassParser.addSubClassAtCursor(
      editor.document,
      position,
      parentItem.className,
      subClassName
    );

    if (!success) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.addClassFailed"));
      return;
    }

    this.refreshTree();
    console.log(`Subclass added successfully: ${subClassName}`);
  }

  public async renameClass(item: TreeItem, newClassName: string): Promise<void> {
    console.log(`Renaming class: ${item.className} to ${newClassName}`);
    const oldClassName = item.className;
    item.className = newClassName;

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const success = await HtmlClassParser.updateClassName(editor.document, oldClassName, newClassName);
      if (!success) {
        vscode.window.showErrorMessage(vscode.l10n.t("error.renameClassFailed"));
        return;
      }
    }

    this.refreshTree();
    console.log(`Class renamed successfully: ${oldClassName} to ${newClassName}`);
  }

  public async removeClass(item: TreeItem): Promise<void> {
    console.log(`Removing class: ${item.className}`);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.noActiveEditor"));
      return;
    }

    const position = editor.selection.active;
    const success = await HtmlClassParser.removeClassAtCursor(
      editor.document,
      position,
      item.className
    );

    if (!success) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.removeClassFailed"));
      return;
    }

    this.refreshTree();
    console.log(`Class removed successfully: ${item.className}`);
  }

  // Метод для перемещения класса в новое место
  public async moveClass(item: TreeItem, newParentItem: TreeItem): Promise<void> {
    console.log(`Moving class: ${item.className} to new parent: ${newParentItem.className}`);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.noActiveEditor"));
      return;
    }

    // Проверяем, является ли newParentItem корнем
    const newClassNamePath = newParentItem.classNamePath
      ? `${newParentItem.classNamePath}:${item.className}`
      : item.className; // Если корень, используем только имя класса

    // Пытаемся обновить имя класса во всем документе
    const success = await HtmlClassParser.updateClassName(
      editor.document,
      item.classNamePath,
      newClassNamePath
    );

    if (!success) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.moveClassFailed"));
      return;
    }

    this.refreshTree();
    console.log(`Class moved successfully: ${item.className} to ${newParentItem.className}`);
  }

  // Добавляем новый метод для перемещения в корень
  public async moveToRoot(item: TreeItem, newClassName: string): Promise<void> {
    console.log(`Moving class to root: ${item.className}`);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.noActiveEditor"));
      return;
    }

    const success = await HtmlClassParser.updateClassName(
      editor.document,
      item.classNamePath,
      newClassName
    );

    if (!success) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.moveClassFailed"));
      return;
    }

    this.refreshTree();
    console.log(`Class moved to root successfully: ${item.className}`);
  }
}
