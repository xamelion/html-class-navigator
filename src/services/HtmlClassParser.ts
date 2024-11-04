import * as vscode from "vscode";
import { TreeItem } from "../models/TreeItem";
import { 
  filter, 
  find, 
  map, 
  split, 
  sortBy, 
  join,
  isEmpty,
  compact,
  includes,
  replace
} from 'lodash-es';

/**
 * Интерфейс для описания устройств
 */
interface DeviceDescription {
  prefix: string;
  description: string;
  order: number;
}

/**
 * Класс для парсинга и управления HTML-классами
 */
export class HtmlClassParser {
  /**
   * Список поддерживаемых типов устройств с их префиксами
   */
  private static readonly deviceTypes: DeviceDescription[] = [
    { prefix: "ph", description: "Телефон", order: 1 },
    { prefix: "tb", description: "Планшет", order: 2 },
    { prefix: "lp", description: "Ноутбук", order: 3 },
    { prefix: "dk", description: "Десктоп", order: 4 },
    { prefix: "wd", description: "Широкий формат", order: 5 }
  ];

  /**
   * Находит класс в позиции курсора
   */
  public static findClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | null {
    return this.processClassAtCursor(document, position, (matchResult, cursorOffset, classValueStart, classValueEnd) => 
      cursorOffset >= classValueStart && cursorOffset <= classValueEnd ? matchResult[2] : null
    );
  }

  /**
   * Создает древовидную структуру из строки классов
   */
  public static createClassTree(classValue: string): TreeItem[] {
    const rootElements: TreeItem[] = [];
    map(compact(split(classValue, /\s+/)), className => 
      this.addClassNodeToTree(rootElements, split(className, ':'), "")
    );
    return this.sortTreeItems(rootElements);
  }

  /**
   * Рекурсивно добавляет узлы в дерево классов
   */
  private static addClassNodeToTree(
    items: TreeItem[],
    classNameParts: string[],
    parentPath: string
  ): void {
    if (classNameParts.length === 0) return;

    const currentClassName = classNameParts[0];
    const currentPath = parentPath ? `${parentPath}:${currentClassName}` : currentClassName;
    
    let existingItem = find(items, item => item.className === currentClassName);
    
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
      existingItem.subItems = existingItem.subItems || [];
      this.addClassNodeToTree(existingItem.subItems, classNameParts.slice(1), currentPath);
      existingItem.subItems = this.sortTreeItems(existingItem.subItems);
    } else {
      existingItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
  }

  /**
   * Получает описание устройства по префиксу класса
   */
  private static getDeviceDescription(className: string): string {
    return join(
      map(
        filter(this.deviceTypes, device => includes(className, device.prefix)),
        'description'
      ),
      " "
    );
  }

  /**
   * Получает порядковый номер устройства для сортировки
   */
  private static getDeviceOrder(className: string): number {
    const device = find(this.deviceTypes, d => includes(className, d.prefix));
    return device ? device.order : 0;
  }

  /**
   * Сор��ирует элементы дерева по устройствам и алфавиту
   */
  private static sortTreeItems(items: TreeItem[]): TreeItem[] {
    return map(
      sortBy(items, [
        item => this.getDeviceOrder(item.className),
        'className'
      ]),
      item => {
        if (!isEmpty(item.subItems)) {
          item.subItems = this.sortTreeItems(item.subItems!);
        }
        return item;
      }
    );
  }

