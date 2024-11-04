import * as vscode from "vscode";

/**
 * Представляет элемент в древовидной структуре классов
 * Расширяет стандартный TreeItem VSCode для поддержки иерархии классов
 */
export class TreeItem extends vscode.TreeItem {
  public subItems?: TreeItem[];
  public classNamePath: string;

  constructor(
    public className: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    classNamePath: string,
    subItems?: TreeItem[],
    contextValue?: string
  ) {
    super(className, collapsibleState);
    this.classNamePath = classNamePath;
    this.subItems = subItems;
    if (contextValue) {
      this.contextValue = contextValue;
    }
  }
}
