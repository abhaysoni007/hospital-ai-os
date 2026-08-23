import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export const generateId = (): string => {
  return uuidv4();
};

export const isValidId = (id: string): boolean => {
  return validateUuid(id);
};
