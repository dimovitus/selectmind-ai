import type { Action } from '@/domain/action/action.schema';
import type { Category } from '@/domain/action/action.schema';
import type { ActionId } from '@/domain/shared/ids';
import type { ActionRepositoryPort, CategoryRepositoryPort } from '@selectmind/core';
import { getDB } from '../indexeddb.adapter';

export type { ActionRepositoryPort, CategoryRepositoryPort };

export class ActionRepository implements ActionRepositoryPort {
  async getAll(): Promise<Action[]> {
    return getDB().actions.orderBy('order').toArray();
  }

  async getById(id: ActionId): Promise<Action | null> {
    return (await getDB().actions.get(id)) ?? null;
  }

  async getByCategory(categoryId: string): Promise<Action[]> {
    return getDB().actions.where('categoryId').equals(categoryId).sortBy('order');
  }

  async getToolbarActions(limit: number): Promise<Action[]> {
    const actions = await getDB().actions.filter((a: Action) => a.isEnabled).sortBy('order');
    return actions.slice(0, limit);
  }

  async save(action: Action): Promise<void> {
    await getDB().actions.put(action);
  }

  async saveMany(actions: Action[]): Promise<void> {
    await getDB().actions.bulkPut(actions);
  }

  async delete(id: ActionId): Promise<void> {
    await getDB().actions.delete(id);
  }
}

export class CategoryRepository implements CategoryRepositoryPort {
  async getAll(): Promise<Category[]> {
    return getDB().categories.orderBy('order').toArray();
  }

  async getById(id: string): Promise<Category | null> {
    return (await getDB().categories.get(id)) ?? null;
  }

  async save(category: Category): Promise<void> {
    await getDB().categories.put(category);
  }

  async saveMany(categories: Category[]): Promise<void> {
    await getDB().categories.bulkPut(categories);
  }

  async delete(id: string): Promise<void> {
    await getDB().categories.delete(id);
  }
}
