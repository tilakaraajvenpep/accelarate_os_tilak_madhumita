import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from './locales/en/common.json'
import enHeader from './locales/en/header.json'
import enSidebar from './locales/en/sidebar.json'
import enChangePassword from './locales/en/changePassword.json'
import enLanding from './locales/en/landing.json'
import enLogin from './locales/en/login.json'
import enGetStarted from './locales/en/getStarted.json'
import enDashboardFounder from './locales/en/dashboardFounder.json'
import enDashboardAdmin from './locales/en/dashboardAdmin.json'
import enDashboardSuperAdmin from './locales/en/dashboardSuperAdmin.json'
import enSuperadminTenants from './locales/en/superadminTenants.json'
import enSuperadminPlans from './locales/en/superadminPlans.json'
import enSuperadminCoupons from './locales/en/superadminCoupons.json'
import enSuperadminReports from './locales/en/superadminReports.json'
import enSuperadminAdmins from './locales/en/superadminAdmins.json'
import enSuperadminSettings from './locales/en/superadminSettings.json'
import enCompanies from './locales/en/companies.json'
import enCohorts from './locales/en/cohorts.json'
import enAcceptInvite from './locales/en/acceptInvite.json'
import enPrograms from './locales/en/programs.json'
import enProgram from './locales/en/program.json'
import enForms from './locales/en/forms.json'
import enCalendar from './locales/en/calendar.json'
import enSettings from './locales/en/settings.json'
import enAcceptMentorInvite from './locales/en/acceptMentorInvite.json'
import enMentors from './locales/en/mentors.json'
import enDocuments from './locales/en/documents.json'
import enCompanyTeam from './locales/en/companyTeam.json'
import enGovernance from './locales/en/governance.json'
import enFounderPillars from './locales/en/founderPillars.json'
import enFounderGovernance from './locales/en/founderGovernance.json'
import enAiChat from './locales/en/aiChat.json'
import enDynamicForm from './locales/en/dynamicForm.json'

import zhCommon from './locales/zh/common.json'
import zhHeader from './locales/zh/header.json'
import zhSidebar from './locales/zh/sidebar.json'
import zhChangePassword from './locales/zh/changePassword.json'
import zhLanding from './locales/zh/landing.json'
import zhLogin from './locales/zh/login.json'
import zhGetStarted from './locales/zh/getStarted.json'
import zhDashboardFounder from './locales/zh/dashboardFounder.json'
import zhDashboardAdmin from './locales/zh/dashboardAdmin.json'
import zhDashboardSuperAdmin from './locales/zh/dashboardSuperAdmin.json'
import zhSuperadminTenants from './locales/zh/superadminTenants.json'
import zhSuperadminPlans from './locales/zh/superadminPlans.json'
import zhSuperadminCoupons from './locales/zh/superadminCoupons.json'
import zhSuperadminReports from './locales/zh/superadminReports.json'
import zhSuperadminAdmins from './locales/zh/superadminAdmins.json'
import zhSuperadminSettings from './locales/zh/superadminSettings.json'
import zhCompanies from './locales/zh/companies.json'
import zhCohorts from './locales/zh/cohorts.json'
import zhAcceptInvite from './locales/zh/acceptInvite.json'
import zhPrograms from './locales/zh/programs.json'
import zhProgram from './locales/zh/program.json'
import zhForms from './locales/zh/forms.json'
import zhCalendar from './locales/zh/calendar.json'
import zhSettings from './locales/zh/settings.json'
import zhAcceptMentorInvite from './locales/zh/acceptMentorInvite.json'
import zhMentors from './locales/zh/mentors.json'
import zhDocuments from './locales/zh/documents.json'
import zhCompanyTeam from './locales/zh/companyTeam.json'
import zhGovernance from './locales/zh/governance.json'
import zhFounderPillars from './locales/zh/founderPillars.json'
import zhFounderGovernance from './locales/zh/founderGovernance.json'
import zhAiChat from './locales/zh/aiChat.json'
import zhDynamicForm from './locales/zh/dynamicForm.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        header: enHeader,
        sidebar: enSidebar,
        changePassword: enChangePassword,
        landing: enLanding,
        login: enLogin,
        getStarted: enGetStarted,
        dashboardFounder: enDashboardFounder,
        dashboardAdmin: enDashboardAdmin,
        dashboardSuperAdmin: enDashboardSuperAdmin,
        superadminTenants: enSuperadminTenants,
        superadminPlans: enSuperadminPlans,
        superadminCoupons: enSuperadminCoupons,
        superadminReports: enSuperadminReports,
        superadminAdmins: enSuperadminAdmins,
        superadminSettings: enSuperadminSettings,
        companies: enCompanies,
        cohorts: enCohorts,
        acceptInvite: enAcceptInvite,
        programs: enPrograms,
        program: enProgram,
        forms: enForms,
        calendar: enCalendar,
        settings: enSettings,
        acceptMentorInvite: enAcceptMentorInvite,
        mentors: enMentors,
        documents: enDocuments,
        companyTeam: enCompanyTeam,
        governance: enGovernance,
        founderPillars: enFounderPillars,
        founderGovernance: enFounderGovernance,
        aiChat: enAiChat,
        dynamicForm: enDynamicForm,
      },
      zh: {
        common: zhCommon,
        header: zhHeader,
        sidebar: zhSidebar,
        changePassword: zhChangePassword,
        landing: zhLanding,
        login: zhLogin,
        getStarted: zhGetStarted,
        dashboardFounder: zhDashboardFounder,
        dashboardAdmin: zhDashboardAdmin,
        dashboardSuperAdmin: zhDashboardSuperAdmin,
        superadminTenants: zhSuperadminTenants,
        superadminPlans: zhSuperadminPlans,
        superadminCoupons: zhSuperadminCoupons,
        superadminReports: zhSuperadminReports,
        superadminAdmins: zhSuperadminAdmins,
        superadminSettings: zhSuperadminSettings,
        companies: zhCompanies,
        cohorts: zhCohorts,
        acceptInvite: zhAcceptInvite,
        programs: zhPrograms,
        program: zhProgram,
        forms: zhForms,
        calendar: zhCalendar,
        settings: zhSettings,
        acceptMentorInvite: zhAcceptMentorInvite,
        mentors: zhMentors,
        documents: zhDocuments,
        companyTeam: zhCompanyTeam,
        governance: zhGovernance,
        founderPillars: zhFounderPillars,
        founderGovernance: zhFounderGovernance,
        aiChat: zhAiChat,
        dynamicForm: zhDynamicForm,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    load: 'languageOnly',
    defaultNS: 'common',
    ns: [
      'common',
      'header',
      'sidebar',
      'changePassword',
      'landing',
      'login',
      'getStarted',
      'dashboardFounder',
      'dashboardAdmin',
      'dashboardSuperAdmin',
      'superadminTenants',
      'superadminPlans',
      'superadminCoupons',
      'superadminReports',
      'superadminAdmins',
      'superadminSettings',
      'companies',
      'cohorts',
      'acceptInvite',
      'programs',
      'program',
      'forms',
      'calendar',
      'settings',
      'acceptMentorInvite',
      'mentors',
      'documents',
      'companyTeam',
      'governance',
      'founderPillars',
      'founderGovernance',
      'aiChat',
      'dynamicForm',
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'aos_language',
    },
  })

export default i18n
