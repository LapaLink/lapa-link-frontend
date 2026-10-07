export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_EMAIL: "/register/verify",
  ACCOUNT: "/account",
  MY_TASKS: "/my-tasks",
  MY_CASES: "/my-cases",
  EDIT_CASE: (caseId: string) => `/cases/${caseId}/edit`,
  CASES: "/cases",
  CASE_DETAILS: (caseId: string) => `/cases/${caseId}`,
  CREATE_CASE: "/cases/create",
} as const
