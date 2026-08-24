import { z } from 'zod';
import { offsetPaginationSchema } from './pagination';

export const patientGenderSchema = z.enum(['male', 'female', 'other', 'undisclosed']);
export const patientStatusSchema = z.enum(['active', 'merged', 'archived']);

export const registerPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().date(),
  gender: patientGenderSchema,
  phonePrimary: z.string().min(5).max(20),
  phoneEmergency: z.string().max(20).optional(),
  emergencyContactName: z.string().max(100).optional(),
  addressLine1: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(100).optional(),
  addressPostalCode: z.string().max(20).optional(),
});

export type RegisterPatientRequest = z.infer<typeof registerPatientSchema>;

export const updatePatientSchema = registerPatientSchema.partial().extend({
  status: patientStatusSchema.optional(),
});

export type UpdatePatientRequest = z.infer<typeof updatePatientSchema>;

export const patientResponseSchema = z.object({
  id: z.string().uuid(),
  mrn: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  gender: patientGenderSchema,
  phonePrimary: z.string(),
  phoneEmergency: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressCity: z.string().nullable().optional(),
  addressState: z.string().nullable().optional(),
  addressPostalCode: z.string().nullable().optional(),
  status: patientStatusSchema,
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PatientResponse = z.infer<typeof patientResponseSchema>;

export const getPatientsQuerySchema = offsetPaginationSchema.extend({
  query: z.string().optional(), // Used for fuzzy search by name or MRN
  mrn: z.string().optional(),
  phone: z.string().optional(),
  status: patientStatusSchema.optional(),
});

export type GetPatientsQuery = z.infer<typeof getPatientsQuerySchema>;
