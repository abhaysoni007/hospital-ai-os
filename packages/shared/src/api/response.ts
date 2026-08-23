export interface SuccessResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  nextCursor?: string;
  hasNextPage?: boolean;
}

export interface ErrorDetail {
  field?: string;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: ErrorDetail[];
  };
}
