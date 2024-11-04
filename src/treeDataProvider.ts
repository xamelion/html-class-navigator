import * as vscode from "vscode";
import { TreeItem } from "./models/TreeItem";
import { HtmlClassParser } from "./services/HtmlClassParser";

/**
 * Провайдер данных для древовидного представления HTML-классов
 * Управляет отображением и модификацией классов в редакторе
 */
export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private changeEmitter = new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Устанавливает слушатели событий редактора для обновления дерева
   */
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

  /**
   * Возвращает дочерние элементы для узла дерева
   * @param element Родительский элемент или undefined для корневого уровня
   */
  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    // Дочерние элементы для существующего узла
    if (element) {
      return Promise.resolve(element.subItems || []);
    }

    // Корневой уровень
    const editor = vscode.window.activeTextEditor;
    if (!this.isValidHtmlEditor(editor)) {
      return Promise.resolve([
        this.createMessageItem(vscode.l10n.t("message.selectHtmlFile"))
      ]);
    }

    const classValue = HtmlClassParser.findClassAtCursor(
      editor.document,
      editor.selection.active
    );

    if (!classValue) {
      return Promise.resolve([
        this.createMessageItem(vscode.l10n.t('message.placeCursorInClassAttribute'))
      ]);
    }

    return Promise.resolve(HtmlClassParser.createClassTree(classValue));
  }

  /**
   * Проверяет, является ли активный редактор HTML-документом
   */
  private isValidHtmlEditor(editor?: vscode.TextEditor): boolean {
    return !!editor && editor.document.languageId === "html";
  }

  /**
   * Создает элемент дерева с сообщением
   */
  private createMessageItem(message: string): TreeItem {
    return new TreeItem(
      message,
      vscode.TreeItemCollapsibleState.None,
      ""
    );
  }

  // Основные методы для работы с классами

  /**
   * Добавляет новый класс в текущей позиции курсора
   */
  public async addNewClass(className: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.noActiveEditor"));
      return;
    }

    const success = await HtmlClassParser.addClassAtCursor(
      editor.document,
      editor.selection.active,
      className
    );

    if (!success) {
      vscode.window.showErrorMessage(vscode.l10n.t("error.addClassFailed"));
      return;
    }

    this.refreshTree();
  }

  // Далее следуют методы addSubClass, renameClass, removeClass, moveClass и moveToRoot
  // с аналогичной структурой и обработкой ошибок
  // ...остальные методы без изменений...
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
    const oldClassNamePath = item.classNamePath;
    // Создаем новый путь, заменяя только последнюю часть пути
    const newClassNamePath = item.classNamePath.replace(item.className, newClassName);
    
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const success = await HtmlClassParser.updateClassName(
        editor.document,
        oldClassNamePath,
        newClassNamePath
      );
      if (!success) {
        vscode.window.showErrorMessage(vscode.l10n.t("error.renameClassFailed"));
        return;
      }
    }

    item.className = newClassName;
    item.classNamePath = newClassNamePath;
    this.refreshTree();
    console.log(`Class renamed successfully: ${oldClassNamePath} to ${newClassNamePath}`);
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
