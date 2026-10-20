// @ts-check
// Fachada de groups: reexporta a API pública dos módulos (outros arquivos importam daqui).
export { getProjectGroups, getProjectAssignments, getGroupById, saveGroupsData } from "./groups-data.js";
export { openAssignChatGroupModal, onAssignGroupSelectChange, onAssignSubgroupSelectChange, saveChatGroupAssignment, removeChatGroupAssignment, requestSingleChatSuggestion } from "./groups-assign.js";
export { renderColorPalettePicker, selectGroupColor, openManageGroupsModal, cancelEditGroup, editGroup, submitCreateOrUpdateGroup, deleteGroup, addSubgroupInline, removeSubgroup, renderManageGroupsList } from "./groups-manage.js";
export { loadAutoClassifySuggestions, closeBatchSuggestContainer, applyBatchClassifySuggestions } from "./groups-classify.js";
