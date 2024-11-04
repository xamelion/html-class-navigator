import * as vscode from 'vscode';
import { TreeDataProvider } from './treeDataProvider';
import { TreeItem } from './models/TreeItem';

export function activate(context: vscode.ExtensionContext) {
  const treeDataProvider = new TreeDataProvider();
  
  // Регистрация древовидного представления
  const treeView = vscode.window.registerTreeDataProvider('classNavigator', treeDataProvider);

  // Регистрация команд
  const commands = [
    vscode.commands.registerCommand("classNavigator.rename", async (item: TreeItem) => {
      const newClassName = await vscode.window.showInputBox({
        prompt: "Введите новое имя класса",
        value: item.className,
        validateInput: (value) => {
          return value && value.trim() ? null : 'Имя класса не может быть пустым';
        }
      });

      if (newClassName) {
        await treeDataProvider.renameClass(item, newClassName.trim()); // Ждем завершения переименования
      }
    }),

    vscode.commands.registerCommand("classNavigator.addClass", async () => {
      const className = await vscode.window.showInputBox({
        prompt: "Введите имя нового класса",
        validateInput: (value) => {
          return value && value.trim() ? null : 'Имя класса не может быть пустым';
        }
      });

      if (className) {
        await treeDataProvider.addNewClass(className.trim()); // Добавлен await
      }
    }),

    vscode.commands.registerCommand("classNavigator.addSubClass", async (item: TreeItem) => {
      const subClassName = await vscode.window.showInputBox({
        prompt: `Введите имя подкласса для "${item.className}"`,
        validateInput: (value) => {
          return value && value.trim() ? null : 'Имя подкласса не может быть пустым';
        }
      });

      if (subClassName) {
        await treeDataProvider.addSubClass(item, subClassName.trim()); // Добавлен await
      }
    })
  ];

  // Регистрация всех команд в контексте
  context.subscriptions.push(...commands);

  console.log('HTML Class Navigator extension activated');
}

export function deactivate() {
  console.log('HTML Class Navigator extension deactivated');
}
