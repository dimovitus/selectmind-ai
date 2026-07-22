import type { Pipeline } from '@/domain/provider/provider.schema';
import type { PipelineId } from '@/domain/shared/ids';
import { getDB } from '../indexeddb.adapter';

export interface PipelineRepositoryPort {
  getAll(): Promise<Pipeline[]>;
  getById(id: PipelineId): Promise<Pipeline | null>;
  save(pipeline: Pipeline): Promise<void>;
  saveMany(pipelines: Pipeline[]): Promise<void>;
  delete(id: PipelineId): Promise<void>;
}

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
