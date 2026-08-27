import type { Pipeline } from '@/domain/provider/provider.schema';
import type { PipelineId } from '@/domain/shared/ids';
import type { PipelineRepositoryPort } from '@selectmind/core';
import { getDB } from '../indexeddb.adapter';

export type { PipelineRepositoryPort };

export class PipelineRepository implements PipelineRepositoryPort {
  async getAll(): Promise<Pipeline[]> {
    return getDB().pipelines.toArray();
  }

  async getById(id: PipelineId): Promise<Pipeline | null> {
    return (await getDB().pipelines.get(id)) ?? null;
  }

  async save(pipeline: Pipeline): Promise<void> {
    await getDB().pipelines.put(pipeline);
  }

  async saveMany(pipelines: Pipeline[]): Promise<void> {
    await getDB().pipelines.bulkPut(pipelines);
  }

  async delete(id: PipelineId): Promise<void> {
    await getDB().pipelines.delete(id);
  }
}
