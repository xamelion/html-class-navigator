import * as vscode from "vscode";

export class TreeItem extends vscode.TreeItem {
  public subItems?: TreeItem[];
  public classNamePath: string;

  constructor(
    public className: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    classNamePath: string,
    subItems?: TreeItem[],
    contextValue?: string // Добавили опциональный параметр contextValue
  ) {
    super(className, collapsibleState);
    this.classNamePath = classNamePath;
    this.subItems = subItems;

    if (contextValue) {
      this.contextValue = contextValue;
    }
  }
}
