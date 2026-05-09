const defaultAppsScriptUrl =
  "https://script.google.com/macros/s/AKfycbxNsTuK4b-5Ooj1wOeHlzAhcNxubHjREB5K4kBaIvGrNuhbt0VCA5zGPXabGvbGRjb2/exec";

export const appsScriptUrl = window.APP_CONFIG?.APPS_SCRIPT_URL ?? defaultAppsScriptUrl;
