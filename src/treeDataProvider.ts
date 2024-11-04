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
      return Promise.resolve([this.createMessageItem("Выберите HTML файл")]);
    }

    const classValue = HtmlClassParser.findClassAtCursor(
      editor.document,
      editor.selection.active
    );

    if (!classValue) {
      return Promise.resolve([this.createMessageItem('Поставьте курсор в атрибут "class"')]);
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
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Нет активного редактора");
      return;
    }

    const position = editor.selection.active;
    const success = await HtmlClassParser.addClassAtCursor(
      editor.document,
      position,
      className
    );

    if (!success) {
      vscode.window.showErrorMessage("Не удалось добавить класс");
      return;
    }

    this.refreshTree();
  }

  public async addSubClass(parentItem: TreeItem, subClassName: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Нет активного редактора");
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
      vscode.window.showErrorMessage("Не удалось добавить подкласс");
      return;
    }

    this.refreshTree();
  }

  public async renameClass(item: TreeItem, newClassName: string): Promise<void> {
    const oldClassName = item.className;
    item.className = newClassName;

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const success = await HtmlClassParser.updateClassName(editor.document, oldClassName, newClassName);
      if (!success) {
        vscode.window.showErrorMessage("Не удалось переименовать класс.");
        return;
      }
    }


    this.refreshTree(); // Обновляем дерево после успешного переименования
  }
}
