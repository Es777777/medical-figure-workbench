import { createProject } from "../features/project/store";

export function createProjectState(title: string) {
  return {
    project: createProject(title),
  };
}