  /**
   * Обновляет имя класса во всем документе
   */
  public static async updateClassName(
    document: vscode.TextDocument,
    oldClassName: string,
    newClassName: string
  ): Promise<boolean> {
    const documentText = document.getText();
    const classPattern = new RegExp(
      `(class\\s*=\\s*["'][^"']*)(\\b${this.escapeRegExp(oldClassName)}\\b)([^"']*["'])`,
      'g'
    );

    const updatedText = documentText.replace(classPattern, (match, prefix, classToReplace, suffix) => {
      return `${prefix}${newClassName}${suffix}`;
    });

    if (updatedText === documentText) {
      return false; // Ничего не заменено
    }

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(documentText.length)
    );
    edit.replace(document.uri, fullRange, updatedText);
    return await vscode.workspace.applyEdit(edit);
  }

  /**
   * Экранирует специальные символы в строке для использования в регулярном выражении
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Добавляет новый класс в позиции курсора
   */
  public static async addClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    newClassName: string
  ): Promise<boolean> {
    return this.processClassAtCursor(document, position, (matchResult, cursorOffset, classValueStart, classValueEnd) => {
      if (cursorOffset >= classValueStart && cursorOffset <= classValueEnd) {
        const newValue = matchResult[2] ? `${matchResult[2]} ${newClassName}` : newClassName;
        return this.applyEdit(document, classValueStart, classValueEnd, newValue);
      }
      return false;
    });
  }

  /**
   * Добавляет подкласс к существующему классу
   */
  public static async addSubClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    parentClassName: string,
    subClassName: string
  ): Promise<boolean> {
    return this.processClassAtCursor(document, position, (matchResult, cursorOffset, classValueStart, classValueEnd) => {
      if (cursorOffset >= classValueStart && cursorOffset <= classValueEnd) {
        const updatedClasses = map(split(matchResult[2], /\s+/), cls => {
          if (cls === parentClassName) return `${parentClassName}:${subClassName}`;
          if (cls.startsWith(`${parentClassName}:`)) return `${cls} ${parentClassName}:${subClassName}`;
          return cls;
        });
        return this.applyEdit(document, classValueStart, classValueEnd, join(updatedClasses, ' '));
      }
      return false;
    });
  }

  /**
   * Удаляет класс и все его подклассы в позиции курсора
   */
  public static async removeClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    classNameToRemove: string
  ): Promise<boolean> {
    return this.processClassAtCursor(document, position, (matchResult, cursorOffset, classValueStart, classValueEnd) => {
      if (cursorOffset >= classValueStart && cursorOffset <= classValueEnd) {
        const currentClasses = split(matchResult[2], /\s+/).filter(cls => 
          !cls.startsWith(`${classNameToRemove}:`) && cls !== classNameToRemove
        );
        return this.applyEdit(document, classValueStart, classValueEnd, join(currentClasses, ' '));
      }
      return false;
    });
  }

  /**
   * Вспомогательная функция для обработки классов в позиции курсора
   */
  private static processClassAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    callback: (matchResult: RegExpExecArray, cursorOffset: number, classValueStart: number, classValueEnd: number) => any
  ): any {
    const documentText = document.getText();
    const cursorOffset = document.offsetAt(position);
    const classPattern = /class\s*=\s*(["'])(.*?)\1/g;
    
    let matchResult;
    while ((matchResult = classPattern.exec(documentText)) !== null) {
      const classValueStart = matchResult.index + matchResult[0].indexOf(matchResult[1]) + 1;
      const classValueEnd = classValueStart + matchResult[2].length;

      const result = callback(matchResult, cursorOffset, classValueStart, classValueEnd);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }

  /**
   * Вспомогательная функция для изменения классов в документе
   */
  private static modifyClassInDocument(
    document: vscode.TextDocument,
    oldClassName: string,
    modifyCallback: (classParts: string[]) => string
  ): Thenable<boolean> {
    const documentText = document.getText();
    const classPattern = new RegExp(
      `class\\s*=\\s*["']([^"']*\\b${oldClassName}\\b[^"']*)["']`,
      'g'
    );

    const updatedText = replace(documentText, classPattern, (match, classGroup) => {
      const updatedClasses = map(
        split(classGroup, /\s+/),
        className => modifyCallback(split(className, ":"))
      );
      return `class="${join(updatedClasses, ' ')}"`;
    });

    const documentEdit = new vscode.WorkspaceEdit();
    const fullDocumentRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(documentText.length)
    );

    documentEdit.replace(document.uri, fullDocumentRange, updatedText);
    return vscode.workspace.applyEdit(documentEdit); // Возвращаем промис
  }

  /**
   * Вспомогательная функция для применения изменений в документе
   */
  private static applyEdit(
    document: vscode.TextDocument,
    start: number,
    end: number,
    newValue: string
  ): Thenable<boolean> {
    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
      document.positionAt(start),
      document.positionAt(end)
    );
    edit.replace(document.uri, range, newValue);
    return vscode.workspace.applyEdit(edit);
  }
}
