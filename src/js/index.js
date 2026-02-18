import { TodoListComponent } from './todo-list.component.js';
import { TodoModel, TODO_SCHEMA } from './todo-model.js';
import { TodoCollection } from './todo-collection.js';
import { StorageAdapter } from './storage-adapter.js';
import * as constants from './constants.js';

// Register the custom element
if (!customElements.get('todo-list')) {
  customElements.define('todo-list', TodoListComponent);
}

// Export public surface for ESM consumers and IIFE window.TodoList
export {
  TodoListComponent,
  TodoModel,
  TodoCollection,
  StorageAdapter,
  TODO_SCHEMA,
  constants
};
