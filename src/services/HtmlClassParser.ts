import * as vscode from "vscode";
import { TreeItem } from "../models/TreeItem";

interface DeviceDescription {
  prefix: string;
  description: string;
  order: number;
}

export class HtmlClassParser {
  private static readonly deviceTypes: DeviceDescription[] = [
    { prefix: "ph", description: "Телефон", order: 1 },
    { prefix: "tb", description: "Планшет", order: 2 },
    { prefix: "lp", description: "Ноутбук", order: 3 },
    { prefix: "dk", description: "Десктоп", order: 4 },
    { prefix: "wd", description: "Широкий формат", order: 5 }
  ];

  public static findClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | null {
    const documentText = document.getText();
    const cursorOffset = document.offsetAt(position);
    const classPattern = /class\s*=\s*(["'])(.*?)\1/g;
    
    let matchResult;
    while ((matchResult = classPattern.exec(documentText)) !== null) {
      const classValueStart = matchResult.index + matchResult[0].indexOf(matchResult[1]) + 1;
      const classValueEnd = classValueStart + matchResult[2].length;

      if (cursorOffset >= classValueStart && cursorOffset <= classValueEnd) {
        return matchResult[2];
      }
    }
    return null;
  }

  public static createClassTree(classValue: string): TreeItem[] {
    const individualClasses = classValue.split(/\s+/);
    const rootElements: TreeItem[] = [];

    individualClasses.forEach(className => {
      const classNameParts = className.split(":");
      this.addClassNodeToTree(rootElements, classNameParts, "");
    });

    // Сортируем корневые элементы
    return this.sortTreeItems(rootElements);
  }

  private static addClassNodeToTree(
    items: TreeItem[],
    classNameParts: string[],
    parentPath: string
  ): void {
    if (classNameParts.length === 0) return;

    const currentClassName = classNameParts[0];
    const currentPath = parentPath ? `${parentPath}:${currentClassName}` : currentClassName;
    
    let existingItem = items.find(item => item.className === currentClassName);
    
    if (!existingItem) {
      existingItem = new TreeItem(
        currentClassName,
        vscode.TreeItemCollapsibleState.Expanded,
        currentPath,
        undefined,
        "renameable" // Устанавливаем contextValue только для классов
      );

      if (!parentPath) {
        existingItem.description = this.getDeviceDescription(currentClassName);
      }

      items.push(existingItem);
    }

    if (classNameParts.length > 1) {
      if (!existingItem.subItems) {
        existingItem.subItems = [];
      }
      this.addClassNodeToTree(existingItem.subItems, classNameParts.slice(1), currentPath);
      // Сортируем подэлементы после добавления
      existingItem.subItems = this.sortTreeItems(existingItem.subItems);
    } else {
      existingItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
  }

  private static getDeviceDescription(className: string): string {
    return this.deviceTypes
      .filter(device => className.includes(device.prefix))
      .map(device => device.description)
      .join(" ");
  }

  private static getDeviceOrder(className: string): number {
    const device = this.deviceTypes.find(d => className.includes(d.prefix));
    return device ? device.order : 0;
  }

  private static sortTreeItems(items: TreeItem[]): TreeItem[] {
    return items.sort((a, b) => {
      const orderA = this.getDeviceOrder(a.className);
      const orderB = this.getDeviceOrder(b.className);

      // Сначала сортируем по порядку устройств
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Затем по алфавиту
      return a.className.localeCompare(b.className);
    }).map(item => {
      // Рекурсивно сортируем подэлементы
      if (item.subItems && item.subItems.length > 0) {
        item.subItems = this.sortTreeItems(item.subItems);
      }
      return item;
    });
  }

  public static updateClassName(
    document: vscode.TextDocument,
    oldClassName: string,
    newClassName: string
  ): Thenable<boolean> {
    const documentText = document.getText();
    const classPattern = new RegExp(
      `class\\s*=\\s*["']([^"']*\\b${oldClassName}\\b[^"']*)["']`,
      'g'
    );

    const updatedText = documentText.replace(classPattern, (match, classGroup) => {
      const updatedClasses = classGroup.split(/\s+/).map((className: string) => {
        const classParts = className.split(":");
        if (classParts.includes(oldClassName)) {
          classParts[classParts.indexOf(oldClassName)] = newClassName;
        }
        return classParts.join(":");
      });
      return `class="${updatedClasses.join(' ')}"`;
    });

    const documentEdit = new vscode.WorkspaceEdit();
    const fullDocumentRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(documentText.length)
    );

    documentEdit.replace(document.uri, fullDocumentRange, updatedText);
    return vscode.workspace.applyEdit(documentEdit); // Возвращаем промис
  }

  public static async addClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    newClassName: string
  ): Promise<boolean> {
    const documentText = document.getText();
    const cursorOffset = document.offsetAt(position);
    const classPattern = /class\s*=\s*(["'])(.*?)\1/g;
    
    let matchResult;
    while ((matchResult = classPattern.exec(documentText)) !== null) {
      const classValueStart = matchResult.index + matchResult[0].indexOf(matchResult[1]) + 1;
      const classValueEnd = classValueStart + matchResult[2].length;

      if (cursorOffset >= classValueStart && cursorOffset <= classValueEnd) {
        const currentClasses = matchResult[2];
        const newValue = currentClasses ? `${currentClasses} ${newClassName}` : newClassName;
        
        const edit = new vscode.WorkspaceEdit();
        const range = new vscode.Range(
          document.positionAt(classValueStart),
          document.positionAt(classValueEnd)
        );
        
        edit.replace(document.uri, range, newValue);
        return vscode.workspace.applyEdit(edit);
      }
    }
    return false;
  }

  public static async addSubClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    parentClassName: string,
    subClassName: string
  ): Promise<boolean> {
    const documentText = document.getText();
    const cursorOffset = document.offsetAt(position);
    const classPattern = /class\s*=\s*(["'])(.*?)\1/g;
    
    let matchResult;
    while ((matchResult = classPattern.exec(documentText)) !== null) {
      const classValueStart = matchResult.index + matchResult[0].indexOf(matchResult[1]) + 1;
      const classValueEnd = classValueStart + matchResult[2].length;

      if (cursorOffset >= classValueStart && cursorOffset <= classValueEnd) {
        const currentClasses = matchResult[2].split(/\s+/);
        
        // Найти все классы, которые относятся к родительскому классу
        const updatedClasses = currentClasses.map(cls => {
          if (cls === parentClassName) {
            // Если это простой класс без подклассов - добавляем подкласс
            return `${parentClassName}:${subClassName}`;
          } else if (cls.startsWith(`${parentClassName}:`)) {
            // Если это класс с подклассами - сохраняем существующий и добавляем новый
            return `${cls} ${parentClassName}:${subClassName}`;
          }
          return cls;
        });

        const edit = new vscode.WorkspaceEdit();
        const range = new vscode.Range(
          document.positionAt(classValueStart),
          document.positionAt(classValueEnd)
        );
        
        edit.replace(document.uri, range, updatedClasses.join(' '));
        return vscode.workspace.applyEdit(edit);
      }
    }
    return false;
  }

  public static async removeClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    classNameToRemove: string
  ): Promise<boolean> {
    const documentText = document.getText();
    const cursorOffset = document.offsetAt(position);
    const classPattern = /class\s*=\s*(["'])(.*?)\1/g;
    
    let matchResult;
    while ((matchResult = classPattern.exec(documentText)) !== null) {
      const classValueStart = matchResult.index + matchResult[0].indexOf(matchResult[1]) + 1;
      const classValueEnd = classValueStart + matchResult[2].length;

      if (cursorOffset >= classValueStart && cursorOffset <= classValueEnd) {
        const currentClasses = matchResult[2].split(/\s+/).filter(cls => cls !== classNameToRemove);
        const newValue = currentClasses.join(' ');

        const edit = new vscode.WorkspaceEdit();
        const range = new vscode.Range(
          document.positionAt(classValueStart),
          document.positionAt(classValueEnd)
        );
        
        edit.replace(document.uri, range, newValue);
        return vscode.workspace.applyEdit(edit);
      }
    }
    return false;
  }
}
