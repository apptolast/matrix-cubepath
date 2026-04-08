import { z } from 'zod';

export const monitoringCategorySchema = z.enum([
  'k8s', 'database', 'app', 'network', 'storage', 'docker', 'security', 'backup', 'iot'
]);

export const kubernetesDetailParamsSchema = z.object({
  resourceType: z.enum(['node', 'pod', 'deployment', 'service', 'namespace', 'event']),
  name: z.string().min(1),
});

export const alertIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const historyQuerySchema = z.object({
  category: monitoringCategorySchema.optional(),
  resource: z.string().optional(),
  range: z.enum(['1h', '6h', '24h', '7d']).default('24h'),
});

export const configBodySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
