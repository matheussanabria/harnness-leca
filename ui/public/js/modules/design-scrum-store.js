// @ts-check
// Estado compartilhado de design-scrum (mutável, importado pelos módulos).

export const ds = {
  currentScrumData: null,
  currentScrumTab: "sprint", // 'sprint' | 'backlog' | 'epics'
  currentEpicFilter: "all",
  currentSearchQuery: "",
  currentAssigneeFilter: "all",
  onlyImpediments: false,
  selectedSprintFilter: "active", // 'active' | 'all' | sprintId
  selectedStoryId: null,
  storyDrawerReturnFocus: null,
};
