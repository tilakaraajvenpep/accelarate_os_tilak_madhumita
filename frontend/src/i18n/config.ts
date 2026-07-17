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
import enAcceptInvite from './locales/en/acceptInvite.json'

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
import zhAcceptInvite from './locales/zh/acceptInvite.json'

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
        acceptInvite: enAcceptInvite,
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
        acceptInvite: zhAcceptInvite,
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
      'acceptInvite',
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'aos_language',
    },
  })

export default i18n
