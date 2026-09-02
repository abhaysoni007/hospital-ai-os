import { GetTasksQuery, TaskListResponse, TaskResponse } from 'shared';
import { apiClient } from './api-client';

class TaskService {
  private readonly baseUrl = '/tasks';

  async listTasks(query: GetTasksQuery): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.pageSize) params.append('pageSize', query.pageSize.toString());
    if (query.status) params.append('status', query.status);
    if (query.priority) params.append('priority', query.priority);
    if (query.taskType) params.append('taskType', query.taskType);
    if (query.scope) params.append('scope', query.scope);

    return apiClient<TaskListResponse>(`${this.baseUrl}?${params.toString()}`, { method: 'GET' });
  }

  async getTask(id: string): Promise<TaskResponse> {
    return apiClient<TaskResponse>(`${this.baseUrl}/${id}`, { method: 'GET' });
  }

  async acknowledgeTask(id: string): Promise<TaskResponse> {
    return apiClient<TaskResponse>(`${this.baseUrl}/${id}/acknowledge`, { method: 'POST' });
  }

  async completeTask(id: string): Promise<TaskResponse> {
    return apiClient<TaskResponse>(`${this.baseUrl}/${id}/complete`, { method: 'POST' });
  }

  /** M17 — reassign/escalate route through the service layer like every other task action. */
  async reassignTask(id: string, newAssigneeId: string): Promise<TaskResponse> {
    return apiClient<TaskResponse>(`${this.baseUrl}/${id}/reassign`, {
      method: 'POST',
      body: { newAssigneeId },
    });
  }

  async escalateTask(id: string): Promise<TaskResponse> {
    return apiClient<TaskResponse>(`${this.baseUrl}/${id}/escalate`, { method: 'POST' });
  }
}

export const taskService = new TaskService();
