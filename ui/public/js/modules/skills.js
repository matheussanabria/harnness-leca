// @ts-check
// Fachada de skills: reexporta a API pública dos módulos (outros arquivos importam daqui).
export { renderSkillsSection, openSkillViewerModal, showSkillSubTab, toggleEditSkillMode, saveCurrentSkillEdit, deleteCurrentSkill } from "./skills-section.js";
export { openAddSkillModal, onAddSkillTargetChange, switchAddSkillTab, installSkillBundle, installSkillTemplate, createCustomSkill } from "./skills-add.js";
export { loadRecognizedSkills, renderImportSkillsList, filterImportSkills, importRecognizedSkillToTarget, cloneSkillToTarget } from "./skills-import.js";
export { hydrateSkillsState } from "./skills-state.js";
