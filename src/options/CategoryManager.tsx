import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Category } from '@/domain/action/action.schema';
import { createCategoryId, now } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

interface CategoryManagerProps {
  categories: Category[];
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const timestamp = now();
      const category: Category = {
        id: createCategoryId(),
        name: name.trim(),
        icon: icon.trim() || '📁',
        order: categories.length,
        isBuiltIn: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return rpcClient.call('category:save', { category });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setName('');
      setIcon('📁');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (categoryId: Category['id']) =>
      rpcClient.call('category:delete', { categoryId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: (error: Error) => alert(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <span>{cat.icon}</span>
                <span className="text-sm font-medium">{cat.name}</span>
                {cat.isBuiltIn && (
                  <span className="text-xs text-muted-foreground">built-in</span>
                )}
              </div>
              {!cat.isBuiltIn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => {
                    if (confirm(`Delete category "${cat.name}"?`)) {
                      deleteMutation.mutate(cat.id);
                    }
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">New Category</p>
          <div className="flex gap-2">
            <input
              className="w-12 rounded-md border bg-background px-2 py-1.5 text-center text-sm"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📁"
            />
            <input
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
            >
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
