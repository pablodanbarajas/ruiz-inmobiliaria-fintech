import type { IDevelopmentsService } from '../interfaces';
import type { PublicDevelopment } from '../../types/development.types';
import { mockDevelopments } from '../../data/mock/developments.mock';

export const mockDevelopmentsService: IDevelopmentsService = {
  async getPublicDevelopments(): Promise<PublicDevelopment[]> {
    return mockDevelopments;
  }
};
