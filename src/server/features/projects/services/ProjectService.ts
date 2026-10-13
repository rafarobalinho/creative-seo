import {
  archiveProject,
  createProject,
  deleteArchivedProject,
  getProjectForOrganization,
  getProjectWithOrganization,
  listArchivedProjects,
  listProjects,
  listProjectsEnsuringOne,
  restoreProject,
  setProjectWebsite,
  updateProject,
} from "@/server/features/projects/services/projects";

export const ProjectService = {
  listProjects,
  listProjectsEnsuringOne,
  createProject,
  updateProject,
  setProjectWebsite,
  archiveProject,
  restoreProject,
  deleteArchivedProject,
  listArchivedProjects,
  getProjectForOrganization,
  getProjectWithOrganization,
} as const;
