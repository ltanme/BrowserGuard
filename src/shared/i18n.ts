import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  'zh-CN': {
    translation: {
      warning: '检测到受限网站：{{domain}}\n5 秒后将关闭浏览器',
      confirm: '确定',
      admin_exit: '请输入管理员密码退出',
      wrong_pwd: '密码错误'
    }
  },
  'en-US': {
    translation: {
      warning: 'Blocked site detected: {{domain}}\nBrowser will close in 5 seconds',
      confirm: 'OK',
      admin_exit: 'Enter admin password to exit',
      wrong_pwd: 'Wrong password'
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: navigator.language,
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false }
});

export default i18n; 