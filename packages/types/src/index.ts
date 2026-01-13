// Re-export database types
export type {
  User,
  Session,
  Project,
  ProjectMember,
  ProjectInvite,
  ProjectSnapshot,
  NewUser,
  NewSession,
  NewProject,
  NewProjectMember,
  NewProjectInvite,
  NewProjectSnapshot,
} from '@strudel-flow/db';

// Import types for local use
import type {
  User as UserType,
  Session as SessionType,
  Project as ProjectType,
  ProjectMember as ProjectMemberType,
} from '@strudel-flow/db';

// API Client Types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Auth Types
export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: UserType;
  session: SessionType;
  token: string;
}

// Project Types (API layer)
export interface CreateProjectInput {
  name: string;
}

export interface UpdateProjectInput {
  name?: string;
}

export interface ProjectWithMembers extends ProjectType {
  members: Array<ProjectMemberType & { user: UserType }>;
  owner: UserType;
}

export interface ProjectSnapshotData {
  id: string;
  projectId: string;
  ydocSnapshot: string;
  createdAt: Date;
}

// Real-time Types
export interface CollaborationUpdate {
  type: 'cursor' | 'selection' | 'edit';
  userId: string;
  data: unknown;
}
